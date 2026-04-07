---
name: pr-comment
description: Use when reviewing a PR and the user wants to add, manage, or submit review comments during the conversation
---

# PR Comment

Manage PR review comments through natural conversation and submit them to GitHub.

**Script location:** `.claude/skills/pr-comment/prc.sh`

## Phase 1: Setup

On `/pr-comment` invocation or when the user requests adding a comment during review:

1. Run `prc.sh init` — creates session and auto-syncs any existing pending review from GitHub
2. Show `prc.sh status` to display current state
3. If existing comments were synced, show them before starting

## Phase 2: Interactive Review Loop

### Natural Language → Action

| Intent | Action |
|---|---|
| "let's leave a comment on this", "add a review comment" | `prc.sh add` |
| "fix that one", "add this to it too" | `prc.sh update` |
| "sync comments", "fetch pending review" | `prc.sh sync` |
| "submit as draft", "push draft" | `prc.sh submit --draft` |
| "wrap up the review", "submit" | `prc.sh submit` |
| `/pr-comment` (no action) | `prc.sh status` |

### Key Rules

- **No unprompted comments** — only add when user explicitly requests. Discussion does not equal a comment.
- **Investigate before opining** — read code first, trace the full picture
- **Show tracking table** — after every add/update/delete, run `prc.sh list` to show current state

### add Behavior

1. Infer file/line from the most recently discussed code in conversation
2. For multi-line ranges, use `--start-line` and `--line` to specify the range
3. Summarize the discussion into a review comment — concise suggestion with rationale
4. Show the drafted comment to the user for confirmation
5. After confirmation, run `prc.sh add --file <path> [--start-line <n>] --line <n> --body "<text>"`
6. Run `prc.sh list` after adding

### update Behavior

Not an explicit command. Occurs naturally after `add` when the user says "fix that one", "add more to it", etc.:

1. Identify the target comment and modification intent from conversation context
2. Rewrite the body
3. Run `prc.sh update <id> --body "<text>"` (if pending, GitHub comment is also updated automatically)
4. Run `prc.sh list` after updating

### sync Behavior

Fetches pending review comments from GitHub and upserts into the local session:

1. Find current user's PENDING review on the PR
2. Fetch all comments in that review
3. Upsert by `github_comment_id` — update existing, add new as `pending`
4. Local `draft` comments are preserved untouched

Use when resuming a review started in another session or when GitHub state may have diverged.

## Phase 3: Submission

- `prc.sh submit --draft` — push draft comments to GitHub as a pending review
- `prc.sh submit` — final submission with COMMENT type by default. Override with `--event APPROVE` etc. when user specifies
- On final submit, auto-generate a review summary for `--body`:
  - Group comments by theme/area
  - Note relationships and dependencies between comments
  - Recommend work order if applicable

## Comment Writing Guide

- Write as suggestions ("Consider changing...", "It would be better to...")
- Include rationale from the discussion concisely
- Use markdown code blocks for code suggestions
- Match the language of the conversation (Korean/English)
