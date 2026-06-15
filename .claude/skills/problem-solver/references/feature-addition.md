# Track C: Feature Addition

Lock the existing behavior the feature will touch, then build the new behavior on that foundation — existing tests stay green, new tests prove the feature. Behavior is extended, not broken.

```
C1 pin existing → C2 review ──(weak)──▶ back to C1
                            └──(solid)──▶ C3 build + new tests → C4 review ──(weak/regression)──▶ back to C3
                                                                            └──(both hold)──▶ done
```

## C1–C2: Pin the Existing Surface

Write a rock-solid characterization suite for the existing logic the feature will interact with, and have a fresh-eye reviewer confirm it before you build.

REQUIRED: `references/characterization-testing.md`

This is the regression net: it proves the feature didn't break what already worked. Do not start C3 until it passes independent review.

## C3: Build the Feature

Implement the new behavior in small increments. For each increment:
- Write tests for the new behavior (assert what it *should* do).
- Keep the existing suite fully green — a red existing test means the feature regressed something; fix it before continuing.

## C4: Independent Review (loop)

Existing + new tests all green, new behavior verified, no new warnings/errors. Then run third-party evaluation.

REQUIRED: `references/third-party-evaluation.md` — criteria rows: *Tests* (new tests) and *Result* (no regressions).

If the reviewer finds weak new tests or a regression in existing paths → return to C3 and repeat until both hold.
