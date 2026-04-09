import test from 'node:test';
import assert from 'node:assert/strict';

import { buildThreadContextMarkdown } from './form-components.mjs';

test('buildThreadContextMarkdown shows code context as primary and hides diff hunk by default', () => {
  const markdown = buildThreadContextMarkdown({
    reviewer: 'alice',
    file_path: 'src/foo.ts',
    line: 12,
    thread_url: 'https://example.com/thread/1',
    translated_comment: 'Please tighten this validation.',
    code_context_title: 'Code Context',
    code_context_lang: 'ts',
    code_context: 'if (!input.name) {\n  return false;\n}',
    diff_hunk_title: 'Diff Hunk',
    diff_hunk_lang: 'diff',
    diff_hunk: '@@\n- return false\n+ return { ok: false }',
  });

  const codeIndex = markdown.indexOf('Code Context');
  const diffIndex = markdown.indexOf('Diff Hunk');

  assert.notEqual(codeIndex, -1);
  assert.equal(diffIndex, -1);
  assert.ok(markdown.includes('thread-context-primary'));
  assert.ok(markdown.includes('language-ts'));
  assert.ok(!markdown.includes('<details><summary>Code Context</summary>'));
});

test('buildThreadContextMarkdown can opt into diff hunk rendering', () => {
  const markdown = buildThreadContextMarkdown({
    code_context_lang: 'ts',
    code_context: 'const a = 1;',
    diff_hunk_title: 'Diff Hunk',
    diff_hunk_lang: 'diff',
    diff_hunk: '@@\n- a\n+ b',
    show_diff_hunk: true,
  });

  assert.ok(markdown.includes('<details><summary>Diff Hunk</summary>'));
  // details block should be inside thread-context-primary
  const primaryStart = markdown.indexOf('<div class="thread-context-primary">');
  const primaryEnd = markdown.lastIndexOf('</div>');
  const detailsIndex = markdown.indexOf('<details><summary>Diff Hunk</summary>');
  assert.ok(detailsIndex > primaryStart && detailsIndex < primaryEnd);
});

test('buildThreadContextMarkdown escapes reviewer-controlled content', () => {
  const markdown = buildThreadContextMarkdown({
    reviewer: 'alice',
    file_path: 'src/x.ts',
    line: 9,
    thread_url: 'javascript:alert(1)',
    translated_comment: '<img src=x onerror=alert(1)>',
    original_comment: '<script>alert(1)</script>',
    show_original: true,
    code_context_lang: 'ts',
    code_context: 'const msg = ````danger``` `;',
  });

  assert.ok(markdown.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(markdown.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!markdown.includes('[thread](javascript:alert(1))'));
  assert.ok(markdown.includes('````'));
});

test('buildThreadContextMarkdown omits original comment by default but can opt in', () => {
  const hiddenByDefault = buildThreadContextMarkdown({
    translated_comment: 'translated',
    original_comment: 'original',
    code_context_lang: 'ts',
    code_context: 'const a = 1;',
  });

  assert.ok(!hiddenByDefault.includes('<summary>Original</summary>'));

  const shownWhenRequested = buildThreadContextMarkdown({
    translated_comment: 'translated',
    original_comment: 'original',
    show_original: true,
    code_context_lang: 'ts',
    code_context: 'const a = 1;',
  });

  assert.ok(shownWhenRequested.includes('<summary>Original</summary>'));
  // original details should be inside thread-context-primary
  const primaryStart = shownWhenRequested.indexOf('<div class="thread-context-primary">');
  const primaryEnd = shownWhenRequested.lastIndexOf('</div>');
  const detailsIndex = shownWhenRequested.indexOf('<details><summary>Original</summary>');
  assert.ok(detailsIndex > primaryStart && detailsIndex < primaryEnd);
});

test('decodeHTMLEntities prevents double encoding of code_context', () => {
  const markdown = buildThreadContextMarkdown({
    code_context_lang: 'ts',
    code_context: 'a &amp; b &lt; c',
  });

  // Should decode first, then re-encode: &amp; → & → &amp;, &lt; → < → &lt;
  assert.ok(markdown.includes('a &amp; b &lt; c'));
  // Must NOT have double-encoded &amp;amp;
  assert.ok(!markdown.includes('&amp;amp;'));
  assert.ok(!markdown.includes('&amp;lt;'));
});

test('renderMd callback renders comment markdown as HTML', () => {
  const renderMd = (md) => `<p>${md.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>`;

  const markdown = buildThreadContextMarkdown({
    translated_comment: '**bold** text',
    code_context_lang: 'ts',
    code_context: 'const a = 1;',
  }, { renderMd });

  assert.ok(markdown.includes('<strong>bold</strong>'));
  assert.ok(markdown.includes('thread-context-comment'));
});

test('suggestion details block is inside thread-context-primary', () => {
  const markdown = buildThreadContextMarkdown({
    translated_comment: 'Please fix',
    code_context_lang: 'ts',
    code_context: 'const a = 1;',
    suggestion_md: '```suggestion\nconst b = 2;\n```',
    suggestion_title: 'AI Suggestion',
  });

  const primaryStart = markdown.indexOf('<div class="thread-context-primary">');
  const primaryEnd = markdown.lastIndexOf('</div>');
  const suggestionIndex = markdown.indexOf('<details><summary>AI Suggestion</summary>');

  assert.notEqual(primaryStart, -1);
  assert.notEqual(suggestionIndex, -1);
  assert.ok(suggestionIndex > primaryStart && suggestionIndex < primaryEnd);
});

test('renderMd pre-renders suggestion content inside details', () => {
  const renderMd = (md) => `<rendered>${md}</rendered>`;

  const markdown = buildThreadContextMarkdown({
    translated_comment: 'Fix this',
    code_context_lang: 'ts',
    code_context: 'const a = 1;',
    suggestion_md: 'use **b** instead',
    suggestion_title: 'Suggestion',
  }, { renderMd });

  assert.ok(markdown.includes('<details><summary>Suggestion</summary><rendered>use **b** instead</rendered></details>'));
});

test('buildThreadContextMarkdown shows general comment metadata when file path is missing', () => {
  const markdown = buildThreadContextMarkdown({
    reviewer: 'alice',
    thread_url: 'https://example.com/thread/2',
    translated_comment: 'This is a general thread.',
    code_context_lang: 'ts',
    code_context: 'const a = 1;',
  });

  assert.ok(markdown.includes('general comment'));
  assert.ok(markdown.includes('thread'));
});
