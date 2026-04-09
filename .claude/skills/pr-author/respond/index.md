# PR Author — Respond

Handle review feedback on your own PR: triage unresolved threads, dispatch fixes, verify the result, and request re-review.

## Anti-patterns

- Render the triage form as terminal markdown — use `scripts/run.sh`
- Describe intended fixes in terminal text — dispatch via SubAgent
- Act on a discuss item before the operator gives a concrete decision
- Dispatch to Phase 6 without operator confirming the execution preview
- Skip self-check and auto-resolve without verifying the fix

## Execution Checklist

- [ ] **1** PR discovered — `pr_number`, `title`, `author`, `base_branch`, `head_branch`, `url`, `owner`, `repo` stored
- [ ] **2** unresolved threads fetched via GraphQL, normalized into issue records; zero threads → exit
- [ ] **3** summary presented to operator: thread count, outdated count, per-thread table
- [ ] **3** code context + AI analysis fetched for each thread
- [ ] **4** JSON input assembled → `scripts/run.sh` launched — do NOT render triage form as terminal markdown
- [ ] **4** prompt result parsed — continue only when `status: "submitted"`
- [ ] **5** each thread instruction classified: skip / discuss / reply-only / fix / clarify
- [ ] **5** discuss items: back-and-forth until concrete decision reached
- [ ] **5** reply-only items: posted via GraphQL (parallel); auto-resolved if flagged
- [ ] **5** fix tasks grouped by file independence; stale check #1 complete
- [ ] **5** execution preview presented and operator confirmed
- [ ] **6** fix tasks dispatched via SubAgent (parallel for independent tasks)
- [ ] **7** self-check: each fix verified against reviewer's original intent
- [ ] **7** auto-resolve for verified threads; flag mismatches
- [ ] **7** re-review requested if operator confirms

## Prompt UI Theme

All prompt UI output for this skill MUST use a light theme unless the operator explicitly asks otherwise.

## Phase 1: PR Discovery

```bash
gh pr view --json number,title,author,baseRefName,headRefName,url
```

No PR → stop: "No open PR found for the current branch."

Store: `pr_number`, `title`, `author`, `base_branch`, `head_branch`, `url`. Extract `owner` and `repo` from URL.

For org repos, respect CLAUDE.md GH_TOKEN override guidance.

## Phase 2: Unresolved Thread Collection

Fetch review threads via GraphQL:

```bash
gh api graphql -f query='
  query($owner: String!, $repo: String!, $pr: Int!, $threadsAfter: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $pr) {
        id
        reviewThreads(first: 100, after: $threadsAfter) {
          nodes {
            id
            isResolved
            isOutdated
            path
            line
            originalLine
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }
' -f owner='OWNER' -f repo='REPO' -F pr=PR_NUMBER -F threadsAfter=null
```

Loop until `reviewThreads.pageInfo.hasNextPage` is false so large PRs do not silently drop threads. Collect unresolved thread IDs first, then fetch the full comment history for each unresolved thread in a second paginated query:

```bash
gh api graphql -f query='
  query($threadId: ID!, $commentsAfter: String) {
    node(id: $threadId) {
      ... on PullRequestReviewThread {
        comments(first: 100, after: $commentsAfter) {
          nodes {
            id
            author { login }
            body
            createdAt
            updatedAt
            url
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }
' -f threadId='THREAD_ID' -F commentsAfter=null
```

Loop until `comments.pageInfo.hasNextPage` is false for each thread, then normalize:

| Field | Source |
|-------|--------|
| `issue_key` | `thread-{id}` |
| `reviewer` | First comment author |
| `file_path` | Thread path |
| `line` | Thread line or originalLine |
| `thread_url` | First comment URL |
| `comment_node_ids` | All comment IDs |
| `is_outdated` | Thread isOutdated |
| `top_comment` | First comment body |
| `replies_summary` | Last 2-3 replies condensed |
| `problem_statement` | 1-2 line summary of what the reviewer is asking |

Zero threads → "All review threads are resolved. Nothing to follow up on." Exit.

## Phase 3: Analysis & Summary

Present summary:

```
## PR #<number>: <title>

Unresolved threads: N
Outdated threads: N (included but flagged)

| # | Reviewer | File:Line | Summary | Severity |
|---|----------|-----------|---------|----------|
| 1 | @alice   | auth.go:42 | null guard 누락 | P1 |
```

### Context enrichment

For each thread:
1. **Code context**: Build a snippet around the commented line from the current file content
2. **AI analysis**: Brief analysis — what the reviewer wants, pros/cons, suggested action

## Phase 4: Interactive Triage

Generate JSON input from normalized issues. Use the skill-local prompt infrastructure:

```bash
./scripts/run.sh --input <raw-followup-input.json>
```

`run.sh` performs the prompt-stage plumbing:
- runs `node scripts/build-payload.mjs`
- validates and normalizes the prompt payload
- emits a stable triage-map keyed by generated field names
- launches `prompt.mjs --entry web/app.mjs` (local HTTP server + browser form)
- runs `node scripts/parse-result.mjs`
- prints a normalized triage result JSON to stdout

### Review group structure

GitHub review comments are submitted in groups. Preserve that structure:
- Each review submission → one visual group with reviewer name and timestamp
- Each group carries a stable `hide_field` key for "Hide this review group on PR page" checkbox
- Each unresolved thread → one card within the group
- Threads without a parent review form their own one-thread group

### Raw Builder Input Structure

```json
{
  "title": "PR Follow-up - #<pr_number>: <title>",
  "subtitle": "<owner>/<repo>",
  "summary_md": "...",
  "groups": [
    {
      "title_md": "### Reviewer A",
      "hide_field": "g_group_a_hide",
      "hide_label": "Hide this review group on PR page",
      "hide_value": false,
      "threads": [
        {
          "title": "Null guard",
          "reviewer": "alice",
          "file_path": "src/foo.ts",
          "line": 42,
          "thread_url": "https://github.com/...",
          "translated_comment": "...",
          "code_context_title": "Code Context",
          "code_context_lang": "ts",
          "code_context": "...",
          "suggestion_title": "Suggestion",
          "suggestion_md": "...",
          "instruction_field": "t_thread_1_instruction",
          "instruction_label": "How to handle",
          "instruction_placeholder": "fix / reply / skip",
          "auto_resolve_field": "t_thread_1_auto_resolve",
          "auto_resolve_label": "Auto comment+resolve",
          "auto_resolve_value": false
        }
      ]
    }
  ],
  "review": {
    "owner": "...", "repo": "...", "pr_number": 123,
    "url": "...", "title": "...", "author": "...",
    "base_branch": "...", "head_branch": "..."
  }
}
```

### Context rendering rules

**Always visible:**
1. Outdated badge if applicable
2. Metadata line: `@reviewer · file:line · [thread](url)`
3. Translated comment (operator's language)
4. Code context snippet

**Expandable:**
5. Original comment (when translation may be ambiguous)
6. AI Suggestion with pros/cons

### Group-level hide behavior

After all thread-level actions complete:
1. Re-fetch all threads in the group. Count resolved.
2. All resolved → minimize all comments in parallel via `minimizeComment` mutation
3. Any unresolved → skip, notify operator

Parse result:
- `status: "submitted"` → continue to Phase 5
- `status: "cancelled"` / `"timeout"` / `"closed"` → exit

## Phase 5: Plan Generation

### Classify instructions

| Pattern | Action |
|---------|--------|
| Empty / blank | **Skip** |
| Proposal / question ("how about...", "이렇게는 어떰?") | **Discuss** — not a final instruction |
| Explanatory ("this is intentional because...") | **Reply-only** — post as comment |
| Code-change verbs ("fix", "refactor", "add", "remove") | **Fix task** — dispatch via SubAgent |
| Ambiguous | **Clarify** — ask operator |

### Handle discuss items

Engage in back-and-forth until the operator reaches a concrete decision. Never act on a discuss item directly.

### Handle reply-only items

Post directly via GraphQL. Dispatch all in parallel:

1. Re-fetch thread status (skip already-resolved)
2. Post all comments in parallel
3. Resolve all auto-resolve threads in parallel

```bash
# Comment on thread
gh api graphql -f query='
  mutation($body: String!, $threadId: ID!) {
    addPullRequestReviewThreadReply(input: {body: $body, pullRequestReviewThreadId: $threadId}) {
      comment { id }
    }
  }
' -f body='<text>' -f threadId='<id>'

# Resolve thread
gh api graphql -f query='
  mutation($threadId: ID!) {
    resolveReviewThread(input: {threadId: $threadId}) {
      thread { isResolved }
    }
  }
' -f threadId='<id>'
```

### Group fix tasks

- Same file or tightly related files → one task
- Independent files → separate tasks (parallel)
- Never split coupled issues

Each task carries: `title`, `source_threads`, `instruction`, `affected_files`, `auto_resolve`.

### Stale check #1

Re-fetch thread status before showing execution preview. Drop resolved threads. Remove tasks that lost all source threads.

### Execution preview

```
## Execution Preview

| Task | Issues | Files | Type | Difficulty | Action |
|------|--------|-------|------|------------|--------|
| <title> | #1, #2 | auth.go | coding | medium | fix |

Code fix tasks: N
Reply-only items: M (already handled)
Skipped: K
```

Operator must confirm before dispatch.

## Phase 6: Dispatch

### Spawn fix tasks via SubAgent

For each fix task, spawn a SubAgent using the Agent tool. For 2+ independent tasks, spawn all in a single message (parallel SubAgents).

Each SubAgent prompt must be self-contained:

```
## Context
PR #<number> (<title>) received review feedback.

Source threads:
- thread-<id>: @<reviewer> on <file>:<line> — "<problem_statement>"

## Objective
<operator's verbatim instruction>

## Scope
- In: <affected_files>
- Out: everything else

## Acceptance Criteria
- Code changes address the reviewer's concern(s)
- Existing tests pass
- Changes are committed to the current branch
```

SubAgent has zero context from the current conversation — include explicit file paths, the exact reviewer comment, and all relevant context in the prompt.

## Phase 7: Self-Check & Completion

After each fix task completes:

### 7.1 Self-check

For each source thread in the completed task:

1. **Collect the fix**: `git diff <pre-fix-commit>..HEAD -- <affected_files>`
2. **Compare with reviewer intent**: Read the original reviewer comment and the fix diff side-by-side
3. **Verify alignment**:
   - Does the fix address the core of the reviewer's request?
   - Is the approach consistent with what was discussed in the thread?
   - Are there any obvious oversights?

Verdict per thread:

| Verdict | Meaning |
|---------|---------|
| **verified** | Fix matches reviewer intent |
| **mismatch** | Fix doesn't address the core request or went in a different direction |
| **partial** | Addresses some but not all of the request |

### 7.2 Auto-resolve

For `verified` threads with `auto_resolve=true`:

1. Re-fetch thread status (stale check #2) — skip if already resolved
2. Post comment on all non-stale threads in parallel (e.g., "Fixed in <short-sha>: <brief>"). Use the language the review conversation is in. Use 7-character short SHA.
3. After all comments succeed, resolve all threads in parallel

For `mismatch` or `partial` threads — do NOT auto-resolve. Report to operator:

```
## Self-Check Results

| Thread | Reviewer Request | Verdict | Note |
|--------|-----------------|---------|------|
| #1 auth.go:42 | null guard | verified | — |
| #2 queue.go:88 | retry backoff | partial | backoff 값 미반영 |
```

Operator decides: re-dispatch fix, reply explaining, or manually resolve.

### 7.3 Re-review request

After all threads are processed, if operator wants to request re-review:

```bash
gh pr edit <number> --add-reviewer <reviewer1>,<reviewer2>
```

Only when operator explicitly requests.

## Edge Cases

- **No PR for current branch**: Stop with clear message
- **No unresolved threads**: Report "all clear" and exit
- **Permission/auth errors**: Respect CLAUDE.md GH_TOKEN override
- **Outdated + already fixed + unresolved threads**: Auto-resolve without operator input
- **All issues skipped in triage**: Report "no action taken" and exit
- **Form cancelled or timed out**: Exit
- **Thread resolved between collection and dispatch**: Stale checks drop it
- **Self-check mismatch**: Report to operator, do not auto-resolve
