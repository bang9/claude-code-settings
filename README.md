## Statusline
<img width="680" height="110" alt="image" src="https://github.com/user-attachments/assets/d744dfb2-95bc-4a9c-a85b-739588936844" />

## Commands

### [clean-branch](https://github.com/bang9/claude-code-settings/blob/main/.claude/commands/clean-branch.md)

Remove local branches that no longer exist on the remote repository.

### [commit](https://github.com/bang9/claude-code-settings/blob/main/.claude/commands/commit.md)

Generate commit messages following the Conventional Commits specification.

## Skills

### [branch](https://github.com/bang9/claude-code-settings/blob/main/.claude/skills/branch/SKILL.md)

Create a new git branch from the default branch based on current conversation context or uncommitted changes.

**When to use:**
- Creating a new branch for a feature or bug fix
- Generating conventional-commit-style branch names automatically
- Starting new work from the default branch

### [problem-solver](https://github.com/bang9/claude-code-settings/blob/main/.claude/skills/problem-solver/SKILL.md)

Structured workflow for debugging, bug fixes, and feature implementations.

**When to use:**
- Bug investigation requiring root cause analysis
- Feature implementation needing step-by-step verification
- Complex issues where you want to avoid workaround solutions

### [code-review](https://github.com/bang9/claude-code-settings/blob/main/.claude/skills/code-review/SKILL.md)

Review current branch changes with a team of specialized reviewers (security, performance, test coverage).

**When to use:**
- Reviewing current branch or PR before merging
- Getting feedback on code changes from multiple perspectives
- Ensuring code quality across security, performance, and test coverage

### [pr-author](https://github.com/bang9/claude-code-settings/blob/main/.claude/skills/pr-author/SKILL.md)

Handle your own PR workflow: create a pull request or respond to review feedback.

**When to use:**
- Creating a well-structured PR from the current branch
- Triage and respond to unresolved review threads on your own PR
- Verify fixes and request re-review after addressing feedback

### [pr-reviewer](https://github.com/bang9/claude-code-settings/blob/main/.claude/skills/pr-reviewer/SKILL.md)

Review someone else's PR across the full lifecycle: digest the change, write review comments, and verify follow-up fixes.

**When to use:**
- Build a mental model of a PR before starting review
- Leave structured review comments and manage pending feedback
- Re-review author follow-up changes and resolve verified threads

### [simulate](https://github.com/bang9/claude-code-settings/blob/main/.claude/skills/simulate/SKILL.md)

Run multi-agent simulations to measure consistency of non-deterministic behavior.

**When to use:**
- A/B test prompts, workflows, or agent instructions
- Validate behavioral equivalence across repeated runs
- Stress-test outputs at scale and analyze divergence patterns
