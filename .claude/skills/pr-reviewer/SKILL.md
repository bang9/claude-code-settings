---
name: pr-reviewer
description: Use when reviewing someone else's PR at any stage of the review lifecycle — digest a PR, write a review, or verify follow-up changes.
---

# PR Reviewer

## Evidence

Apply these rules across the review lifecycle; digest remains read-only and makes no review judgments:

- Inspect evidence relevant to the PR's claims: linked logs, requests/responses, tests, screenshots, recordings, or CI. Identify the version/commit, environment, and reproduction conditions. Report inaccessible evidence and validation gaps explicitly.
- In write/followup, support a bug finding with a concrete trigger, reachable code/data flow, violated contract, and impact. Precise code references can establish a deterministic bug or policy violation without a live reproduction; add a minimal reproducer, test, log, screenshot, video, or link when useful.
- For environment-dependent claims, check the relevant code version and configuration where accessible. Distinguish deployed observations from repository defaults and inferred behavior. A different branch's default or a similar past incident alone does not prove a current failure.
- Keep unverified possibilities separate from confirmed findings. Missing live verification is not itself proof of a bug. Investigate contradictory evidence and correct or withdraw a finding when its premise is disproved.
- For follow-up fixes, prefer the original scenario or focused check failing before and passing after. State the scope of each result: mocked/unit, local integration, CI, or live. A changed diff, outdated marker, or test count alone does not establish that the concern is resolved.
- Recheck the PR head before posting or approving. If it changed, reassess affected findings and evidence; do not present an old-head review as approval of the new head. Keep pending checks and unresolved threads explicit.
- Use short, relevant evidence excerpts and redact secrets/unrelated customer data. Collection and publication stay within the operator's authorized scope; do not deploy, mutate live data, or create extra hosting comments merely to obtain evidence.

## Routing

Determine the sub-command from args or conversation context:

| Trigger | Sub-command | Action |
|---|---|---|
| `digest`, "PR 파악", "PR 이해", "멘탈모델", wants to understand before reviewing | **digest** | Read and follow `digest/index.md` |
| `write`, "리뷰 작성", "코드 리뷰", "review", wants to leave review comments | **write** | Read and follow `write/index.md` |
| `followup`, "반영 확인", "follow-up", "re-review", checking author's fixes | **followup** | Read and follow `followup/index.md` |
| (no arg, ambiguous) | Ask the operator which phase they're in |

## Auto-Detection

Before dispatching to any sub-command, confirm a PR is attached to the current branch:

1. `gh pr view --json number,state 2>/dev/null`
2. PR exists → proceed with routing
3. No PR → stop: "No open PR found for the current branch."

## Workflow Sequence

The three sub-commands map to the natural reviewer lifecycle:

```
digest → write → followup
(이해)   (리뷰)   (반영 확인)
```

Each phase is independent — the operator can enter at any point.

## Language

Detect the operator's conversation language. All generated content (summaries, comments, reports) MUST use that language. Preserve source-code artifacts (file paths, identifiers, diff hunks) in their original language.
