# Step 5 — Output

This skill evaluates and reports — it does not apply changes. Lead with the actionable detail
and close with the at-a-glance summary. When several skills were audited, repeat sections 2–5
once per skill (each gets its own Details → Scorecard → Verdict).

**1. Header** — one line: `Preflight: <n> skill(s) · <n> BLOCKER · <n> MAJOR · <n> MINOR`.

**2. `### Details`** — finding blocks grouped under their dimension heading
(`#### <Dimension> — <grade>`), **only for dimensions that have findings**; a clean dimension
stays in the Scorecard, not here. Order BLOCKER-bearing dimensions first.

Emit each finding as PLAIN MARKDOWN — do NOT wrap the finding in a ``` ```text ``` (or any) code
fence. The only fenced block in a finding is the ` ```diff ` for the Fix; wrapping the whole
finding in an outer fence nests fences and breaks rendering (the inner closing ``` ends the outer
block early). Each finding uses exactly these fields:

`<path>`
- **Severity:** BLOCKER | MAJOR | MINOR · **Check type:** rule | judgment
- **Problem:** <specific criterion violated>
- **Left unchanged:** <content preserved and why>
- **Size:** <current lines/bytes> → <expected after the proposed fix, or n/a>
- **Fix:**
  ```diff
  - <line removed>
  + <line added>
  ```

`Check type` is `rule` (step 2 preflight script) or `judgment` (step 4 review). Use the ` ```diff `
block for any concrete edit; fall back to a prose **Fix:** line only when it can't be a line diff
(e.g. "create file X"). If a target was unreadable/unparseable, say so here and note its judgment
review was skipped.

**3. `### Scorecard`** — a real Markdown table (NOT fenced — emit it as a live table so it renders),
one row per judgment criterion (Value, Description, Body Size, Routing, Checkable Flow) plus a
`Preflight (rule)` row. Score and grade are DERIVED from the findings, never eyeballed:

| Dimension        | Score | Grade | Note |
|------------------|-------|-------|------|
| Preflight (rule) |  —    |  F    | name != dir |
| Value            |  100  |  A    | earns its place |
| Description      |  80   |  B    | trigger buried mid-sentence |
| Body Size        |  100  |  A    | — |
| Routing          |  92   |  A    | — |
| Checkable Flow   |  100  |  A    | — |

Per-row score: any BLOCKER in that dimension → grade `F`, score `—`; otherwise start at 100,
subtract 20 per MAJOR and 8 per MINOR, clamp to [0, 100]. Grade bands: A 90–100, B 70–89,
C 50–69, F < 50. `Note` is a one-line pointer to the Details above — do not restate the block.

**4. Verdict** — final line: `Overall: <grade> — <reason> · Shippable: NO (<n> BLOCKER) | YES`.
Overall is the lowest row grade; any BLOCKER → `F` and `Shippable: NO`.

Then close by asking whether to apply the proposed fixes. Applying is a separate follow-up
the user opts into — do not edit the target as part of this skill.
