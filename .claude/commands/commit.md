# /commit

Generate Conventional Commits message, commit only what's staged.

Always run in parallel: `git status --short`, `git log --oneline -10`.

Add `git diff` if ANY of:
- conversation lacks recent change context
- staged files not touched in this conversation
- type unclear from paths
- `$ARGUMENTS` contains `full`/`전체`/`자세히`

`$ARGUMENTS` is a free-form hint — empty=auto; `full`/`전체`/`자세히`=force diff; free text=message/type hint (actual changes win on conflict).

Output: single line only, `type[(scope)]: description`. No body, no multi-line. Scope only if `git log` majority uses it.

Commit: HEREDOC, no auto-stage, no `Co-authored-by` trailer.
