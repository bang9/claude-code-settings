---
name: branch
description: Use when the user asks to create, make, or start a new branch (e.g. `/branch`), or wants a conventional-commit-style branch name generated from the current work.
---

# Branch

Create a new branch off the default branch with a conventional-commit-style name, derived from the conversation or uncommitted changes.

## Pre-condition: must be on the default branch

1. Detect the default branch: `git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@'` (fall back to `main`/`master`).
2. Get the current branch: `git branch --show-current`.
3. If not on the default branch, tell the user and stop — never branch off a feature branch.

## Step 1: Analyze work context

- Conversation available → summarize what was worked on (1-2 sentences) and use it as the basis.
- No conversation → inspect `git status --short` and `git diff --stat` (plus `--cached --stat` if staged), then summarize the changes (1-2 sentences).
- Neither → ask the user what they plan to work on.

## Step 2: Build the name

Format: `{type}/{short-kebab-description}`

| Type | When |
|------|------|
| `feat` | New feature |
| `fix` | Bug fix |
| `chore` | Maintenance, deps, CI, config |
| `refactor` | Restructuring, no behavior change |
| `docs` | Docs only |
| `test` | Tests |
| `perf` | Performance |
| `ci` | CI/CD workflows |

Rules: lowercase kebab-case, 2-4 words, hyphens only — e.g. `feat/ai-event-handler`, `fix/null-guard-context-args`, `chore/update-lockfile`.

If the user gave an explicit name, use it as-is (skip analysis).

## Step 3: Create

Run `git checkout -b {branch-name}` and confirm. Keep the whole flow quick — this is a utility, not an investigation.
