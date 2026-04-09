# PR Author — Create

Create a well-structured pull request from the current branch.

## Execution Checklist

- [ ] **1** Branch validated — not on default branch, has commits ahead
- [ ] **2** Context collected — commits, diff stats, changed files, related issues
- [ ] **3** PR draft assembled — title, body with summary and test plan
- [ ] **4** Draft presented to operator for review
- [ ] **5** PR created via `gh pr create`

## Phase 1: Branch Validation

```bash
git rev-parse --abbrev-ref HEAD
```

- If on `main` or `master` → stop: "You're on the default branch. Create a feature branch first."
- If no commits ahead of base → stop: "No commits ahead of the base branch. Nothing to create a PR for."

Detect the base branch:
```bash
gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name'
```

## Phase 2: Context Collection

Run in parallel:

| Sub-step | Command | Purpose |
|----------|---------|---------|
| **2a** | `git log <base>..HEAD --oneline` | Commit list |
| **2b** | `git diff <base>...HEAD --stat` | Change stats |
| **2c** | `git diff <base>...HEAD --name-only` | Changed files |
| **2d** | `git log <base>..HEAD --format="%B" --grep="fixes\|closes\|resolves" -i` | Linked issue refs |

If the branch name contains an issue reference (e.g., `feat/PROJ-123-*`), extract it.

## Phase 3: Draft Assembly

### Title

- Infer from branch name + commit messages
- Keep under 70 characters
- Use conventional format when the commit history suggests it (e.g., `feat:`, `fix:`)

### Body

```markdown
## Summary

<3-5 bullet points explaining what this PR does and why>

## Changes

<brief description of key changes, grouped by area if needed>

## Related Issues

<linked issues if any — use "Fixes #N" or "Relates to #N">

## Test Plan

<how to verify the changes — checklist format>
```

Rules:
- Summary focuses on **why**, not just what
- Each bullet should be independently understandable
- Include test plan even if minimal ("existing tests pass")
- Do not include implementation details that are obvious from the diff

## Phase 4: Operator Review

Present the draft title and body. Wait for operator confirmation or edits.

- Operator may adjust title, body, or request changes
- Incorporate feedback and re-present if needed
- Do not create the PR without confirmation

## Phase 5: PR Creation

```bash
gh pr create --title "<title>" --body "<body>" [--draft]
```

- Default to regular PR. Use `--draft` only if operator requests it
- If the branch is not pushed: `git push -u origin HEAD` before creating
- For org repos, respect CLAUDE.md GH_TOKEN override guidance

After creation, report the PR URL.
