#!/bin/bash

# Read JSON input
input=$(cat)

# Debug: save JSON for inspection
echo "$input" > /tmp/claude-statusline-input.json

# Color codes
GREEN='\033[1;32m'
YELLOW='\033[1;93m'
RED='\033[1;31m'
BLUE='\033[1;34m'
CYAN='\033[1;36m'
DIM='\033[2m'
RESET='\033[0m'

# Get model name from JSON
model=$(echo "$input" | jq -r '.model.display_name // "Sonnet 4"' 2>/dev/null)

# Extract context window data directly from stdin (Claude HUD approach)
total_input_tokens=$(echo "$input" | jq -r '.context_window.total_input_tokens // 0' 2>/dev/null)
context_window_size=$(echo "$input" | jq -r '.context_window.context_window_size // 200000' 2>/dev/null)
cache_creation=$(echo "$input" | jq -r '.context_window.current_usage.cache_creation_input_tokens // 0' 2>/dev/null)
cache_read=$(echo "$input" | jq -r '.context_window.current_usage.cache_read_input_tokens // 0' 2>/dev/null)

# Extract cost data
session_cost=$(echo "$input" | jq -r '.cost.total_cost_usd // 0' 2>/dev/null)

# Calculate context usage percentage
if [[ "$context_window_size" -gt 0 ]]; then
    context_num=$((total_input_tokens * 100 / context_window_size))
else
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

# Build context bar (10 chars width)
bar_width=10
filled=$((context_num * bar_width / 100))
[[ "$filled" -gt "$bar_width" ]] && filled=$bar_width
empty=$((bar_width - filled))
bar="${CONTEXT_COLOR}$(printf '█%.0s' $(seq 1 $filled 2>/dev/null) || echo '')${DIM}$(printf '░%.0s' $(seq 1 $empty 2>/dev/null) || echo '')${RESET}"

# Format cost
session_cost_fmt=$(printf "\$%.2f" "$session_cost")

# Build base part with context bar
formatted_tokens=$(format_tokens "$total_input_tokens")
base_part="🤖 ${model} ${bar} ${CONTEXT_COLOR}${context_num}%${RESET} ${DIM}(${formatted_tokens})${RESET} | 💰 ${session_cost_fmt}"

# Show cache info if significant (>1000 tokens)
total_cache=$((cache_creation + cache_read))
if [[ "$total_cache" -gt 1000 ]]; then
    cache_fmt=$(format_tokens "$total_cache")
    base_part="${base_part} ${DIM}cache:${cache_fmt}${RESET}"
fi

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

echo -e "$base_part | 🌿 $branch$git_status"
