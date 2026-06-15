# Track B: Refactoring

Lock current behavior under a solid test suite, then restructure on top of it — the suite stays green throughout. Behavior is preserved, not changed.

```
B1 write tests → B2 review ──(weak)──▶ back to B1
                           └──(solid)──▶ B3 refactor → B4 review ──(drift/broken)──▶ back to B3
                                                                  └──(clean)──▶ done
```

## B1–B2: Build the Safety Net

Write a rock-solid characterization suite for the code you're about to restructure, and have a fresh-eye reviewer confirm it's strong before you touch anything.

REQUIRED: `references/characterization-testing.md`

Do not start B3 until the suite passes independent review.

## B3: Refactor on the Net

Restructure in small, reversible increments. After each increment, run the suite — it must stay fully green. A red test means either the refactor changed behavior (fix the refactor) or the test asserted an implementation detail (fix the test, then re-evaluate via B1–B2).

Keep the change behavior-neutral: no new features, no bug fixes smuggled in. If you discover a bug mid-refactor, finish or stash the refactor and switch to `references/bug-fix.md`.

## B4: Independent Review (loop)

Suite green, no new warnings/errors, code measurably simpler/cleaner. Then run third-party evaluation.

REQUIRED: `references/third-party-evaluation.md` — criteria row: *Result*.

If the reviewer finds behavior drift or that tests were weakened to pass → return to B3 and repeat until the suite stays green and the result passes review.
