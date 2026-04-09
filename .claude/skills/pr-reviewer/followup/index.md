# PR Reviewer — Follow-up

Verify that the PR author's changes address your review feedback. Check each unresolved thread against the actual code changes, confirm correctness, check for side effects, and resolve verified threads.

This is a verification phase — no new review comments. If new issues are found, flag them for the operator.

## Execution Checklist

- [ ] **0** Branch synced with remote
- [ ] **1.1** PR metadata collected
- [ ] **1.2** Unresolved threads fetched; zero → exit
- [ ] **1.3** Review-since diff collected locally (`git diff <review-sha>..HEAD`)
- [ ] **2** Each thread verified: request understood → fix confirmed → side effects checked → verdict assigned
- [ ] **3** Verification report presented; operator confirms actions
- [ ] **3** Resolved threads processed; flagged items handled per operator decision

## Phase 0: Branch Sync

```bash
git fetch origin
```

Compare local and remote:

```bash
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/<head_branch>)
```

If `LOCAL != REMOTE`:
> "Remote has new commits. Pull now?"
- yes → `git pull --ff-only` (if ff fails, stop and ask for manual resolution)
- no → proceed with local state (show warning)

## Phase 1: Context Collection

### 1.1 PR Metadata

```bash
gh pr view --json number,title,author,baseRefName,headRefName,url
```

No PR → stop. Store: `pr_number`, `title`, `author`, `base_branch`, `head_branch`, `url`, `owner`, `repo`.

For org repos, respect CLAUDE.md GH_TOKEN override guidance.

### 1.2 Unresolved Thread Collection

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

Loop until `reviewThreads.pageInfo.hasNextPage` is false so large PRs do not silently drop unresolved threads. Collect unresolved thread IDs first, then fetch the full comment history for each thread in a second paginated query:

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

Loop until `comments.pageInfo.hasNextPage` is false for each thread, then normalize each thread into issue records.

Zero threads → "All threads resolved. Nothing to verify." Exit.

### 1.3 Diff Collection (local)

Find the commit SHA at the time of your last review:

```bash
gh pr view <number> --json reviews \
  --jq '[.reviews[] | select(.author.login=="<self>")] | last | .commit.oid'
```

This gives `REVIEW_SHA` — the commit the PR was at when you last reviewed.

Collect diffs locally:

| Diff | Command | Purpose |
|------|---------|---------|
| **Review-since** | `git diff <REVIEW_SHA>..HEAD` | What the author changed after your review |
| **Full PR** | `git diff <base>...HEAD` | Complete PR context for side-effect analysis |
| **Test changes** | `git diff <REVIEW_SHA>..HEAD -- '*_test.*' '*.test.*' '*_spec.*'` | Test coverage of fixes |

**Fallback**: If `REVIEW_SHA` not found (e.g., first follow-up), use `git diff <base>...HEAD` as review-since diff with a warning that all PR changes will be checked.

## Phase 2: Per-Thread Verification

Process threads in file-path → line-number order (same-file threads stay together for context continuity).

For each unresolved thread:

### Step 1: Understand the request

- Read the full comment + reply chain
- Summarize reviewer's core request in one sentence (`request_summary`)
- Classify request type:

| Type | Description |
|------|-------------|
| **code-change** | Code modification requested (bug fix, refactor, logic change) |
| **question** | Question — answerable by author reply without code change |
| **nit** | Minor style/naming — just check if addressed |
| **design** | Design direction — may have broad scope |

### Step 2: Verify the fix

Search the review-since diff for changes related to this thread:

1. **Direct match**: Changes at the commented file:line or surrounding lines
2. **Indirect match**: No change at exact location, but related function/module was modified (fix may correctly live elsewhere)
3. **No match**: No relevant changes in the diff

For matches — compare the actual change with the reviewer's request:

| Verdict | Meaning |
|---------|---------|
| **addressed** | Request fully reflected in code |
| **partially** | Some aspects addressed, others missing or different approach |
| **unaddressed** | No relevant change, or change doesn't match |
| **replied** | No code change; author replied with explanation (question type) |

### Step 3: Check side effects

For `addressed` or `partially` verdicts:

1. **Caller trace**: `Grep` for callers of changed functions/methods. If signature changed, confirm all call sites updated
2. **Type/interface consistency**: If interfaces modified, check all implementations
3. **Test coverage**: Review-since test diff — are changed paths covered? Existing tests still correct?
4. **Cross-platform**: If react/rn symmetric structure exists, check counterpart

| Verdict | Meaning |
|---------|---------|
| **clean** | No side effects found |
| **concern** | Potential issue — record location and description |

### Step 4: Assign verdict

| Fix Status | Side Effects | Action |
|---|---|---|
| addressed | clean | **resolve** |
| addressed | concern | **flag** — report concern, hold resolve |
| partially | clean | **flag** — note what's missing |
| partially | concern | **flag** — both issues |
| unaddressed | — | **flag** — not addressed |
| replied | — | **judge** — evaluate if reply is sufficient |

## Phase 3: Report & Action

### 3.1 Verification Report

```
## Verification Report — PR #<number>

Threads verified: N
  Resolved: X
  Flagged: Y (needs attention)
  Pending: Z (reply-only, your decision)

### Resolved
| # | File:Line | Request | Verdict |
|---|-----------|---------|---------|
| 1 | auth.go:42 | null guard 추가 | addressed, clean |

### Flagged
| # | File:Line | Request | Issue |
|---|-----------|---------|-------|
| 2 | queue.go:88 | retry 로직 수정 | partially — backoff 미반영 |
| 6 | api.go:120 | 타입 변경 | addressed, but caller client.go:55 미수정 |

### Pending Decision
| # | File:Line | Request | Author Reply |
|---|-----------|---------|--------------|
| 7 | config.go:30 | 왜 default 10인지? | "벤치마크 기반 결정" |
```

### 3.2 Operator Actions

**Resolved threads**: Resolve via GraphQL (parallel):

```bash
gh api graphql -f query='
  mutation($threadId: ID!) {
    resolveReviewThread(input: {threadId: $threadId}) {
      thread { isResolved }
    }
  }
' -f threadId='<id>'
```

**Flagged threads**: Operator decides per thread:
- "resolve anyway" → resolve
- "leave a comment" → post reply via GraphQL, keep unresolved
- "leave open" → no action

**Pending threads** (reply-only): Operator judges sufficiency:
- "sufficient" → resolve
- "need more info" → post follow-up question

All resolve/reply mutations dispatched in parallel where independent.

## Edge Cases

- **No PR**: Stop with message
- **No unresolved threads**: "All clear" and exit
- **REVIEW_SHA not found**: Fall back to `git diff <base>...HEAD` with warning
- **Outdated threads**: Include but badge as outdated. If code moved past the reviewed line and concern no longer applies, auto-resolve
- **Permission errors**: Respect CLAUDE.md GH_TOKEN override
- **Author replied but also changed code**: Treat as code-change — verify the code
