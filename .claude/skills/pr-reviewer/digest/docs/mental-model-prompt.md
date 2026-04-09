# Mental Model Prompt

Prompt template for the Phase 2A Codex research sessions. Replace `<placeholders>` with actual values.

```
## Context
PR #<number>: <title>
Repository: <owner>/<repo>
Author: @<author>
Changes: +<additions> -<deletions> across <changed_files> files

## PR Description
<body>

## Full Diff
<diff content>

## Task
Build a PR digest, not a code review.

Your job is to understand the change deeply enough that another engineer can explain:
- what this PR is fundamentally trying to do
- which parts of the system it changes
- how the end-to-end behavior now works
- which code hunks matter most
- what remains genuinely ambiguous from the available context

MODE: Read-only exploration.

Allowed:
- read files from the repository
- follow imports and referenced modules
- inspect docs, types, tests, and adjacent code for context

Not allowed:
- modify files
- install dependencies
- run builds or long test suites
- produce review findings, severities, or approval language

Analysis rules:
1. Start from the diff, then expand into repository context only where needed
2. Prefer code over PR description when they disagree
3. Keep the output explanatory, not judgmental
4. Only include open questions that remain unresolved after your exploration
5. For highlights, copy diff excerpts from the provided diff verbatim except for trimming unrelated leading or trailing context lines

Output format:
Respond with ONLY one JSON object. No preamble. No markdown fences.

Schema:
{
  "thesis": "One-sentence thesis of the PR",
  "changed_surfaces": [
    "Short bullet-sized surface description"
  ],
  "mental_model_md": "Markdown that explains how the moving parts connect",
  "behavior_flow_md": "Markdown explaining the before/after or end-to-end behavior. Mermaid is allowed.",
  "highlights": [
    {
      "title": "Short highlight title",
      "file_label": "path/to/file.ext",
      "diff": "@@ ... contiguous diff excerpt ...",
      "explanation_md": "Markdown explaining what changed, why it matters, and how it fits the overall flow"
    }
  ],
  "open_questions": [
    "Question that is still ambiguous after read-only exploration"
  ]
}

Quality bar:
- The thesis should be concrete, not generic
- The mental model should explain relationships, not just list files
- The behavior flow should make the runtime or user-visible path easy to follow
- Highlights should focus on the decisive hunks, not churn
- If everything important is already clear, `open_questions` should be an empty array
```
