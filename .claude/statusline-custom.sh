#!/bin/bash

# Read JSON input from stdin
input=$(cat)

# Color codes
GREEN='\033[1;32m'
YELLOW='\033[1;93m'
RED='\033[1;31m'
BLUE='\033[1;34m'
MAGENTA='\033[1;35m'
DIM='\033[2m'
RESET='\033[0m'

# Get model name and session ID from JSON
model=$(echo "$input" | jq -r '.model.display_name // "Sonnet 4"' 2>/dev/null)
session_id=$(echo "$input" | jq -r '.session_id // "unknown"' 2>/dev/null)

# Extract context window data directly from stdin
context_window_size=$(echo "$input" | jq -r '.context_window.context_window_size // 200000' 2>/dev/null)
cache_creation=$(echo "$input" | jq -r '.context_window.current_usage.cache_creation_input_tokens // 0' 2>/dev/null)
cache_read=$(echo "$input" | jq -r '.context_window.current_usage.cache_read_input_tokens // 0' 2>/dev/null)

# Extract cost data
session_cost=$(echo "$input" | jq -r '.cost.total_cost_usd // 0' 2>/dev/null)

# Ensure numeric values (fallback to 0 if empty)
cache_creation=${cache_creation:-0}
cache_read=${cache_read:-0}
context_window_size=${context_window_size:-200000}
session_cost=${session_cost:-0}

# Single cache file for all sessions
OUTPUT_CACHE="/tmp/claude-statusline-cache.json"
NOW=$(date +%s)
TTL=$((7 * 24 * 60 * 60))  # 1 week in seconds

# Lock file for safe concurrent access
LOCK_FILE="/tmp/claude-statusline-cache.lock"

# If cache values are 0, output cached result and exit
if [[ "$cache_creation" -eq 0 && "$cache_read" -eq 0 ]]; then
    if [[ -f "$OUTPUT_CACHE" ]]; then
        (
            flock -s 200  # shared lock for reading
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

# Check if autoCompact is enabled in Claude Code settings (default: true)
auto_compact=$(jq -r '.autoCompactEnabled // true' ~/.claude.json 2>/dev/null)

# Compact buffer only if autoCompact is enabled (~22.5% of context window)
if [[ "$auto_compact" == "false" ]]; then
    COMPACT_BUFFER=0
else
    COMPACT_BUFFER=$((context_window_size * 225 / 1000))
fi

# Calculate actual context usage
used_context=$((cache_creation + cache_read))
total_context=$((used_context + COMPACT_BUFFER))

# Calculate percentages
if [[ "$context_window_size" -gt 0 ]]; then
    used_percent=$((used_context * 100 / context_window_size))
    compact_percent=$((COMPACT_BUFFER * 100 / context_window_size))
    context_num=$((total_context * 100 / context_window_size))
else
    used_percent=0
    compact_percent=0
    context_num=0
fi

# Determine color based on thresholds
if [[ "$context_num" -lt 50 ]]; then
    CONTEXT_COLOR="$GREEN"
elif [[ "$context_num" -lt 80 ]]; then
    CONTEXT_COLOR="$YELLOW"
else
    CONTEXT_COLOR="$RED"
fi

# Format token counts (k for thousands, M for millions)
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

# Build context bar (10 chars width): autocompact (magenta) + used + free
bar_width=10

# First calculate total filled bars based on context_num (ensures visual accuracy)
filled_bars=$((context_num * bar_width / 100))
[[ "$filled_bars" -gt "$bar_width" ]] && filled_bars=$bar_width

# Then split filled bars between compact and used proportionally
if [[ "$total_context" -gt 0 ]]; then
    compact_bars=$((COMPACT_BUFFER * filled_bars / total_context))
else
    compact_bars=0
fi
[[ "$compact_bars" -lt 1 && "$COMPACT_BUFFER" -gt 0 && "$filled_bars" -gt 0 ]] && compact_bars=1
[[ "$compact_bars" -gt "$filled_bars" ]] && compact_bars=$filled_bars
used_bars=$((filled_bars - compact_bars))
free_bars=$((bar_width - filled_bars))

# Build bar: █ (autocompact/magenta) + █ (used) + ░ (free)
bar_compact="${MAGENTA}$(printf '█%.0s' $(seq 1 $compact_bars 2>/dev/null) 2>/dev/null || echo '')${RESET}"
bar_used="${CONTEXT_COLOR}$(printf '█%.0s' $(seq 1 $used_bars 2>/dev/null) 2>/dev/null || echo '')${RESET}"
bar_free="${DIM}${CONTEXT_COLOR}$(printf '░%.0s' $(seq 1 $free_bars 2>/dev/null) 2>/dev/null || echo '')${RESET}"
bar="${bar_compact}${bar_used}${bar_free}"

# Format cost
session_cost_fmt=$(printf "\$%.2f" "$session_cost")

# Build base part with context bar
formatted_tokens=$(format_tokens "$total_context")
base_part="🤖 ${model} ${bar} ${CONTEXT_COLOR}${context_num}%${RESET} ${DIM}(${formatted_tokens})${RESET} | 💰 ${session_cost_fmt}"

# Add git info
branch=$(git branch --show-current 2>/dev/null || echo "no-git")

# Get git counts
staged=$(git diff --cached --name-only 2>/dev/null | wc -l | tr -d ' ')
modified=$(git diff --name-only --diff-filter=M 2>/dev/null | wc -l | tr -d ' ')
deleted=$(git diff --name-only --diff-filter=D 2>/dev/null | wc -l | tr -d ' ')
untracked=$(git ls-files --others --exclude-standard 2>/dev/null | wc -l | tr -d ' ')

# Build git status
git_status=""
[[ "$staged" -gt 0 ]] && git_status="${git_status}${GREEN}${staged}${RESET}·"
[[ "$modified" -gt 0 ]] && git_status="${git_status}${YELLOW}${modified}${RESET}·"
[[ "$deleted" -gt 0 ]] && git_status="${git_status}${RED}${deleted}${RESET}·"
[[ "$untracked" -gt 0 ]] && git_status="${git_status}${BLUE}${untracked}${RESET}·"

if [[ -n "$git_status" ]]; then
    git_status=" (${git_status%·})"
fi

# Build final output
output="$base_part | 🌿 $branch$git_status"

# Save to JSON cache (session_id as key, with timestamp)
(
    flock -x 200  # exclusive lock for writing
    if [[ -f "$OUTPUT_CACHE" ]]; then
        # Update entry and clean expired entries
        jq --arg sid "$session_id" --arg out "$output" --argjson ts "$NOW" --argjson ttl "$TTL" \
            'to_entries | map(select(.value.ts > ($ts - $ttl))) | from_entries | .[$sid] = {out: $out, ts: $ts}' \
            "$OUTPUT_CACHE" > "${OUTPUT_CACHE}.tmp" && mv "${OUTPUT_CACHE}.tmp" "$OUTPUT_CACHE"
    else
        jq -n --arg sid "$session_id" --arg out "$output" --argjson ts "$NOW" '{($sid): {out: $out, ts: $ts}}' > "$OUTPUT_CACHE"
    fi
) 200>"$LOCK_FILE"

echo -e "$output"
