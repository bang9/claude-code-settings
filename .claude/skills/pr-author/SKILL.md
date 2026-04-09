---
name: pr-author
description: PR author workflow — create PRs or respond to review feedback. Use when the user is working on their own PR (drafting, handling reviewer comments, verifying fixes, requesting re-review).
---

# PR Author

## Routing

Determine the sub-command from args or conversation context:

| Trigger | Sub-command | Action |
|---|---|---|
| `create`, "PR 만들어", "PR 작성", no existing PR for branch | **create** | Read and follow `create/index.md` |
| `respond`, "리뷰 반영", "피드백 처리", review feedback mentioned | **respond** | Read and follow `respond/index.md` |
| (no arg, ambiguous) | Auto-detect or ask |

## Auto-Detection

When no explicit sub-command is given:

1. `gh pr view --json number,state 2>/dev/null`
2. PR exists and open → default to **respond**
3. No PR → default to **create**
4. Still ambiguous → ask the operator

## Language

Detect the operator's conversation language. All generated content (summaries, comments, reports) MUST use that language. Preserve source-code artifacts (file paths, identifiers, diff hunks) in their original language.
