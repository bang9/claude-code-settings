# Step 2 — Preflight [rule] · classify

Deterministic, machine-checkable classification. Run it before any reading or scoring.

Pass the targets resolved in step 1 to the script — each a skill dir or a `SKILL.md` path:

```
node scripts/check-skill.mjs <target> [<target>...]
```

(resolve the script against this skill's own directory). The script checks only the targets
you hand it; it does not search for skills — that was step 1. It is the source of truth for
what is checked: it groups findings by severity and exits non-zero on any BLOCKER. Do not
re-derive or re-list its checks here.

The script exits non-zero on any BLOCKER, but the exit code is a verdict signal, not a hard
stop. Act on its output:

- Halt ONLY for a target the script could not read or whose frontmatter would not parse
  (`cannot read file`, `unparseable frontmatter`) — there is nothing valid to score, so skip
  steps 3–4 for that target. Still report the blocker.
- Every other BLOCKER (name ≠ dir, missing referenced path, secret, …) → carry it forward as
  a `rule` finding and keep going. These make the skill NOT SHIPPABLE but do not block the
  review; they are independent of the judgment findings, so reporting both in one pass lets
  the user fix everything in a single cycle.
- MAJOR / MINOR → carry into the judgment review (step 4).
- A heuristic flag (secret, blob, placeholder) is a candidate, not a verdict — open the file
  and confirm it is real before acting.

A passing benchmark never excuses a deterministic format, safety, or packaging failure — those
land in the report as BLOCKERs and drive the shippable verdict (step 5).
