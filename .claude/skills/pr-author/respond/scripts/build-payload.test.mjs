import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { buildPayload, readBuildInput } from './build-payload.mjs';

test('buildPayload generates stable fields and triage map', () => {
  const output = buildPayload({
    title: 'PR Follow-up - #42: Example',
    subtitle: 'sendbird/foo',
    eyebrow: 'PR Follow-up',
    summary_md: 'summary',
    review: {
      owner: 'sendbird',
      repo: 'foo',
      pr_number: 42,
      url: 'https://github.com/sendbird/foo/pull/42',
      title: 'Example',
      author: 'airen',
      base_branch: 'main',
      head_branch: 'feature/example',
    },
    groups: [
      {
        title: 'Reviewer group',
        hide_value: true,
        threads: [
          {
            issue_key: 'thread-1',
            thread_graphql_id: 'PRRT_123',
            title: 'Null guard',
            reviewer: 'alice',
            file_path: 'src/foo.ts',
            line: 12,
            thread_url: 'https://example.com/thread/1',
            translated_comment: 'Please handle empty input.',
            code_context_lang: 'ts',
            code_context: 'if (!input) return;',
            problem_statement: 'Missing null guard.',
            instruction_value: 'Fix it',
            auto_resolve_value: true,
            comment_node_ids: ['MDU6SXNzdWUx'],
          },
        ],
      },
    ],
  });

  assert.equal(output.payload.groups.length, 1);
  const group = output.payload.groups[0];
  assert.notEqual(group.hide_field, '');
  assert.equal(group.threads.length, 1);
  const thread = group.threads[0];
  assert.notEqual(thread.instruction_field, '');
  assert.notEqual(thread.auto_resolve_field, '');
  assert.equal(thread.instruction_rows, 4);

  assert.equal(output.triage_map.groups.length, 1);
  assert.equal(output.triage_map.threads.length, 1);
  assert.equal(output.triage_map.threads[0].instruction_field, thread.instruction_field);
  assert.equal(output.triage_map.threads[0].auto_resolve_field, thread.auto_resolve_field);
});

test('buildPayload requires threads', () => {
  assert.throws(
    () => buildPayload({
      title: 'ok',
      review: {
        owner: 'sendbird',
        repo: 'foo',
        pr_number: 42,
        url: 'https://github.com/sendbird/foo/pull/42',
        title: 'Example',
        author: 'airen',
        base_branch: 'main',
        head_branch: 'feature/example',
      },
    }),
    /at least one group with one thread is required/,
  );
});

test('buildPayload requires review context', () => {
  assert.throws(
    () => buildPayload({
      title: 'PR Follow-up - #42: Example',
      groups: [
        {
          threads: [
            {
              issue_key: 'thread-1',
              translated_comment: 'Please handle empty input.',
              code_context_lang: 'ts',
              code_context: 'if (!input) return;',
            },
          ],
        },
      ],
    }),
    /review is missing required field\(s\): owner, repo, url, title, author, base_branch, head_branch, pr_number/,
  );
});

test('buildPayload rejects duplicate field names', () => {
  assert.throws(
    () => buildPayload({
      title: 'PR Follow-up - #42: Example',
      review: {
        owner: 'sendbird',
        repo: 'foo',
        pr_number: 42,
        url: 'https://github.com/sendbird/foo/pull/42',
        title: 'Example',
        author: 'airen',
        base_branch: 'main',
        head_branch: 'feature/example',
      },
      groups: [
        {
          title: 'Reviewer group',
          threads: [
            {
              issue_key: 'thread-1',
              instruction_field: 'shared_instruction',
              auto_resolve_field: 'thread-1_auto',
              translated_comment: 'Please handle empty input.',
              code_context_lang: 'ts',
              code_context: 'if (!input) return;',
            },
            {
              issue_key: 'thread-2',
              instruction_field: 'shared_instruction',
              auto_resolve_field: 'thread-2_auto',
              translated_comment: 'Please handle undefined input.',
              code_context_lang: 'ts',
              code_context: 'if (!value) return;',
            },
          ],
        },
      ],
    }),
    /duplicate field name "shared_instruction"/,
  );
});

test('readBuildInput rejects unknown fields', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pr-author-respond-build-'));
  try {
    const path = join(dir, 'input.json');
    writeFileSync(path, '{"title":"ok","groups":[],"unknown":true}');
    assert.throws(() => readBuildInput(path), /unknown field/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
