#!/usr/bin/env node

import { pathToFileURL } from 'node:url';

import {
  anySchema,
  arraySchema,
  booleanSchema,
  integerSchema,
  objectSchema,
  readStrictJSON,
  recordSchema,
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

const triageGroupSchema = objectSchema({
  group_key: stringSchema,
  title_md: stringSchema,
  title: stringSchema,
  reviewer: stringSchema,
  review_time: stringSchema,
  hide_field: stringSchema,
  hide_label: stringSchema,
  comment_node_ids: arraySchema(stringSchema),
  thread_keys: arraySchema(stringSchema),
});

const triageThreadSchema = objectSchema({
  issue_key: stringSchema,
  group_key: stringSchema,
  thread_graphql_id: stringSchema,
  comment_node_ids: arraySchema(stringSchema),
  reviewer: stringSchema,
  file_path: stringSchema,
  line: integerSchema,
  thread_url: stringSchema,
  is_outdated: booleanSchema,
  problem_statement: stringSchema,
  top_comment: stringSchema,
  replies_summary: stringSchema,
  instruction_field: stringSchema,
  instruction_label: stringSchema,
  instruction_value: stringSchema,
  auto_resolve_field: stringSchema,
  auto_resolve_label: stringSchema,
  auto_resolve_value: booleanSchema,
});

const triageMapSchema = objectSchema({
  version: integerSchema,
  review: reviewContextSchema,
  groups: arraySchema(triageGroupSchema),
  threads: arraySchema(triageThreadSchema),
});

const promptResultSchema = objectSchema({
  status: stringSchema,
  data: recordSchema(anySchema),
});

export function readPromptResult(path) {
  return readStrictJSON(path, promptResultSchema, 'prompt result');
}

export function readTriageMap(path) {
  return readStrictJSON(path, triageMapSchema, 'triage map');
}

export function normalizePromptResult(result, mapping) {
  const output = {
    version: 1,
    status: result.status,
    review: mapping.review,
    counts: {
      group_count: 0,
      thread_count: 0,
      hidden_group_count: 0,
      instructed_count: 0,
      skipped_count: 0,
      auto_resolve_count: 0,
    },
  };

  switch (result.status) {
    case 'cancelled':
    case 'timeout':
    case 'closed':
      return output;
    case 'submitted':
      break;
    default:
      throw new Error(`unsupported prompt status "${result.status}"`);
  }

  const specs = buildFieldSpecs(mapping);
  const values = decodeFieldValues(result.data ?? {}, specs);

  const threadByKey = new Map();
  for (const thread of mapping.threads ?? []) {
    if (threadByKey.has(thread.issue_key)) {
      throw new Error(`duplicate thread key "${thread.issue_key}" in triage map`);
    }
    threadByKey.set(thread.issue_key, thread);
  }

  output.groups = [];
  for (const group of mapping.groups ?? []) {
    const hide = Boolean(values[group.hide_field]?.bool);
    const normalizedGroup = {
      group_key: group.group_key,
      title_md: group.title_md,
      title: group.title,
      reviewer: group.reviewer,
      review_time: group.review_time,
      hide,
      hide_label: group.hide_label,
      comment_node_ids: group.comment_node_ids,
      threads: [],
    };

    if (hide) {
      output.counts.hidden_group_count += 1;
    }

    for (const issueKey of group.thread_keys ?? []) {
      const thread = threadByKey.get(issueKey);
      if (!thread) {
        throw new Error(`triage map missing thread "${issueKey}" referenced by group "${group.group_key}"`);
      }

      const instruction = values[thread.instruction_field];
      if (!instruction) {
        throw new Error(`missing instruction field "${thread.instruction_field}"`);
      }
      const autoResolve = values[thread.auto_resolve_field];
      if (!autoResolve) {
        throw new Error(`missing auto-resolve field "${thread.auto_resolve_field}"`);
      }

      const trimmedInstruction = instruction.string.trim();
      const skipped = trimmedInstruction === '';
      if (skipped) {
        output.counts.skipped_count += 1;
      } else {
        output.counts.instructed_count += 1;
      }
      if (autoResolve.bool) {
        output.counts.auto_resolve_count += 1;
      }
      output.counts.thread_count += 1;

      normalizedGroup.threads.push({
        issue_key: thread.issue_key,
        group_key: thread.group_key,
        thread_graphql_id: thread.thread_graphql_id,
        comment_node_ids: thread.comment_node_ids,
        reviewer: thread.reviewer,
        file_path: thread.file_path,
        line: thread.line,
        thread_url: thread.thread_url,
        is_outdated: thread.is_outdated,
        problem_statement: thread.problem_statement,
        top_comment: thread.top_comment,
        replies_summary: thread.replies_summary,
        instruction: trimmedInstruction,
        auto_resolve: autoResolve.bool,
        skipped,
      });
    }

    output.groups.push(normalizedGroup);
  }

  output.counts.group_count = output.groups.length;
  return output;
}

function buildFieldSpecs(mapping) {
  const specs = {};
  const seenGroups = new Set();
  const seenThreadRefs = new Map();

  for (const group of mapping.groups ?? []) {
    if (trim(group.group_key) === '') {
      throw new Error('triage map group is missing group_key');
    }
    if (seenGroups.has(group.group_key)) {
      throw new Error(`duplicate group key "${group.group_key}" in triage map`);
    }
    seenGroups.add(group.group_key);

    if (trim(group.hide_field) !== '') {
      claimFieldSpec(specs, group.hide_field, { kind: 'bool', key: group.group_key });
    }

    for (const threadKey of group.thread_keys ?? []) {
      if (trim(threadKey) === '') {
        throw new Error(`group "${group.group_key}" contains an empty thread key`);
      }
      if (seenThreadRefs.has(threadKey)) {
        throw new Error(`thread key "${threadKey}" is referenced by multiple groups (${seenThreadRefs.get(threadKey)} and ${group.group_key})`);
      }
      seenThreadRefs.set(threadKey, group.group_key);
    }
  }

  const seenThreads = new Set();
  for (const thread of mapping.threads ?? []) {
    if (trim(thread.issue_key) === '') {
      throw new Error('triage map thread is missing issue_key');
    }
    if (seenThreads.has(thread.issue_key)) {
      throw new Error(`duplicate thread key "${thread.issue_key}" in triage map`);
    }
    seenThreads.add(thread.issue_key);
    claimFieldSpec(specs, thread.instruction_field, { kind: 'string', key: thread.issue_key });
    claimFieldSpec(specs, thread.auto_resolve_field, { kind: 'bool', key: thread.issue_key });
  }

  return specs;
}

function claimFieldSpec(specs, fieldName, spec) {
  const trimmedName = trim(fieldName);
  if (trimmedName === '') {
    throw new Error('triage map contains an empty field name');
  }
  if (Object.prototype.hasOwnProperty.call(specs, trimmedName)) {
    const existing = specs[trimmedName];
    throw new Error(`duplicate field name "${trimmedName}" in triage map (${spec.kind}/${spec.key} conflicts with ${existing.kind}/${existing.key})`);
  }
  specs[trimmedName] = spec;
}

function decodeFieldValues(data, specs) {
  if (Object.keys(specs).length === 0) {
    throw new Error('triage map does not define any prompt fields');
  }
  if (!isPlainObject(data) || Object.keys(data).length === 0) {
    throw new Error('prompt result does not contain any field data');
  }

  const values = {};
  for (const [fieldName, raw] of Object.entries(data)) {
    const spec = specs[fieldName];
    if (!spec) {
      throw new Error(`unexpected prompt result field "${fieldName}"`);
    }
    switch (spec.kind) {
      case 'bool':
        if (typeof raw !== 'boolean') {
          throw new Error(`field "${fieldName}" should be boolean`);
        }
        values[fieldName] = { bool: raw };
        break;
      case 'string':
        if (typeof raw !== 'string') {
          throw new Error(`field "${fieldName}" should be string`);
        }
        values[fieldName] = { string: raw };
        break;
      default:
        throw new Error(`unsupported field kind "${spec.kind}"`);
    }
  }

  const missing = Object.keys(specs).filter((fieldName) => !Object.prototype.hasOwnProperty.call(values, fieldName));
  if (missing.length > 0) {
    missing.sort();
    throw new Error(`prompt result is missing expected fields: ${missing.join(', ')}`);
  }
  return values;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function trim(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function usage() {
  return `Usage: pr-author/respond/scripts/parse-result.mjs --prompt-result <prompt-result.json> --triage-map <triage-map.json> [options]

Options:
  --prompt-result <path>  Path to prompt result JSON
  --triage-map <path>     Path to triage map JSON
  --output <path>         Write normalized triage result JSON
  --help                  Show this message`;
}

function parseArgs(argv) {
  const args = {
    promptResultPath: '',
    triageMapPath: '',
    outputPath: '',
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--prompt-result':
        args.promptResultPath = requireValue(argv, ++index, '--prompt-result');
        break;
      case '--triage-map':
        args.triageMapPath = requireValue(argv, ++index, '--triage-map');
        break;
      case '--output':
        args.outputPath = requireValue(argv, ++index, '--output');
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
  if (args.promptResultPath === '' || args.triageMapPath === '') {
    throw new Error('--prompt-result and --triage-map are required');
  }

  const result = readPromptResult(args.promptResultPath);
  const mapping = readTriageMap(args.triageMapPath);
  const normalized = normalizePromptResult(result, mapping);

  if (args.outputPath !== '') {
    writeJSON(args.outputPath, normalized);
  }
  if (args.outputPath === '') {
    writeStdout(normalized);
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
    process.stderr.write(`parse-result: ${error.message}\n`);
    process.exit(1);
  });
}
