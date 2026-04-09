import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizePromptResult } from './parse-result.mjs';

test('normalizePromptResult builds structured output', () => {
  const result = normalizePromptResult(
    {
      status: 'submitted',
      data: {
        g_group_hide: true,
        't_thread-1_instruction': 'Fix this',
        't_thread-1_auto_resolve': true,
      },
    },
    {
      version: 1,
      groups: [
        {
          group_key: 'group',
          title: 'Reviewer group',
          hide_field: 'g_group_hide',
          hide_label: 'Hide',
          thread_keys: ['thread-1'],
        },
      ],
      threads: [
        {
          issue_key: 'thread-1',
          group_key: 'group',
          thread_graphql_id: 'PRRT_123',
          reviewer: 'alice',
          file_path: 'src/foo.ts',
          line: 12,
          thread_url: 'https://example.com/thread/1',
          problem_statement: 'Missing guard',
          instruction_field: 't_thread-1_instruction',
          auto_resolve_field: 't_thread-1_auto_resolve',
        },
      ],
    },
  );

  assert.equal(result.status, 'submitted');
  assert.equal(result.counts.group_count, 1);
  assert.equal(result.counts.thread_count, 1);
  assert.equal(result.counts.instructed_count, 1);
  assert.equal(result.counts.auto_resolve_count, 1);
  assert.equal(result.groups[0].hide, true);
  assert.equal(result.groups[0].threads[0].instruction, 'Fix this');
});

test('normalizePromptResult rejects unexpected field', () => {
  assert.throws(
    () => normalizePromptResult(
      {
        status: 'submitted',
        data: {
          unexpected: true,
        },
      },
      {
        version: 1,
        groups: [
          { group_key: 'group', hide_field: 'g_group_hide' },
        ],
        threads: [
          {
            issue_key: 'thread-1',
            group_key: 'group',
            instruction_field: 't_thread-1_instruction',
            auto_resolve_field: 't_thread-1_auto_resolve',
          },
        ],
      },
    ),
    /unexpected prompt result field/,
  );
});

test('normalizePromptResult rejects duplicate field specs', () => {
  assert.throws(
    () => normalizePromptResult(
      {
        status: 'submitted',
        data: {
          shared_instruction: 'Fix this',
          'thread-1_auto': true,
          'thread-2_auto': false,
        },
      },
      {
        version: 1,
        groups: [
          {
            group_key: 'group',
            thread_keys: ['thread-1', 'thread-2'],
          },
        ],
        threads: [
          {
            issue_key: 'thread-1',
            group_key: 'group',
            instruction_field: 'shared_instruction',
            auto_resolve_field: 'thread-1_auto',
          },
          {
            issue_key: 'thread-2',
            group_key: 'group',
            instruction_field: 'shared_instruction',
            auto_resolve_field: 'thread-2_auto',
          },
        ],
      },
    ),
    /duplicate field name "shared_instruction"/,
  );
});

test('normalizePromptResult passes cancelled through', () => {
  const result = normalizePromptResult({ status: 'cancelled' }, { version: 1 });
  assert.equal(result.status, 'cancelled');
});
