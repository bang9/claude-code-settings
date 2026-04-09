#!/usr/bin/env node

import { pathToFileURL } from 'node:url';

import {
  arraySchema,
  firstNonEmpty,
  integerSchema,
  objectSchema,
  readStrictJSON,
  stringSchema,
  writeJSON,
  writeStdout,
} from './lib/runtime.mjs';

export const defaultOverviewUIHeight = 860;

const codeFencePattern = /^```(?:html)?\s*([\s\S]*?)\s*```$/i;
const scriptTagPattern = /<script\b[^>]*>[\s\S]*?<\/script>/gi;

const sectionSchema = objectSchema({
  title: stringSchema,
  markdown: stringSchema,
});

const highlightSchema = objectSchema({
  title: stringSchema,
  file_label: stringSchema,
  diff: stringSchema,
  explanation_md: stringSchema,
});

const buildInputSchema = objectSchema({
  title: stringSchema,
  subtitle: stringSchema,
  pr_summary_md: stringSchema,
  overview_md: stringSchema,
  overview_ui_html: stringSchema,
  overview_ui_height: integerSchema,
  sections: arraySchema(sectionSchema),
  highlights: arraySchema(highlightSchema),
  submit_label: stringSchema,
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
    pr_summary_md: trim(input.pr_summary_md),
    overview_md: trim(input.overview_md),
    submit_label: firstNonEmpty(trim(input.submit_label), 'Done'),
  };

  const overviewUI = buildOverviewUI(input.overview_ui_html, input.overview_ui_height);
  if (overviewUI) {
    payload.overview_ui = overviewUI;
  }

  const sections = normalizeSections(input.sections ?? []);
  if (sections.length > 0) {
    payload.sections = sections;
  }

  const highlights = normalizeHighlights(input.highlights ?? []);
  if (highlights.length > 0) {
    payload.highlights = highlights;
  }

  return { payload };
}

export function buildOverviewUI(raw, height) {
  let content = trim(raw);
  if (content === '') {
    return null;
  }

  content = stripCodeFence(content);
  content = content.replace(scriptTagPattern, '').trim();
  if (content === '') {
    return null;
  }

  if (!looksLikeHTMLDocument(content)) {
    content = wrapHTMLFragment(content);
  }

  return {
    kind: 'iframe',
    srcdoc: content,
    height: Number.isInteger(height) && height > 0 ? height : defaultOverviewUIHeight,
  };
}

function normalizeSections(input) {
  const out = [];
  for (const section of input) {
    const title = trim(section.title);
    const markdown = trim(section.markdown);
    if (title === '' || markdown === '') {
      continue;
    }
    out.push({ title, markdown });
  }
  return out;
}

function normalizeHighlights(input) {
  const out = [];
  for (const highlight of input) {
    const title = trim(highlight.title);
    const diff = String(highlight.diff ?? '').replace(/\n+$/u, '');
    if (title === '' || diff === '') {
      continue;
    }
    out.push({
      title,
      file_label: trim(highlight.file_label),
      diff,
      explanation_md: trim(highlight.explanation_md),
    });
  }
  return out;
}

function stripCodeFence(value) {
  const match = String(value).trim().match(codeFencePattern);
  return match ? match[1].trim() : value;
}

function looksLikeHTMLDocument(value) {
  const lower = String(value).trim().toLowerCase();
  return lower.startsWith('<!doctype html') || lower.startsWith('<html');
}

function wrapHTMLFragment(fragment) {
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    '  <style>',
    '    :root { color-scheme: light; }',
    '    * { box-sizing: border-box; }',
    '    body { margin: 0; padding: 24px; background: #ffffff; color: #1f2328; }',
    '  </style>',
    '</head>',
    '<body>',
    fragment,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

function trim(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function usage() {
  return `Usage: pr-reviewer/digest/scripts/build-payload.mjs --input <raw-input.json> [options]

Options:
  --input <path>        Raw build input JSON for pr-reviewer digest
  --payload-out <path>  Write normalized prompt payload JSON
  --help                Show this message`;
}

function parseArgs(argv) {
  const args = {
    inputPath: '',
    payloadOut: '',
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
