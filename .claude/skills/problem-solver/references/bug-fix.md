# Track A: Bug Fix

Build a reproduction, fix the root cause on top of it, have a fresh-eye reviewer confirm it's fundamental — repeat until it is.

```
A1 reproduce → A2 fix root cause → A3 review ──(workaround)──▶ back to A2 (or A1)
                                              └──(fundamental)──▶ done
```

## A1: Build a Reproduction (critical)

Establish a verifiable way to trigger the bug before changing anything. Pick the method(s) that fit; combine freely.

| Bug type | Method | Example |
|----------|--------|---------|
| Logic, calculation, data transform | Failing test | Unit test that fails because of the bug |
| UI rendering, interaction | Mock data + UI | Storybook / dev server with fixture data |
| Timing, state, intermittent | Logging | Logs at key execution points (+ timestamps) |

Locating the cause first:
- Minimal case — strip unrelated code until the smallest trigger remains. (logic/calculation bugs)
- Logging injection — entry/exit + state logs to trace the flow. (timing/state/intermittent)
- Git bisect — binary-search commits between known-good and bad. (regressions, "it worked before")

Checkpoint: Can you trigger the bug reliably and on demand? For intermittent bugs, the repro must fail consistently enough to prove a fix.

## A2: Fix the Root Cause

On top of the reproduction, fix the *cause*, not the symptom. Implement in small increments; re-run the reproduction after each.

Avoid:
- Symptom suppression — catching/ignoring errors instead of fixing the source.
- Shotgun debugging — many speculative changes hoping one sticks. Make one targeted change.
- Copy-paste fixing — pasting a fix you don't understand.

## A3: Independent Review (loop)

The bug must no longer reproduce, existing tests must pass, no new warnings/errors. Then run third-party evaluation.

REQUIRED: `references/third-party-evaluation.md` — criteria row: *Bug fix*.

If the reviewer judges it a workaround → return to A2 (or A1 if the reproduction itself was wrong) and repeat until the fix is fundamental.

For intermittent/timing bugs, run the reproduction multiple times — a single green run is not proof.
