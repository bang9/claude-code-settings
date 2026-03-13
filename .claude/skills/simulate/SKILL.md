---
description: Run multi-agent simulations to measure consistency of non-deterministic behavior. Use when the user wants to A/B test, validate behavioral equivalence, or stress-test outputs at scale.
argument-hint: "<scenario> [--runs N]"
allowed-tools: Agent, Bash, Read, Write, Edit, Glob, Grep
---

Run multi-agent simulations from a user-provided scenario. Concretize the scenario into test cases, spawn agents, and analyze output patterns.

## Input

Extract from `$ARGUMENTS`:
- **Scenario**: what to simulate, compare, and verify
- **Runs**: `--runs N` (default: 5)

## Workflow

### 1. Concretize

Read any files, git refs, or codebase artifacts referenced in the scenario, then transform it into concrete test cases:

| Field | Description |
|-------|-------------|
| Name | Short identifier (e.g., `deprecated-move-1`) |
| Setup | Context the agent receives (file contents, code, instructions) |
| Action | What the agent executes |
| Output contract | Structured format the agent must produce |

The **output contract** is critical — all agents must produce the same structure so results are mechanically comparable:

```
### Result
- pattern: [short label for the approach taken]
- output:
  ```
  [code block, JSON, or other structured output]
  ```
- decisions: [key judgment calls made]
```

For A/B comparisons, choose a bias strategy:

| Strategy | When to use | Agent count |
|----------|-------------|-------------|
| Sequential | Outputs are structured (code, configs) — one agent runs A then B | N |
| Isolated | Outputs involve judgment or prose — separate agents per version | 2N |

Present the test plan. **Wait for user approval before executing.**

### 2. Execute

Spawn agents in parallel. Each run is one agent named `sim-{test-case}-{run}`.

Agent prompt structure — every prompt must be **self-contained**:

1. **Role**: "You are a simulation agent. Execute the task and produce structured output."
2. **Context**: All file contents and reference material embedded inline — not file paths
3. **Task**: The test case action
4. **Output contract**: The exact format to produce

Batching:
- ≤ 10 agents: spawn all at once with `run_in_background: true`
- \> 10 agents: groups of 10, next batch after previous completes

Use `model: sonnet` unless the scenario requires higher reasoning.

### 3. Analyze

Classify outputs into patterns:

1. Collect all agent outputs
2. Group by **structural similarity** — ignore cosmetic differences (whitespace, comment style, translation wording)
3. Label each group (A, B, C...)
4. Identify **root cause** of each divergent pattern
5. Flag agents with malformed output as "unclassifiable"

### 4. Report

```
## Simulation Report

### Consistency: X/N (Y%)

### Output Patterns
| Pattern | Count | Runs | Description |
|---------|-------|------|-------------|
| A       | 8     | #1-6,#8,#10 | [dominant behavior] |
| B       | 2     | #7,#9 | [variant behavior] |

### Divergence Analysis
For each non-dominant pattern:
- Runs: [list]
- Root cause: [why]
- Severity: cosmetic | functional | breaking
- Diff from dominant: [key differences]

### Summary
- Total: N runs across M test cases
- Dominant pattern: A (X%)
- Key findings: ...
- Recommendation: [if applicable]
```

Save the full report with raw agent outputs to `/tmp/simulate-{slug}-{timestamp}.md` and tell the user the path.

## Rules

- Never execute before user approves the test plan
- Embed all context inline in agent prompts — no shared state assumptions
- For A/B comparisons, both versions receive identical inputs
- Use real file contents from the codebase — never fabricate code
