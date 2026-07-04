---
name: evaluate-skills
description: Use when auditing or improving an agent skill package before it ships or is handed off.
argument-hint: "[skill dir or SKILL.md path; one or more]"
disable-model-invocation: true
allowed-tools: Read Grep Glob Bash(node:*)
---

# Evaluate Skills

Audit a TARGET agent skill package against the skill-evaluation rubric and report the
findings with proposed fixes. This is an evaluation tool — it inspects and reports on another
skill; it does not apply changes or run that skill's workflow.

Resolve every bundled path below against this skill's own directory.

Work the steps in order. Each step's prompt is its own file under `steps/` — read it when
you reach that step, do what it says, and honor any halt condition it states before moving
on. Do not skip steps or read ahead.

1. Target resolution — `steps/1-target-resolution.md`
2. Preflight [rule] — `steps/2-preflight.md` · classify deterministically; carry findings into the report. Halt only for a target that cannot be read or parsed (review is impossible)
3. Read the target — `steps/3-read-target.md`
4. Judgment review [judgment] — `steps/4-judgment-review.md`
5. Output — `steps/5-output.md`
