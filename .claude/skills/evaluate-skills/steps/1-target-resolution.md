# Step 1 — Target resolution

Resolve WHAT will be audited into a concrete list of skill targets — each a skill directory
(containing `SKILL.md`) or a `SKILL.md` path. You own discovery here; the preflight script
only checks the targets you hand it.

1. If the user gave an argument, start from it — a single skill, or a location holding
   several (including nested layouts).
2. Find every `SKILL.md` under it; recurse as needed, since layouts vary. If the user gave
   nothing, ask which target; if they decline, search the repo where skills live
   (`skills/`, `.claude/skills/`, or elsewhere).
3. If nothing resolves to a `SKILL.md`, stop and report: `evaluate-skills found no target SKILL.md`.

Carry the resolved target list to step 2 (`steps/2-preflight.md`).
