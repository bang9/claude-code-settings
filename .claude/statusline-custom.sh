#!/bin/bash

# =============================================================================
# Claude Code Custom Statusline
# =============================================================================

set -o pipefail

# -----------------------------------------------------------------------------
# Constants
# -----------------------------------------------------------------------------

# Colors
GREEN='\033[1;32m'
YELLOW='\033[1;93m'
RED='\033[1;31m'
BLUE='\033[1;34m'
MAGENTA='\033[1;35m'
DIM='\033[2m'
NORMAL='\033[22m'
RESET='\033[0m'

# Debug mode: set STATUSLINE_DEBUG=1 to enable logging
STATUSLINE_DEBUG=${STATUSLINE_DEBUG:-0}
STATUSLINE_LOG="$HOME/.claude/statusline-debug.log"

# Bar settings
BAR_WIDTH=10

# -----------------------------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------------------------

format_tokens() {
  local tokens=$1
  if [[ "$tokens" -ge 1000000 ]]; then
    printf "%.1fM" "$(echo "scale=1; $tokens / 1000000" | bc)"
  elif [[ "$tokens" -ge 1000 ]]; then
    printf "%.1fk" "$(echo "scale=1; $tokens / 1000" | bc)"
  else
    echo "$tokens"
  fi
}

get_context_color() {
  local percent=$1
  if [[ "$percent" -lt 50 ]]; then
    echo "$GREEN"
  elif [[ "$percent" -lt 80 ]]; then
    echo "$YELLOW"
  else
    echo "$RED"
  fi
}

build_progress_bar() {
  local used_bars=$1
  local free_bars=$2
  local context_color=$3

  local bar=""
  [[ "$used_bars" -gt 0 ]] && bar+="${context_color}$(printf '█%.0s' $(seq 1 $used_bars))${RESET}"
  [[ "$free_bars" -gt 0 ]] && bar+="${DIM}${context_color}$(printf '░%.0s' $(seq 1 $free_bars))${NORMAL}${RESET}"
  echo "$bar"
}

build_git_status() {
  local staged=$1
  local modified=$2
  local deleted=$3
  local untracked=$4

  local status=""
  [[ "$staged" -gt 0 ]] && status+="${GREEN}${staged}${RESET}·"
  [[ "$modified" -gt 0 ]] && status+="${YELLOW}${modified}${RESET}·"
  [[ "$deleted" -gt 0 ]] && status+="${RED}${deleted}${RESET}·"
  [[ "$untracked" -gt 0 ]] && status+="${BLUE}${untracked}${RESET}·"

  [[ -n "$status" ]] && echo " (${status%·})" || echo ""
}

# -----------------------------------------------------------------------------
# Parse Input
# -----------------------------------------------------------------------------

input=$(cat)
NOW=$(date +%s)

# Debug: dump raw JSON input
if [[ "$STATUSLINE_DEBUG" == "1" ]]; then
  {
    echo "=== $(date '+%Y-%m-%d %H:%M:%S') ==="
    echo "--- RAW JSON ---"
    echo "$input" | jq '.' 2>/dev/null || echo "$input"
    echo "--- CONTEXT_WINDOW FIELDS ---"
    echo "$input" | jq '.context_window' 2>/dev/null
  } >> "$STATUSLINE_LOG"
fi

IFS=$'\t' read -r model total_input_tokens context_window_size context_percent session_cost <<< \
  "$(echo "$input" | jq -r '[
    (.model.display_name // "Sonnet 4"),
    (.context_window.total_input_tokens // 0),
    (.context_window.context_window_size // 200000),
    (.context_window.used_percentage // 0),
    (.cost.total_cost_usd // 0)
  ] | @tsv' 2>/dev/null)"

# Ensure numeric values
total_input_tokens=${total_input_tokens:-0}
context_window_size=${context_window_size:-200000}
context_percent=${context_percent:-0}
session_cost=${session_cost:-0}

# Debug: log values
if [[ "$STATUSLINE_DEBUG" == "1" ]]; then
  {
    echo "--- PARSED VALUES ---"
    echo "model=$model"
    echo "total_input_tokens=$total_input_tokens"
    echo "context_window_size=$context_window_size"
    echo "context_percent=$context_percent% (from API used_percentage)"
    echo "session_cost=$session_cost"
    echo ""
  } >> "$STATUSLINE_LOG"
fi

# -----------------------------------------------------------------------------
# Build Progress Bar
# -----------------------------------------------------------------------------

filled_bars=$(( (context_percent * BAR_WIDTH + 99) / 100 ))
[[ "$filled_bars" -gt "$BAR_WIDTH" ]] && filled_bars=$BAR_WIDTH
free_bars=$((BAR_WIDTH - filled_bars))

context_color=$(get_context_color "$context_percent")
bar=$(build_progress_bar "$filled_bars" "$free_bars" "$context_color")

# -----------------------------------------------------------------------------
# Build Git Info
# -----------------------------------------------------------------------------

branch=$(git branch --show-current 2>/dev/null || echo "no-git")
staged=$(git diff --cached --name-only 2>/dev/null | wc -l | tr -d ' ')
modified=$(git diff --name-only --diff-filter=M 2>/dev/null | wc -l | tr -d ' ')
deleted=$(git diff --name-only --diff-filter=D 2>/dev/null | wc -l | tr -d ' ')
untracked=$(git ls-files --others --exclude-standard 2>/dev/null | wc -l | tr -d ' ')

git_status=$(build_git_status "$staged" "$modified" "$deleted" "$untracked")

# -----------------------------------------------------------------------------
# Build Output
# -----------------------------------------------------------------------------

formatted_tokens=$(format_tokens "$total_input_tokens")
session_cost_fmt=$(printf "\$%.2f" "$session_cost")

output="🤖 ${model} ${bar} ${context_color}${context_percent}%${RESET} ${DIM}(${formatted_tokens})${NORMAL}${RESET} | 💰 ${session_cost_fmt} | 🌿 ${branch}${git_status}"

echo -e "$output"
