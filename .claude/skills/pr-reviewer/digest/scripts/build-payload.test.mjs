import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  buildOverviewUI,
  buildPayload,
  defaultOverviewUIHeight,
  readBuildInput,
} from './build-payload.mjs';

test('buildPayload normalizes sections and wraps overview UI', () => {
  const output = buildPayload({
    title: 'PR Digest - #42: Improve composer',
    subtitle: 'sendbird/foo',
    pr_summary_md: 'summary',
    overview_md: 'overview',
    overview_ui_html: '```html\n<div class="specimen">Preview</div>\n<script>alert(1)</script>\n```',
    sections: [
      { title: 'Mental Model', markdown: 'how it works' },
      { title: '', markdown: 'skip me' },
    ],
    highlights: [
      { title: 'Important diff', diff: '@@\n- a\n+ b', explanation_md: 'explanation' },
      { title: '', diff: '@@\n- old\n+ new' },
    ],
  });

  assert.ok(output.payload.overview_ui);
  assert.equal(output.payload.overview_ui.kind, 'iframe');
  assert.equal(output.payload.overview_ui.height, defaultOverviewUIHeight);
  assert.equal(output.payload.overview_ui.srcdoc.includes('<script'), false);
  assert.equal(output.payload.overview_ui.srcdoc.includes('<!doctype html>'), true);

  assert.equal(output.payload.sections.length, 1);
  assert.deepEqual(output.payload.sections[0], {
    title: 'Mental Model',
    markdown: 'how it works',
  });
  assert.equal(output.payload.highlights.length, 1);
  assert.equal(output.payload.highlights[0].title, 'Important diff');
  assert.equal(output.payload.submit_label, 'Done');
});

test('buildPayload respects custom submit label', () => {
  const output = buildPayload({
    title: 'PR Digest - #42: Improve composer',
    submit_label: 'Close Digest',
  });

  assert.equal(output.payload.submit_label, 'Close Digest');
});

test('buildPayload requires title', () => {
  assert.throws(() => buildPayload({}), /title is required/);
});

test('buildOverviewUI preserves html documents', () => {
  const doc = '<!DOCTYPE html><html><body><div>ok</div></body></html>';
  const ui = buildOverviewUI(doc, 420);
  assert.ok(ui);
  assert.equal(ui.height, 420);
  assert.equal(ui.srcdoc, doc);
});

test('readBuildInput rejects unknown fields', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pr-reviewer-digest-build-'));
  try {
    const path = join(dir, 'input.json');
    writeFileSync(path, '{"title":"ok","unknown":true}');
    assert.throws(() => readBuildInput(path), /unknown field/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
