# Step 4 — Judgment review [judgment]

Score the target against the five criteria. These need reading and reasoning, not a script.
Use the cheapest reliable check; do not escalate past what a finding needs.

## 1. Value (reason to exist)

Evaluated: whether the skill — and each section in it — earns its place over a capable base
model's general reasoning.

Why: as models improve, most tasks are handled by general reasoning. Content that only
restates general knowledge or best practices the model already applies adds little, costs
context, and can mislead. A skill earns its value by supplying what the model cannot reliably
derive on its own.

High value (keep): project/repo specifics (paths, commands, conventions); non-obvious failure
modes and footguns; deterministic tools (scripts); discipline gates the model would otherwise
skip.

Reject / question: a skill or section a capable base model would already get right by general
reasoning — cut it; if that is most of the skill, question whether the skill should exist at
all.

## 2. Description

Evaluated: the target's frontmatter `description`. Its role depends on the invoker — check
the target's frontmatter first:

- Model-invoked: the agent's only basis for deciding to open the skill — the trigger must live here.
- Human-invoked (`disable-model-invocation: true`): a label a person reads to pick the
  command, not an activation trigger.

Standard: one tight `Use when ...` sentence stating only the condition or situation; keep
workflow, outputs, and implementation in the body.

Why: model-invoked discovery happens at the description alone — a weak one is never opened,
or opened wrongly; a muddy human-invoked one leaves the user unsure what they just ran.

Reject: body-only trigger (when-to-use only in the body); verbose or bloated (workflow/detail
stuffed in); not-a-trigger (describes what the skill does instead of when to use it).

## 3. Body Size

Evaluated: the length and density of the target's `SKILL.md` body.

Why: the body loads into context whenever the skill is active, and context is not free. A
long body dilutes attention so the rule that matters gets skimmed past, fills the window
faster so compaction hits sooner and blurs detail, and lowers the odds the agent follows the
critical instruction. Length itself degrades behavior — that is why you trim.

Standard:

- Say each thing once — one source of truth per checklist, rule, or command.
- Imperative and concise; drop prose that does not change behavior.
- One strong example over several weak ones.
- Do not cut genuinely-needed dense reference (an output format to emit, an API shape to
  call, a spec to reason over) just to save size. A deterministic procedure or check is a
  different case — extract it to a script (see Routing).

Reject: the same fact repeated across the body; piles of weak examples; behavior-neutral
prose (motivational framing, throat-clearing).

## 4. Routing

Evaluated: how `SKILL.md` splits material and routes the agent to the smallest useful context
for the task.

Why: loading material the task does not need carries the same context cost as a bloated body
(criterion 3) — attention dilution and earlier compaction. Routing is how you avoid that
cost: keep the entry file thin and pull each piece only when its condition is met.

Standard:

- Move branch-specific or optional procedures out of `SKILL.md`; read only the references a
  path needs.
- Never duplicate shared content across files; keep one source and point at it.
- State when each referenced file should be read.
- Prefer flat references; avoid chained routing (one reference sending the agent to another)
  unless the condition is explicit.
- Extract detailed, stateful, or error-prone procedures into a script — a deterministic tool
  plus usage notes, not a long prose procedure. Give its purpose, inputs, outputs, and
  failure signals; do not paste its logic back as prose.

Reject: branch-specific material inlined into `SKILL.md`; a vague reference with no "read
when" condition (e.g. "see docs"); chained routing with no clear trigger; the same content
copied across files.

## 5. Checkable Flow

Evaluated: whether the skill's procedures can be followed and verified step by step.

Why: without an observable gate, discipline collapses under pressure (time, sunk cost, a
tempting workaround) — and a vague reminder like "do it well" does not change behavior. A
gate the agent can check holds the line where it matters.

Standard:

- Numbered steps for linear work; loops with visible entry and exit conditions.
- Add pass/reject gates where discipline matters; prefer fresh-eye verification for gates
  that are easy to rationalize away.

Reject: a flow that leans on hope, motivation, or a vague reminder instead of an observable
gate; a loop with no stated entry or exit condition.

When unsure whether content is dead weight, flag it for the user rather than cutting it.

Continue to step 5.
