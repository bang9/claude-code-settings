#!/bin/bash

# =============================================================================
# Claude Code Custom Statusline
# =============================================================================

set -o pipefail

# -----------------------------------------------------------------------------
# Constants
# -----------------------------------------------------------------------------

GREEN='\033[1;32m'
YELLOW='\033[1;93m'
RED='\033[1;31m'
BLUE='\033[1;34m'
DIM='\033[2m'
NORMAL='\033[22m'
RESET='\033[0m'

STATUSLINE_DEBUG=${STATUSLINE_DEBUG:-0}
STATUSLINE_LOG="$HOME/.claude/statusline-debug.log"

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
  local color=$3

  local bar=""
  [[ "$used_bars" -gt 0 ]] && bar+="${color}$(printf '█%.0s' $(seq 1 $used_bars))${RESET}"
  [[ "$free_bars" -gt 0 ]] && bar+="${DIM}${color}$(printf '░%.0s' $(seq 1 $free_bars))${NORMAL}${RESET}"
  echo "$bar"
}

build_git_status() {
  local staged=$1 modified=$2 deleted=$3 untracked=$4

  local status=""
  [[ "$staged"    -gt 0 ]] && status+="${GREEN}${staged}${RESET}·"
  [[ "$modified"  -gt 0 ]] && status+="${YELLOW}${modified}${RESET}·"
  [[ "$deleted"   -gt 0 ]] && status+="${RED}${deleted}${RESET}·"
  [[ "$untracked" -gt 0 ]] && status+="${BLUE}${untracked}${RESET}·"

  [[ -n "$status" ]] && echo " (${status%·})" || echo ""
}

format_rate_limit() {
  local pct=$1 reset_ts=$2 label=$3

  [[ "$pct" == "-1" || "$pct" == "null" ]] && return

  local remaining=$(( 100 - ${pct%.*} ))
  local reset_fmt=""

  if [[ "$reset_ts" -gt 0 ]]; then
    if [[ "$label" == "[5h]" ]]; then
      reset_fmt=$(LC_TIME=en_US.UTF-8 date -r "$reset_ts" '+%-I:%M %p')
    else
      reset_fmt=$(LC_TIME=en_US.UTF-8 date -r "$reset_ts" '+%-m/%-d %-I:%M %p')
    fi
  fi

  if [[ -n "$reset_fmt" ]]; then
    printf "${label} %d%% ${DIM}(%s)${NORMAL}" "$remaining" "$reset_fmt"
  else
    printf "${label} %d%%" "$remaining"
  fi
}

# -----------------------------------------------------------------------------
# Parse Input
# -----------------------------------------------------------------------------

input=$(cat)

if [[ "$STATUSLINE_DEBUG" == "1" ]]; then
  {
    echo "=== $(date '+%Y-%m-%d %H:%M:%S') ==="
    echo "$input" | jq '.' 2>/dev/null || echo "$input"
  } >> "$STATUSLINE_LOG"
fi

IFS=$'\t' read -r model total_input_tokens context_percent session_cost \
  rl_5h_pct rl_5h_reset rl_7d_pct rl_7d_reset <<< \
  "$(echo "$input" | jq -r '[
    (.model.display_name // "Sonnet 4"),
    (.context_window.total_input_tokens // 0),
    (.context_window.used_percentage // 0),
    (.cost.total_cost_usd // 0),
    (.rate_limits.five_hour.used_percentage // -1),
    (.rate_limits.five_hour.resets_at // 0),
    (.rate_limits.seven_day.used_percentage // -1),
    (.rate_limits.seven_day.resets_at // 0)
  ] | @tsv' 2>/dev/null)"

total_input_tokens=${total_input_tokens:-0}
context_percent=${context_percent:-0}
session_cost=${session_cost:-0}
rl_5h_pct=${rl_5h_pct:-"-1"}
rl_5h_reset=${rl_5h_reset:-0}
rl_7d_pct=${rl_7d_pct:-"-1"}
rl_7d_reset=${rl_7d_reset:-0}

if [[ "$STATUSLINE_DEBUG" == "1" ]]; then
  {
    echo "--- model=$model tokens=$total_input_tokens used=$context_percent% cost=$session_cost ---"
    echo ""
  } >> "$STATUSLINE_LOG"
fi

# -----------------------------------------------------------------------------
# Context Window
# -----------------------------------------------------------------------------

filled_bars=$(( (context_percent * BAR_WIDTH + 99) / 100 ))
[[ "$filled_bars" -gt "$BAR_WIDTH" ]] && filled_bars=$BAR_WIDTH
free_bars=$((BAR_WIDTH - filled_bars))

context_color=$(get_context_color "$context_percent")
bar=$(build_progress_bar "$filled_bars" "$free_bars" "$context_color")

# -----------------------------------------------------------------------------
# Git Info
# -----------------------------------------------------------------------------

branch=$(git branch --show-current 2>/dev/null || echo "no-git")
staged=$(git diff --cached --name-only 2>/dev/null | wc -l | tr -d ' ')
modified=$(git diff --name-only --diff-filter=M 2>/dev/null | wc -l | tr -d ' ')
deleted=$(git diff --name-only --diff-filter=D 2>/dev/null | wc -l | tr -d ' ')
untracked=$(git ls-files --others --exclude-standard 2>/dev/null | wc -l | tr -d ' ')
git_status=$(build_git_status "$staged" "$modified" "$deleted" "$untracked")

# -----------------------------------------------------------------------------
# Rate Limits
# -----------------------------------------------------------------------------

rate_info=""
rl_5h=$(format_rate_limit "$rl_5h_pct" "$rl_5h_reset" "5h")
rl_7d=$(format_rate_limit "$rl_7d_pct" "$rl_7d_reset" "7d")

if [[ -n "$rl_5h" || -n "$rl_7d" ]]; then
  rate_info=" | ⏳ "
  [[ -n "$rl_5h" ]] && rate_info+="$rl_5h"
  [[ -n "$rl_5h" && -n "$rl_7d" ]] && rate_info+=" · "
  [[ -n "$rl_7d" ]] && rate_info+="$rl_7d"
fi

# -----------------------------------------------------------------------------
# Output
# -----------------------------------------------------------------------------

formatted_tokens=$(format_tokens "$total_input_tokens")
session_cost_fmt=$(printf "\$%.2f" "$session_cost")

output="🤖 ${model} ${bar} ${context_color}${context_percent}%${RESET} ${DIM}(${formatted_tokens})${NORMAL}${RESET}"
output+=" | 💰 ${session_cost_fmt}"
output+=" | 🌿 ${branch}${git_status}"
output+="${rate_info}"

echo -e "$output"
