---
name: setup-precommit
description: Use when the user explicitly runs /setup-precommit to install or refresh a quiet, staged-only git pre-commit hook (secretlint → oxlint → oxfmt) wired through package.json "prepare". User-invoked command only, never auto-triggered.
disable-model-invocation: true
allowed-tools: Bash, Read, Write, Edit
---

# Setup Pre-commit

Install a **quiet, staged-only** git pre-commit hook: `secretlint → oxlint → oxfmt --check`.
Success prints nothing and exits 0; a failure prints only the failing tool's output and
exits 1. The hook is committed to the repo and wired via `package.json` `"prepare"` so it
installs on `npm install` (idempotent). All three tools are resolved from
`./node_modules/.bin` first (installed as devDependencies via `pnpm`), falling back to
PATH only if a tool isn't installed locally.

The hook and its config are bundled — **copy them, do not rewrite them**:

- `assets/pre-commit` → `./scripts/hooks/pre-commit`
- `assets/.oxfmtrc.json` → repo root (only if absent)
- `assets/.secretlintrc.json` → repo root (only if absent)
- `assets/.secretlintignore` → repo root (only if absent)

## Workflow

Run from the target repo root. Do the steps in order.

### 1. Preconditions
- Confirm this is a git repo (`git rev-parse --show-toplevel`) and locate `package.json`.
- Confirm `pnpm` is available (`command -v pnpm`); this hook depends on tools installed
  as local devDependencies, not global installs.
- If there is no `package.json`, ask whether to still install the hook via
  `git config core.hooksPath ./scripts/hooks` directly (no `prepare` wiring, no local
  tool installs — the hook will fall back to PATH for every tool).

### 2. Install tooling as devDependencies
- `pnpm add -D oxlint oxfmt secretlint @secretlint/secretlint-rule-preset-recommend`
  (skip any package already listed in `package.json` devDependencies).
- This is what makes the binaries appear under `./node_modules/.bin` for the hook to use.

### 3. Format baseline (drift guard)
- Dry-run oxfmt across the repo: `./node_modules/.bin/oxfmt --check .` (or the source dirs).
- If it reports **many** files needing formatting, do NOT turn the hook on over a dirty tree.
  Run `./node_modules/.bin/oxfmt --write .`, commit it **separately** as
  `style: apply oxfmt baseline`, then continue.
- If the tree is already clean (or drift is tiny), skip this and note it.

### 4. Install the hook
- Copy `assets/pre-commit` → `./scripts/hooks/pre-commit`, then `chmod +x ./scripts/hooks/pre-commit`.
- Copy `assets/.oxfmtrc.json` → repo root **only if** the repo has no oxfmt config yet.
  Then run `./node_modules/.bin/oxfmt --check` once on a sample file and confirm the
  "No config found" banner is gone and no schema error prints. If the banner persists or
  it errors, run `./node_modules/.bin/oxfmt --help` to find the real option keys and fix
  `.oxfmtrc.json` — the goal is a config oxfmt actually reads.
- Copy `assets/.secretlintrc.json` and `assets/.secretlintignore` → repo root **only if**
  the repo has no secretlint config yet. Then run
  `./node_modules/.bin/secretlint --no-glob package.json` once and confirm it runs (no
  "rule not found" or config error) rather than erroring on a missing rule preset.

### 5. Wire `prepare` (idempotent)
- Ensure `package.json` `"scripts"."prepare"` runs `git config core.hooksPath ./scripts/hooks`.
  - No `prepare` → add it.
  - `prepare` exists but lacks the command → append with ` && git config core.hooksPath ./scripts/hooks`.
  - Already present → leave it.
- Run it now so the hook is live: `git config core.hooksPath ./scripts/hooks`.

### 6. Commit
- Commit `./scripts/hooks/pre-commit`, the `package.json`/lockfile changes from step 2,
  and `.oxfmtrc.json` / `.secretlintrc.json` / `.secretlintignore` (if added):
  `chore: add staged-only pre-commit hook (secretlint/oxlint/oxfmt)`.

### 7. Prove it (required — do not skip)
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

- Also sanity-check: staging only non-JS/TS files (e.g. a markdown file, with secretlint
  finding nothing) → silent exit 0; and a real commit through `git commit` triggers the hook.
- **Restore every test file to its original state** (`git restore` / `git checkout`) so the repo
  is left exactly as found apart from the intended hook install.

Report what passed with the actual `out`/`rc` values — no unverified success claims.

## Notes
- The hook targets macOS `/bin/bash` 3.2 (no arrays/mapfile). Do not "modernize" it.
- Every tool resolves from `./node_modules/.bin` first, falling back to PATH only if not
  installed locally — that's why step 2 (`pnpm add -D ...`) matters even though the hook
  still runs without it.
- Missing tools produce a one-line stderr warning and **pass** — they never block a commit.
- secretlint scans all staged files (respecting `.secretlintignore`); oxlint/oxfmt only
  staged JS/TS (`.js .jsx .ts .tsx .mjs .cjs .mts .cts`). No staged JS/TS → those two
  silently pass.
