---
name: problem-solver
description: Use when fixing a bug, refactoring existing code without changing its behavior, or adding a feature that extends existing behavior — any code change that needs a verifiable foundation before the change is made.
---

# Problem Solver

A tool for solving code problems. Whatever the task, build a verifiable foundation first, make the change on top of it, then have a fresh-eye reviewer validate — and repeat until it holds.

Core principle: Never change code you cannot verify. Establish the check (a reproduction, or solid tests) before touching anything.

## Phase 0: Scope & Route

Before anything, collect:

- [ ] Scope — files, components, directories involved
- [ ] Resources — test commands, MCP servers, available tools
- [ ] Expected vs actual behavior — what should happen vs what does
- [ ] Trigger — how to reach the relevant code path

If any of this is unclear: stop and ask, do not guess. Use AskUserQuestion with targeted questions, then restate the problem before proceeding.

Then route to the matching track and follow that file:

| Task | Read |
|------|------|
| Fix a bug / unexpected behavior / error | `references/bug-fix.md` |
| Refactor existing code (behavior preserved) | `references/refactoring.md` |
| Add a feature (behavior extended) | `references/feature-addition.md` |

Every track ends each step with an independent review. REQUIRED for all tracks: `references/third-party-evaluation.md`.
