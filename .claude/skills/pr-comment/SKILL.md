---
name: pr-comment
description: Use when reviewing a PR and the user wants to add, manage, or submit review comments during the conversation
---

# PR Comment

Manage PR review comments through natural conversation and submit them to GitHub.

## How It Works

When the user expresses intent to leave a review comment during conversation, infer file/line from context, summarize the discussion into a structured comment, and manage it via `prc.sh`.

**Script location:** `.claude/skills/pr-comment/prc.sh`

## Session Start

On `/pr-comment` invocation or when the user requests adding a comment during review, run `prc.sh init` if no active session exists.

## Natural Language → Action

Recognize user intent from natural language and map to the appropriate action:

| Intent | Action |
|---|---|
| "let's leave a comment on this", "add a review comment" | `prc.sh add` |
| "fix that one", "add this to it too" | `prc.sh update` |
| "submit as draft", "push draft" | `prc.sh submit --draft` |
| "wrap up the review", "submit" | `prc.sh submit` |
| `/pr-comment` (no action) | `prc.sh status` |

## add Behavior

1. Infer file/line from the most recently discussed code in conversation
2. Summarize the discussion into a review comment — concise suggestion with rationale
3. Show the drafted comment to the user for confirmation
4. After confirmation, run `prc.sh add --file <path> --line <n> --body "<text>"`

## update Behavior

Not an explicit command. Occurs naturally after `add` when the user says "fix that one", "add more to it", etc.:

1. Identify the target comment and modification intent from conversation context
2. Rewrite the body
3. Run `prc.sh update <id> --body "<text>"` (if pending, GitHub comment is also updated automatically)

## submit Behavior

- `prc.sh submit --draft` — push draft comments to GitHub as a pending review
- `prc.sh submit` — final submission with COMMENT type by default. Override with `--event APPROVE` etc. when user specifies
- On final submit, `--body` is auto-generated as a review summary

## Comment Writing Guide

- Write as suggestions ("Consider changing...", "It would be better to...")
- Include rationale from the discussion concisely
- Use markdown code blocks for code suggestions
- Match the language of the conversation (Korean/English)
