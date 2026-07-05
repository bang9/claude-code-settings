---
name: setup-precommit
description: Use when the user explicitly runs /setup-precommit to install or refresh a quiet, staged-only git pre-commit hook (gitleaks → oxlint → oxfmt) wired through package.json "prepare". User-invoked command only, never auto-triggered.
disable-model-invocation: true
allowed-tools: Bash, Read, Write, Edit
---

# Setup Pre-commit

Install a **quiet, staged-only** git pre-commit hook: `gitleaks → oxlint → oxfmt --check`.
Success prints nothing and exits 0; a failure prints only the failing tool's output and
exits 1. The hook is committed to the repo and wired via `package.json` `"prepare"` so it
installs on `npm install` (idempotent).

The hook and its config are bundled — **copy them, do not rewrite them**:

- `assets/pre-commit` → `./scripts/hooks/pre-commit`
- `assets/.oxfmtrc.json` → repo root (only if absent)

## Workflow

Run from the target repo root. Do the steps in order.

### 1. Preconditions
- Confirm this is a git repo (`git rev-parse --show-toplevel`) and locate `package.json`.
- If there is no `package.json`, ask whether to still install the hook via
  `git config core.hooksPath ./scripts/hooks` directly (no `prepare` wiring).

### 2. Format baseline (drift guard)
- If `oxfmt` is installed, dry-run it across the repo: `oxfmt --check .` (or the source dirs).
- If it reports **many** files needing formatting, do NOT turn the hook on over a dirty tree.
  Run `oxfmt --write .`, commit it **separately** as `style: apply oxfmt baseline`, then continue.
- If the tree is already clean (or drift is tiny), skip this and note it.

### 3. Install the hook
- Copy `assets/pre-commit` → `./scripts/hooks/pre-commit`, then `chmod +x ./scripts/hooks/pre-commit`.
- Copy `assets/.oxfmtrc.json` → repo root **only if** the repo has no oxfmt config yet.
  Then run `oxfmt --check` once on a sample file and confirm the "No config found" banner is
  gone and no schema error prints. If the banner persists or it errors, run `oxfmt --help`
  to find the real option keys and fix `.oxfmtrc.json` — the goal is a config oxfmt actually reads.

### 4. Wire `prepare` (idempotent)
- Ensure `package.json` `"scripts"."prepare"` runs `git config core.hooksPath ./scripts/hooks`.
  - No `prepare` → add it.
  - `prepare` exists but lacks the command → append with ` && git config core.hooksPath ./scripts/hooks`.
  - Already present → leave it.
- Run it now so the hook is live: `git config core.hooksPath ./scripts/hooks`.

### 5. Commit
- Commit `./scripts/hooks/pre-commit`, the `package.json` change, and `.oxfmtrc.json` (if added):
  `chore: add staged-only pre-commit hook (gitleaks/oxlint/oxfmt)`.

### 6. Prove it (required — do not skip)
Verify the contract end-to-end, then restore the tree. Use throwaway files.

```sh
# a) Clean file staged → zero output, exit 0
git add <a-clean-staged-file>
out=$(./scripts/hooks/pre-commit 2>&1); rc=$?
[ -z "$out" ] && [ "$rc" -eq 0 ] && echo "PASS: silent success"

# b) A lint/format violation staged → non-empty output, exit 1
#    (introduce a deliberate oxlint or oxfmt violation in a staged .ts/.js file)
out=$(./scripts/hooks/pre-commit 2>&1); rc=$?
[ -n "$out" ] && [ "$rc" -eq 1 ] && echo "PASS: loud failure"
```

- Also sanity-check: staging only non-JS/TS files (e.g. a markdown file, with gitleaks finding
  nothing) → silent exit 0; and a real commit through `git commit` triggers the hook.
- **Restore every test file to its original state** (`git restore` / `git checkout`) so the repo
  is left exactly as found apart from the intended hook install.

Report what passed with the actual `out`/`rc` values — no unverified success claims.

## Notes
- The hook targets macOS `/bin/bash` 3.2 (no arrays/mapfile). Do not "modernize" it.
- Missing tools produce a one-line stderr warning and **pass** — they never block a commit.
- gitleaks scans all staged content; oxlint/oxfmt only staged JS/TS
  (`.js .jsx .ts .tsx .mjs .cjs .mts .cts`). No staged JS/TS → those two silently pass.
