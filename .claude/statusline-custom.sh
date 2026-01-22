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

# Cache settings
OUTPUT_CACHE="/tmp/claude-statusline-cache.json"
LOCK_FILE="/tmp/claude-statusline-cache.lock"
TTL=$((7 * 24 * 60 * 60))  # 1 week

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
    local compact_bars=$1
    local used_bars=$2
    local free_bars=$3
    local context_color=$4

    local bar=""
    [[ "$compact_bars" -gt 0 ]] && bar+="${MAGENTA}$(printf '█%.0s' $(seq 1 $compact_bars))${RESET}"
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

model=$(echo "$input" | jq -r '.model.display_name // "Sonnet 4"' 2>/dev/null)
session_id=$(echo "$input" | jq -r '.session_id // "unknown"' 2>/dev/null)
context_window_size=$(echo "$input" | jq -r '.context_window.context_window_size // 200000' 2>/dev/null)
cache_creation=$(echo "$input" | jq -r '.context_window.current_usage.cache_creation_input_tokens // 0' 2>/dev/null)
cache_read=$(echo "$input" | jq -r '.context_window.current_usage.cache_read_input_tokens // 0' 2>/dev/null)
session_cost=$(echo "$input" | jq -r '.cost.total_cost_usd // 0' 2>/dev/null)

# Ensure numeric values
cache_creation=${cache_creation:-0}
cache_read=${cache_read:-0}
context_window_size=${context_window_size:-200000}
session_cost=${session_cost:-0}

# -----------------------------------------------------------------------------
# Cache: Return cached output if no new data
# -----------------------------------------------------------------------------

if [[ "$cache_creation" -eq 0 && "$cache_read" -eq 0 ]]; then
    if [[ -f "$OUTPUT_CACHE" ]]; then
        (
            flock -s 200
            entry=$(jq -r --arg sid "$session_id" '.[$sid] // empty' "$OUTPUT_CACHE" 2>/dev/null)
            if [[ -n "$entry" ]]; then
                ts=$(echo "$entry" | jq -r '.ts // 0')
                if (( NOW - ts < TTL )); then
                    echo -e "$(echo "$entry" | jq -r '.out')"
                fi
            fi
        ) 200>"$LOCK_FILE"
    fi
    exit 0
fi

# -----------------------------------------------------------------------------
# Calculate Context Usage
# -----------------------------------------------------------------------------

auto_compact=$(jq -r '.autoCompactEnabled // true' ~/.claude.json 2>/dev/null)
if [[ "$auto_compact" == "false" ]]; then
    compact_buffer=0
else
    compact_buffer=$((context_window_size * 225 / 1000))
fi

used_context=$((cache_creation + cache_read))
total_context=$((used_context + compact_buffer))

if [[ "$context_window_size" -gt 0 ]]; then
    context_percent=$((total_context * 100 / context_window_size))
else
    context_percent=0
fi

# -----------------------------------------------------------------------------
# Build Progress Bar
# -----------------------------------------------------------------------------

filled_bars=$((context_percent * BAR_WIDTH / 100))
[[ "$filled_bars" -gt "$BAR_WIDTH" ]] && filled_bars=$BAR_WIDTH

if [[ "$total_context" -gt 0 ]]; then
    compact_bars=$((compact_buffer * filled_bars / total_context))
else
    compact_bars=0
fi
[[ "$compact_bars" -lt 1 && "$compact_buffer" -gt 0 && "$filled_bars" -gt 0 ]] && compact_bars=1
[[ "$compact_bars" -gt "$filled_bars" ]] && compact_bars=$filled_bars

used_bars=$((filled_bars - compact_bars))
free_bars=$((BAR_WIDTH - filled_bars))

context_color=$(get_context_color "$context_percent")
bar=$(build_progress_bar "$compact_bars" "$used_bars" "$free_bars" "$context_color")

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

formatted_tokens=$(format_tokens "$total_context")
session_cost_fmt=$(printf "\$%.2f" "$session_cost")

output="🤖 ${model} ${bar} ${context_color}${context_percent}%${RESET} ${DIM}(${formatted_tokens})${NORMAL}${RESET} | 💰 ${session_cost_fmt} | 🌿 ${branch}${git_status}"

# -----------------------------------------------------------------------------
# Save to Cache
# -----------------------------------------------------------------------------

(
    flock -x 200
    if [[ -f "$OUTPUT_CACHE" ]]; then
        jq --arg sid "$session_id" --arg out "$output" --argjson ts "$NOW" --argjson ttl "$TTL" \
            'to_entries | map(select(.value.ts > ($ts - $ttl))) | from_entries | .[$sid] = {out: $out, ts: $ts}' \
            "$OUTPUT_CACHE" > "${OUTPUT_CACHE}.tmp" && mv "${OUTPUT_CACHE}.tmp" "$OUTPUT_CACHE"
    else
        jq -n --arg sid "$session_id" --arg out "$output" --argjson ts "$NOW" \
            '{($sid): {out: $out, ts: $ts}}' > "$OUTPUT_CACHE"
    fi
) 200>"$LOCK_FILE"

echo -e "$output"
