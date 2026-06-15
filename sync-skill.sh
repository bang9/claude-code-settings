#!/usr/bin/env bash
#
# sync-skill.sh — sync this repo's skills into user-level skill directories.
#
# For each skill under <repo>/.claude/skills, the matching skill in every
# target directory is removed and replaced with a fresh copy. Sync is
# per-skill: other skills already present in the targets are left untouched
# (no whole-directory overwrite).
#
# Usage:
#   ./sync-skill.sh                 # sync every skill in the repo
#   ./sync-skill.sh problem-solver  # sync only the named skill(s)
#   ./sync-skill.sh --dry-run       # show what would happen, change nothing
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$SCRIPT_DIR/.claude/skills"

TARGETS=(
  "$HOME/.claude/skills"
  "$HOME/.codex/skills"
)

DRY_RUN=0
SKILL_ARGS=()
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help)
      sed -n '3,17p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    -*) echo "unknown option: $arg" >&2; exit 2 ;;
    *) SKILL_ARGS+=("$arg") ;;
  esac
done

[ -d "$SRC_DIR" ] || { echo "source skills dir not found: $SRC_DIR" >&2; exit 1; }

# Resolve the skill list: explicit args, or every skill dir in the repo.
SKILLS=()
if [ "${#SKILL_ARGS[@]}" -gt 0 ]; then
  SKILLS=("${SKILL_ARGS[@]}")
else
  for d in "$SRC_DIR"/*/; do
    [ -d "$d" ] || continue
    SKILLS+=("$(basename "$d")")
  done
fi

[ "${#SKILLS[@]}" -gt 0 ] || { echo "no skills to sync in $SRC_DIR" >&2; exit 1; }

run() { if [ "$DRY_RUN" -eq 1 ]; then echo "  [dry-run] $*"; else "$@"; fi; }

echo "Source : $SRC_DIR"
echo "Skills : ${SKILLS[*]}"
[ "$DRY_RUN" -eq 1 ] && echo "(dry-run — no changes will be made)"

for target in "${TARGETS[@]}"; do
  echo ""
  echo "→ $target"
  run mkdir -p "$target"
  for skill in "${SKILLS[@]}"; do
    src="$SRC_DIR/$skill"
    if [ ! -d "$src" ]; then
      echo "  ! skip '$skill' — not found in repo" >&2
      continue
    fi
    dest="$target/$skill"
    run rm -rf "$dest"
    run cp -R "$src" "$dest"
    echo "  ✓ $skill"
  done
done

echo ""
echo "Done."
