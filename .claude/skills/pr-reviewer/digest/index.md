# PR Reviewer — Digest

Build a mental model of someone else's PR so you can explain its intent, changed surfaces, behavior flow, and key code changes without rereading the full diff. Read-only — no review comments or judgments.

## Anti-patterns

- Turn the digest into a review with severities, findings, or approval language
- Trust the PR body more than the code
- Stay diff-only when the change clearly needs repository context
- Output the digest as terminal markdown instead of launching `scripts/run.sh`

## Execution Checklist

- [ ] **1.1** `gh pr view` metadata collected
- [ ] **1.2** (parallel) diff + linked issues + related docs collected
- [ ] **1.3** PR classified: UI / logic / API / data / refactor / infra / mixed
- [ ] **2A** (parallel) two read-only mental-model scans spawned via SubAgent
- [ ] **2A** scan outputs collected; at least one parseable result available
- [ ] **2A** thesis, changed surfaces, behavior flow, highlights, open questions aggregated
- [ ] **2B** (if UI PR) UI reconstruction spawned and collected
- [ ] **3** digest assembled and `scripts/run.sh` launched
- [ ] **4** prompt result parsed; finish when reader closes the digest

## Prompt UI Theme

All prompt UI output for this skill MUST use a light theme unless the operator explicitly asks otherwise.

## Phase 1: PR Discovery & Context Collection

### 1.1 PR Discovery

```bash
gh pr view --json number,title,author,baseRefName,headRefName,url,body,additions,deletions,changedFiles
```

If the operator provides a specific PR reference (`owner/repo#123` or URL), use `gh pr view <number> --repo <owner>/<repo>`.

For org repos, respect CLAUDE.md GH_TOKEN override guidance.

Store: `pr_number`, `title`, `author`, `base_branch`, `head_branch`, `url`, `body`, `additions`, `deletions`, `changed_files`. Extract `owner` and `repo` from URL.

### 1.2 Diff & Context Collection (parallel)

| Sub-step | Command / Action | Purpose |
|----------|------------------|---------|
| **1.2a** | `gh pr diff <number> --repo <owner>/<repo>` | Ground-truth code changes |
| **1.2b** | Fetch `Fixes #N` refs via `gh issue view` | Product / problem context |
| **1.2c** | Read links in body, repo `docs/`, RFC references | Supplementary context |

Analysis principle:
1. Read the diff first and infer the change from code
2. Use the PR description to confirm or fill gaps, not to override code
3. Documents can lag reality; the repository is the source of truth

### 1.3 PR Nature Classification

Classify to determine visuals and exploration depth:

- **UI PR**: changed UI-associated files or styles → triggers Phase 2B
- **Business logic / API / Data model / Refactor / Infrastructure**
- **Mixed**: combine relevant perspectives

If UI PR, enumerate distinct UI states from the diff for reconstruction.

## Phase 2A: Mental-Model Scans

Spawn two independent SubAgents in parallel using the Agent tool (both in a single message).

Use the prompt template from `docs/mental-model-prompt.md`, substituting PR metadata and the full diff. Each SubAgent prompt must be fully self-contained — include the complete diff and all PR metadata inline.

### Worker contract

Each worker returns JSON with: `thesis`, `changed_surfaces`, `mental_model_md`, `behavior_flow_md`, `highlights`, `open_questions`.

### Aggregation rules

1. Accept the strongest clear thesis
2. Merge and deduplicate changed surfaces
3. Merge highlights by file label + title; keep the more concrete explanation
4. Keep only open questions unresolved after checking repository context
5. Cap final highlights at 5-7

If one SubAgent fails or returns unparseable output, continue with the other result plus own synthesis.

## Phase 2B: UI Reconstruction (UI PRs only)

Spawn a SubAgent using the Agent tool with the prompt template from `docs/ui-reconstruction-prompt.md`. Worker returns self-contained HTML. Store as `overview_ui_html`.

## Phase 3: Digest Presentation

Assemble raw digest artifacts into JSON input and launch the prompt:

```bash
./scripts/run.sh --input <raw-digest-input.json>
```

`run.sh` performs the prompt-stage plumbing:
- runs `node scripts/build-payload.mjs`
- validates and normalizes the prompt payload
- launches `prompt.mjs --entry web/app.mjs` (local HTTP server + browser form)
- prints the raw prompt result JSON to stdout

### Digest contents

Help a teammate answer these in under a minute:
- What is this PR really doing?
- Which surfaces changed?
- How does the new end-to-end flow work?
- Which exact hunks matter most?
- What is still ambiguous from code alone?

#### 3.1 Overview

- 3-5 bullet summary
- One-sentence thesis
- 1-3 diagrams based on PR nature
- UI reconstruction iframe for UI PRs

Diagram types:

| PR nature | Visual approach |
|-----------|-----------------|
| Business logic | `flowchart TD` |
| UI feature | UI reconstruction HTML + `stateDiagram-v2` |
| API changes | `sequenceDiagram` |
| Data model | `erDiagram` |
| Refactor | `graph LR` |
| Infrastructure | `flowchart TD` |
| Mixed | combine 2-3 views |

#### 3.2 Key changes (max 5-7)

For each highlight:
1. Contiguous diff excerpt from the actual PR diff
2. What changed
3. Why it matters to overall behavior
4. How it fits the bigger picture

Skip trivia (imports, formatting).

#### 3.3 Open questions

Only for real ambiguity. If repository context resolves the point, remove it.

### Raw Builder Input Structure

```json
{
  "title": "PR Digest - #123: Example",
  "subtitle": "owner/repo",
  "pr_summary_md": "- Bullet summary",
  "overview_md": "## Thesis\n...\n\n```mermaid\nflowchart TD\n...\n```",
  "overview_ui_html": "<!doctype html>...",
  "overview_ui_height": 860,
  "sections": [
    { "title": "Mental Model", "markdown": "..." },
    { "title": "Changed Surfaces", "markdown": "..." },
    { "title": "Open Questions", "markdown": "..." }
  ],
  "highlights": [
    {
      "title": "Queue handoff now happens before persistence",
      "file_label": "internal/queue/dispatcher.go",
      "diff": "@@ ...",
      "explanation_md": "What / why / how."
    }
  ],
  "submit_label": "Done"
}
```

Normalization: empty sections dropped, highlights with empty title/diff dropped, `overview_ui_html` sanitized.

## Wrap-up

When the digest prompt closes, summarize briefly:
- Whether the digest completed successfully
- Whether UI reconstruction was included
- Any important unresolved ambiguity
