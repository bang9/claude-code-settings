---
name: pr-reviewer
description: PR reviewer workflow — digest a PR, write a review, or verify follow-up changes. Use when reviewing someone else's PR at any stage of the review lifecycle.
---

# PR Reviewer

## Routing

Determine the sub-command from args or conversation context:

| Trigger | Sub-command | Action |
|---|---|---|
| `digest`, "PR 파악", "PR 이해", "멘탈모델", wants to understand before reviewing | **digest** | Read and follow `digest/index.md` |
| `write`, "리뷰 작성", "코드 리뷰", "review", wants to leave review comments | **write** | Read and follow `write/index.md` |
| `followup`, "반영 확인", "follow-up", "re-review", checking author's fixes | **followup** | Read and follow `followup/index.md` |
| (no arg, ambiguous) | Ask the operator which phase they're in |

## Workflow Sequence

The three sub-commands map to the natural reviewer lifecycle:

```
digest → write → followup
(이해)   (리뷰)   (반영 확인)
```

Each phase is independent — the operator can enter at any point.

## Language

Detect the operator's conversation language. All generated content (summaries, comments, reports) MUST use that language. Preserve source-code artifacts (file paths, identifiers, diff hunks) in their original language.
