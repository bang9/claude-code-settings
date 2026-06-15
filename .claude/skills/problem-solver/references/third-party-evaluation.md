# Third-Party Evaluation

The shared validation primitive. Every track calls this to check its work before moving on.

## The Rule

An independent review is ALWAYS a fresh-eye subagent — never self-review.

The agent who wrote the change is biased toward believing it works. Dispatch a subagent that did not see your reasoning, give it only the artifact and the criteria, and instruct it to actively try to refute the result.

## How to Run It

1. Dispatch a subagent (fresh context — no access to your working reasoning).
2. Give it only: the artifact under review (diff, test, repro) + the criteria for this track (below).
3. Instruct it to refute: "Find why this is wrong/weak/incomplete. Default to rejecting if uncertain."
4. On failure → loop back to the step that produced the artifact and redo it. Do not proceed on a failed review.

For high-stakes changes, dispatch 2–3 independent reviewers and require a majority to pass.

## Per-Track Criteria

What the reviewer challenges depends on what is being evaluated:

| Artifact | Pass when… | Reject when… |
|----------|------------|--------------|
| Bug fix (root cause) | Reviewer can explain WHY it broke; fix removes the cause; similar inputs are covered; aligns with existing patterns | Special-case patch; "works but unclear why"; error suppressed; same pattern elsewhere would still break; defensive code "just in case" |
| Tests (characterization / new) | Tests pin real behavior and fail for the right reason if behavior changes; meaningful assertions; cover edge cases | Tautological/always-pass; assert implementation detail not behavior; gaps in obvious cases |
| Result (refactor / feature) | Existing tests stay green; new behavior verified; no new warnings/errors; code is simpler or cleaner | Tests broke or were weakened to pass; behavior silently changed; regressions in related paths |

## Why Fresh-Eye Matters

A reviewer who shares your context shares your blind spots. The whole point is independence: only a subagent that never saw the reasoning can catch the assumption you didn't know you made.
