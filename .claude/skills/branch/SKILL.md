---
name: branch
description: Create a new git branch from the default branch based on current conversation context or uncommitted changes. Analyzes work context and generates a conventional-commit-style branch name (feat/xxx, fix/xxx, chore/xxx, refactor/xxx).
---

# Branch

Create a new git branch with a conventional-commit-style name, derived from the current conversation context or git changes.

## When This Skill Activates

- User types `/branch`
- User asks to "create a branch", "make a branch", "new branch"

## Pre-conditions

### Must be on the default branch

Before doing anything, verify the current branch is the default branch (typically `main` or `master`).

1. Run `git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@'` to detect the default branch name. If this fails, fall back to checking if `main` or `master` exists.
2. Run `git branch --show-current` to get the current branch.
3. If the current branch is **not** the default branch, inform the user and **stop**. Do not proceed.

## Workflow

### Step 1: Analyze Work Context

Determine what the user is working on, using one of two strategies:

#### Strategy A: Conversation Context Available

If there has been prior conversation in this session (the user discussed a task, bug, feature, etc.):

1. Briefly summarize what was discussed or worked on (1-2 sentences max)
2. Use this as the basis for the branch name

#### Strategy B: No Conversation Context

If there is no meaningful prior conversation, analyze git changes:

1. Run `git status --short` to see uncommitted changes
2. Run `git diff --stat` to see the scope of changes
3. If there are staged changes, also run `git diff --cached --stat`
4. Briefly summarize what the changes appear to be about (1-2 sentences max)

If there are **no changes and no conversation context**, ask the user what they plan to work on.

### Step 2: Determine Branch Name

Based on the analysis from Step 1, generate a branch name following this convention:

```
{type}/{short-description}
```

#### Type Selection

| Type       | When to use                                        |
|------------|----------------------------------------------------|
| `feat`     | New feature or functionality                       |
| `fix`      | Bug fix                                            |
| `chore`    | Maintenance, dependencies, CI, config              |
| `refactor` | Code restructuring without behavior change         |
| `docs`     | Documentation only                                 |
| `test`     | Adding or updating tests                           |
| `perf`     | Performance improvement                            |

#### Naming Rules

- Use lowercase kebab-case for the description: `feat/add-user-auth`
- Keep it short but descriptive (2-4 words ideal)
- No special characters other than hyphens
- Examples:
  - `feat/ai-event-handler`
  - `fix/null-guard-context-args`
  - `chore/update-lockfile`
  - `refactor/extract-layout-utils`

### Step 3: Confirm and Create

1. Present the proposed branch name to the user
2. Wait for user confirmation (or let them suggest an alternative)
3. Once confirmed, run: `git checkout -b {branch-name}`
4. Confirm the branch was created successfully

## Important Notes

- **Never** create a branch without user confirmation on the name
- **Never** run on a non-default branch — this prevents accidental branching from feature branches
- Keep the analysis brief — this is a quick utility, not a deep investigation
- If the user provides a specific branch name, use it as-is (skip analysis)
