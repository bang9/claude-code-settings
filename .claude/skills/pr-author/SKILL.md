---
name: pr-author
description: Use when the user is working on their own PR — drafting/creating it, handling reviewer comments, verifying fixes, or requesting re-review.
---

# PR Author

## Evidence

Apply these rules to both creating a PR and responding to review:

- Give reviewers evidence of the problem and the result: reproduction conditions plus an observed failure, and the same scenario or focused check after the change. For bugfixes, prefer a check that fails before and passes after. Include the relevant commit/version, environment, command or steps, and observed result where needed to reproduce the claim.
- Choose useful artifacts: screenshots or a short video for UI behavior; sanitized request/response, logs, test output, or source/CI links for backend behavior. Keep excerpts relevant and redact secrets and unrelated customer data.
- Distinguish mocked/unit tests, local integration, CI, and live verification. State missing verification explicitly. Test counts or a plausible code change alone do not establish that a reported failure is fixed. Collect evidence within the authorized scope; a PR request does not authorize deployment or live-data changes.
- Keep the title, body, evidence, and verification results aligned with the final implementation. Refresh them when the change changes; retain useful existing evidence when editing the body.
- Verify the published artifacts and check CI/review results against the latest head. Report Draft/Ready state separately from check results, and follow the target repo's workflow for readiness. An old-head approval does not approve a new commit.

For image/video attachment commands and upload verification, see **Evidence attachments** in `create/index.md`.

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
