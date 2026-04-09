#!/usr/bin/env node

import { pathToFileURL } from 'node:url';

import {
  arraySchema,
  booleanSchema,
  integerSchema,
  objectSchema,
  readStrictJSON,
  sha1Prefix,
  stringSchema,
  writeJSON,
  writeStdout,
} from './lib/runtime.mjs';

const reviewContextSchema = objectSchema({
  owner: stringSchema,
  repo: stringSchema,
  pr_number: integerSchema,
  url: stringSchema,
  title: stringSchema,
  author: stringSchema,
  base_branch: stringSchema,
  head_branch: stringSchema,
});

const rawThreadSchema = objectSchema({
  issue_key: stringSchema,
  thread_graphql_id: stringSchema,
  comment_node_ids: arraySchema(stringSchema),
  title: stringSchema,
  reviewer: stringSchema,
  file_path: stringSchema,
  line: integerSchema,
  thread_url: stringSchema,
  is_outdated: booleanSchema,
  problem_statement: stringSchema,
  top_comment: stringSchema,
  replies_summary: stringSchema,
  translated_comment: stringSchema,
  original_comment: stringSchema,
  show_original: booleanSchema,
  original_comment_title: stringSchema,
  code_context_title: stringSchema,
  code_context_lang: stringSchema,
  code_context: stringSchema,
  diff_hunk_title: stringSchema,
  diff_hunk_lang: stringSchema,
  diff_hunk: stringSchema,
  show_diff_hunk: booleanSchema,
  suggestion_title: stringSchema,
  suggestion_md: stringSchema,
  instruction_field: stringSchema,
  instruction_label: stringSchema,
  instruction_rows: integerSchema,
  instruction_placeholder: stringSchema,
  instruction_value: stringSchema,
  auto_resolve_field: stringSchema,
  auto_resolve_label: stringSchema,
  auto_resolve_value: booleanSchema,
});

const rawGroupSchema = objectSchema({
  group_key: stringSchema,
  title_md: stringSchema,
  title: stringSchema,
  reviewer: stringSchema,
  review_time: stringSchema,
  hide_field: stringSchema,
  hide_label: stringSchema,
  hide_value: booleanSchema,
  comment_node_ids: arraySchema(stringSchema),
  threads: arraySchema(rawThreadSchema),
});

const buildInputSchema = objectSchema({
  title: stringSchema,
  subtitle: stringSchema,
  eyebrow: stringSchema,
  submit_label: stringSchema,
  cancel_label: stringSchema,
  summary_md: stringSchema,
  groups: arraySchema(rawGroupSchema),
  review: reviewContextSchema,
});

export function readBuildInput(path) {
  return readStrictJSON(path, buildInputSchema, 'input');
}

export function buildPayload(input) {
  const title = trim(input.title);
  if (title === '') {
    throw new Error('title is required');
  }

  const payload = {
    version: 1,
    title,
    subtitle: trim(input.subtitle),
    eyebrow: trim(input.eyebrow),
    submit_label: trim(input.submit_label),
    cancel_label: trim(input.cancel_label),
    summary_md: trim(input.summary_md),
    groups: [],
  };

  const triage = {
    version: 1,
    review: normalizeReview(input.review),
    groups: [],
    threads: [],
  };

  const seenGroupKeys = new Map();
  const seenIssueKeys = new Map();
  const seenFieldNames = new Map();

  for (const [index, group] of (input.groups ?? []).entries()) {
    const normalized = normalizeGroup(group);
    if (normalized.promptGroup.threads.length === 0) {
      continue;
    }

    const groupOwner = `group[${index}]`;
    claimUnique(seenGroupKeys, normalized.triageGroup.group_key, groupOwner, 'group key');
    claimUnique(seenFieldNames, normalized.triageGroup.hide_field, `${groupOwner} hide field`, 'field name');

    for (const [threadIndex, triageThread] of normalized.triageThreads.entries()) {
      const threadOwner = `${groupOwner} thread[${threadIndex}]`;
      claimUnique(seenIssueKeys, triageThread.issue_key, threadOwner, 'thread key');
      claimUnique(seenFieldNames, triageThread.instruction_field, `${threadOwner} instruction field`, 'field name');
      claimUnique(seenFieldNames, triageThread.auto_resolve_field, `${threadOwner} auto-resolve field`, 'field name');
    }

    payload.groups.push(normalized.promptGroup);
    triage.groups.push(normalized.triageGroup);
    triage.threads.push(...normalized.triageThreads);
  }

  if (payload.groups.length === 0) {
    throw new Error('at least one group with one thread is required');
  }

  triage.threads.sort((left, right) => left.issue_key.localeCompare(right.issue_key));

  return {
    payload,
    triage_map: triage,
  };
}

function normalizeReview(input) {
  const review = {
    owner: trim(input?.owner),
    repo: trim(input?.repo),
    pr_number: Number.isInteger(input?.pr_number) ? input.pr_number : 0,
    url: trim(input?.url),
    title: trim(input?.title),
    author: trim(input?.author),
    base_branch: trim(input?.base_branch),
    head_branch: trim(input?.head_branch),
  };

  const missing = [];
  for (const field of ['owner', 'repo', 'url', 'title', 'author', 'base_branch', 'head_branch']) {
    if (review[field] === '') {
      missing.push(field);
    }
  }
  if (review.pr_number <= 0) {
    missing.push('pr_number');
  }
  if (missing.length > 0) {
    throw new Error(`review is missing required field(s): ${missing.join(', ')}`);
  }

  return review;
}

function normalizeGroup(input) {
  let groupKey = trim(input.group_key);
  if (groupKey === '') {
    groupKey = hashKey('group', trim(input.title_md), trim(input.title), firstThreadKey(input.threads ?? []));
  }

  let hideField = trim(input.hide_field);
  if (hideField === '') {
    hideField = `g_${groupKey}_hide`;
  }

  const hideLabel = firstNonEmpty(trim(input.hide_label), 'Hide this review group on PR page');
  const hideValue = input.hide_value === true;

  const promptGroup = {
    title_md: trim(input.title_md),
    title: trim(input.title),
    hide_field: hideField,
    hide_label: hideLabel,
    hide_value: hideValue,
    threads: [],
  };

  const triageGroup = {
    group_key: groupKey,
    title_md: promptGroup.title_md,
    title: promptGroup.title,
    reviewer: trim(input.reviewer),
    review_time: trim(input.review_time),
    hide_field: hideField,
    hide_label: hideLabel,
    comment_node_ids: normalizeStringArray(input.comment_node_ids),
    thread_keys: [],
  };

  const triageThreads = [];
  for (const thread of input.threads ?? []) {
    const normalized = normalizeThread(groupKey, thread);
    if (normalized.promptThread.instruction_field === '' || normalized.triageThread.issue_key === '') {
      continue;
    }
    promptGroup.threads.push(normalized.promptThread);
    triageGroup.thread_keys.push(normalized.triageThread.issue_key);
    triageThreads.push(normalized.triageThread);
  }

  return { promptGroup, triageGroup, triageThreads };
}

function normalizeThread(groupKey, input) {
  let issueKey = trim(input.issue_key);
  if (issueKey === '') {
    issueKey = hashKey(
      'thread',
      trim(input.thread_graphql_id),
      trim(input.thread_url),
      trim(input.title),
      trim(input.file_path),
    );
  }

  const instructionField = firstNonEmpty(trim(input.instruction_field), `t_${issueKey}_instruction`);
  const autoResolveField = firstNonEmpty(trim(input.auto_resolve_field), `t_${issueKey}_auto_resolve`);
  const instructionLabel = firstNonEmpty(trim(input.instruction_label), 'How to handle');
  const autoResolveLabel = firstNonEmpty(trim(input.auto_resolve_label), 'Auto comment+resolve');
  const instructionRows = Number.isInteger(input.instruction_rows) && input.instruction_rows > 0 ? input.instruction_rows : 4;
  const showOriginal = trim(input.original_comment) !== '' && input.show_original === true;
  const showDiffHunk = trim(input.diff_hunk) !== '' && input.show_diff_hunk === true;
  const autoResolveValue = input.auto_resolve_value === true;
  const line = normalizeLine(input.line);

  const codeContextTitle = firstNonEmpty(trim(input.code_context_title), trim(input.code_context) !== '' ? 'Code Context' : '');
  const diffHunkTitle = firstNonEmpty(trim(input.diff_hunk_title), trim(input.diff_hunk) !== '' ? 'Diff Hunk' : '');
  const suggestionTitle = firstNonEmpty(trim(input.suggestion_title), trim(input.suggestion_md) !== '' ? 'Suggestion' : '');

  const promptThread = {
    title: trim(input.title),
    reviewer: trim(input.reviewer),
    file_path: trim(input.file_path),
    line,
    thread_url: trim(input.thread_url),
    is_outdated: input.is_outdated === true,
    translated_comment: trim(input.translated_comment),
    original_comment: trim(input.original_comment),
    show_original: showOriginal,
    original_comment_title: trim(input.original_comment_title),
    code_context_title: codeContextTitle,
    code_context_lang: trim(input.code_context_lang),
    code_context: valueOrEmpty(input.code_context),
    diff_hunk_title: diffHunkTitle,
    diff_hunk_lang: trim(input.diff_hunk_lang),
    diff_hunk: valueOrEmpty(input.diff_hunk),
    show_diff_hunk: showDiffHunk,
    suggestion_title: suggestionTitle,
    suggestion_md: trim(input.suggestion_md),
    instruction_field: instructionField,
    instruction_label: instructionLabel,
    instruction_rows: instructionRows,
    instruction_placeholder: trim(input.instruction_placeholder),
    instruction_value: valueOrEmpty(input.instruction_value),
    auto_resolve_field: autoResolveField,
    auto_resolve_label: autoResolveLabel,
    auto_resolve_value: autoResolveValue,
  };

  const triageThread = {
    issue_key: issueKey,
    group_key: groupKey,
    thread_graphql_id: trim(input.thread_graphql_id),
    comment_node_ids: normalizeStringArray(input.comment_node_ids),
    reviewer: promptThread.reviewer,
    file_path: promptThread.file_path,
    line,
    thread_url: promptThread.thread_url,
    is_outdated: input.is_outdated === true,
    problem_statement: trim(input.problem_statement),
    top_comment: trim(input.top_comment),
    replies_summary: trim(input.replies_summary),
    instruction_field: instructionField,
    instruction_label: instructionLabel,
    instruction_value: valueOrEmpty(input.instruction_value),
    auto_resolve_field: autoResolveField,
    auto_resolve_label: autoResolveLabel,
    auto_resolve_value: autoResolveValue,
  };

  return { promptThread, triageThread };
}

function firstThreadKey(threads) {
  for (const thread of threads) {
    if (trim(thread.issue_key) !== '') {
      return trim(thread.issue_key);
    }
    if (trim(thread.thread_graphql_id) !== '') {
      return trim(thread.thread_graphql_id);
    }
  }
  return '';
}

function hashKey(prefix, ...values) {
  return `${prefix}_${sha1Prefix(values.join('|'))}`;
}

function normalizeLine(value) {
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function normalizeStringArray(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return undefined;
  }
  const out = values.map((value) => trim(value)).filter(Boolean);
  return out.length > 0 ? out : undefined;
}

function claimUnique(seen, key, owner, kind) {
  const trimmed = trim(key);
  if (trimmed === '') {
    return;
  }
  if (seen.has(trimmed)) {
    throw new Error(`duplicate ${kind} "${trimmed}" (${owner} conflicts with ${seen.get(trimmed)})`);
  }
  seen.set(trimmed, owner);
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
  }
  return '';
}

function trim(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function valueOrEmpty(value) {
  return typeof value === 'string' ? value : '';
}

function usage() {
  return `Usage: pr-author/respond/scripts/build-payload.mjs --input <raw-input.json> [options]

Options:
  --input <path>           Raw build input JSON for pr-author respond
  --payload-out <path>     Write normalized prompt payload JSON
  --triage-map-out <path>  Write triage map JSON
  --help                   Show this message`;
}

function parseArgs(argv) {
  const args = {
    inputPath: '',
    payloadOut: '',
    triageMapOut: '',
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--input':
        args.inputPath = requireValue(argv, ++index, '--input');
        break;
      case '--payload-out':
        args.payloadOut = requireValue(argv, ++index, '--payload-out');
        break;
      case '--triage-map-out':
        args.triageMapOut = requireValue(argv, ++index, '--triage-map-out');
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }

  return args;
}

function requireValue(argv, index, flag) {
  if (index >= argv.length || argv[index].startsWith('-')) {
    throw new Error(`${flag} requires a value`);
  }
  return argv[index];
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (args.inputPath === '') {
    throw new Error('--input is required');
  }

  const input = readBuildInput(args.inputPath);
  const output = buildPayload(input);

  if (args.payloadOut !== '') {
    writeJSON(args.payloadOut, output.payload);
  }
  if (args.triageMapOut !== '') {
    writeJSON(args.triageMapOut, output.triage_map);
  }
  if (args.payloadOut === '') {
    writeStdout(output.payload);
  }
}

function isMain() {
  if (!process.argv[1]) {
    return false;
  }
  return pathToFileURL(process.argv[1]).href === import.meta.url;
}

if (isMain()) {
  main().catch((error) => {
    process.stderr.write(`build-payload: ${error.message}\n`);
    process.exit(1);
  });
}
