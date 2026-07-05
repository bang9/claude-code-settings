---
name: pr-author
description: Use when the user is working on their own PR — drafting/creating it, handling reviewer comments, verifying fixes, or requesting re-review.
---

# PR Author

## Routing

Determine the sub-command from args or conversation context:

| Trigger | Sub-command | Action |
|---|---|---|
| `create`, "PR 만들어", "PR 작성", no existing PR for branch | **create** | Read and follow `create/index.md` |
| `respond`, "리뷰 반영", "피드백 처리", review feedback mentioned | **respond** | Read and follow `respond/index.md` |
| (no arg, ambiguous) | — | Auto-detect (see Auto-Detection) or ask the operator |

## Auto-Detection

When no explicit sub-command is given:

1. `gh pr view --json number,state 2>/dev/null`
2. PR exists and open → default to **respond**
3. No PR → default to **create**
4. Still ambiguous → ask the operator

## Language

Detect the operator's conversation language. All generated content (summaries, comments, reports) MUST use that language. Preserve source-code artifacts (file paths, identifiers, diff hunks) in their original language.
