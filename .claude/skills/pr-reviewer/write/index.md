# PR Reviewer — Write

Interactive code review workflow. The operator drives focus areas, Claude investigates code and manages review comments, then submits a structured review.

## Execution Checklist

- [ ] **1** PR context gathered — commits, diff stats, changed files
- [ ] **1** Existing pending review synced via `prc.sh sync`
- [ ] **1** Overview table presented
- [ ] **1** (optional) Automated pre-scan offered and run if accepted
- [ ] **2** Interactive review loop — investigate, discuss, add comments on request
- [ ] **3** Review submitted with dependency graph and work order

## Phase 1: Setup

### 1.1 PR Context

1. Find PR: `gh pr list --head <branch>`
2. Fetch in parallel:
   - `git log <base>..HEAD --oneline` — commit list
   - `git diff <base>...HEAD --stat` — change stats
   - `git diff <base>...HEAD --name-only` — changed files
3. Present concise overview table (package / area / summary)

### 1.2 Comment Session

Initialize or resume the comment management session:

```bash
./prc.sh init
```

**Script location:** `prc.sh` in this skill directory.

If existing pending review found, show synced comments in tracking table before starting.

### 1.3 Optional: Automated Pre-Scan

Before starting interactive review, offer:

> "Run automated scan first? (security / performance / test coverage)"

**If accepted** — spawn three reviewer agents in parallel via the Agent tool:

| Reviewer | Focus | Checklist |
|----------|-------|-----------|
| **Security** | Input validation, auth changes, secrets exposure, injection, dependency CVEs, error leaks, CORS/CSP | Severity: Critical / High / Medium / Low |
| **Performance** | Algorithm complexity, re-renders, memory leaks, bundle size, N+1 queries, caching, lazy loading | Impact: High / Medium / Low |
| **Test Coverage** | New code tested, edge cases, test clarity, mock appropriateness, integration coverage, missing negative tests | Priority: Must / Should / Nice |

Each reviewer reads the full diff, analyzes against their checklist, and reports findings with file paths and line references.

Compile findings into a summary and present as the starting context for interactive review.

**If declined** — skip directly to Phase 2.

### 1.4 Ask where to start

After setup (and optional pre-scan results), ask the operator which area to review first.

## Phase 2: Interactive Review Loop

### When the operator points to code

1. **Investigate first** — read the code, trace call sites, check cross-platform counterparts (react/rn)
2. **Discuss** — answer questions, raise concerns, propose alternatives
3. **Never add comments unprompted** — wait for explicit request

### Review depth guide

Investigate at these levels, going deeper as discussion warrants:

| Level | What to check |
|-------|--------------|
| **Naming** | Convention consistency, intent clarity |
| **Structure** | File placement, component vs context, responsibility separation |
| **API design** | Hook signatures, parameter count, callback patterns |
| **Cross-platform** | React/RN parity, shared code in core |
| **Architecture** | Props drilling vs context, provider hierarchy, data flow |
| **Performance** | Unnecessary re-renders, object creation, cleanup |
| **Correctness** | Race conditions, edge cases, dedup, streaming behavior |

### Adding comments

When the operator requests a comment:

1. Infer file/line from most recently discussed code
2. For multi-line ranges, use `--start-line` and `--line`
3. Draft the comment — summarize discussion into a concise suggestion with rationale
4. Show to operator for confirmation
5. After confirmation:

```bash
./prc.sh add --file <path> [--start-line <n>] --line <n> --body "<text>"
```

6. Show updated tracking table: `./prc.sh list`

### Updating comments

When the operator says "fix that one", "add more to it":

1. Identify target comment and modification intent
2. Rewrite the body
3. `./prc.sh update <id> --body "<text>"`
4. Show updated tracking table

### Natural language action mapping

| Intent | Action |
|---|---|
| "leave a comment on this" | `./prc.sh add` |
| "fix that one", "add this to it" | `./prc.sh update` |
| "sync comments" | `./prc.sh sync` |
| "submit as draft" | `./prc.sh submit --draft` |
| "submit the review" | `./prc.sh submit` |

### Comment quality

- Reference specific file paths and line numbers
- Explain the problem AND suggest a direction
- Use concrete code snippets for API change proposals
- Describe runtime behavior with step-by-step execution traces, not abstractions
- Note cross-package impact (react/rn)
- Distinguish severity: structural concern vs nit

### Tracking table

Maintain after each comment change:

```
| # | File | Summary |
|---|------|---------|
| 1 | `file.ts:L5-10` | one-line summary |
```

## Phase 3: Submission

### 3.1 Push drafts to GitHub

```bash
./prc.sh submit --draft
```

### 3.2 Analyze comment relationships

Group comments by theme and map dependencies:
- Which comments enable other comments?
- Which supersede others?
- Which are standalone?

### 3.3 Build dependency graph

```
┌─────────────────────────────┐
│  Group A: Theme name         │
│  #N root comment             │
│   ├── #M depends on #N       │
│   └── #K depends on #N       │
└─────────────────────────────┘
```

### 3.4 Recommend work order

Number groups by dependency order. Note which can be parallelized.

### 3.5 Submit review

Generate review summary for `--body`:
- Group comments by theme/area
- Note relationships and dependencies
- Recommend work order if applicable

```bash
./prc.sh submit [--event APPROVE|REQUEST_CHANGES|COMMENT] --body "<summary>"
```

Default event: `COMMENT`. Use `APPROVE` or `REQUEST_CHANGES` only when operator specifies.

## Comment Writing Guide

- Write as suggestions ("Consider changing...", "It would be better to...")
- Include rationale from discussion concisely
- Use markdown code blocks for code suggestions
- Match the language of the conversation (Korean/English)

## Key Rules

- **Operator drives** — Claude investigates and discusses, never dictates focus
- **No unprompted comments** — only add when explicitly requested
- **Investigate before opining** — always read code first, trace the full picture
- **Track everything** — show updated table after each comment
- **Cross-platform awareness** — check counterpart when reviewing react/rn
- **Discussion ≠ comment** — some discussions conclude without a comment
