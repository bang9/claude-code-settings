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
RESET='\033[0m'

# Get model name from JSON
model=$(echo "$input" | jq -r '.model.display_name // "Sonnet 4"' 2>/dev/null)

# Get ccusage output
ccusage_full=$(echo "$input" | npx -y ccusage@latest statusline --no-offline 2>/dev/null || echo "")

# If ccusage fails or returns invalid data, use fallback
if [[ -z "$ccusage_full" || "$ccusage_full" =~ \.sh ]]; then
    base_part="🤖 ${model}${GREEN}(0%)${RESET} | 💰 \$0.00 session / \$0.00 today"
else
    # Extract percentage number from ccusage 🧠 section (e.g., "🧠 39,837 (20%)" → "20")
    context_num=$(echo "$ccusage_full" | grep -oE '🧠[^|]+' | grep -oE '\([0-9]+%\)' | grep -oE '[0-9]+')

    # Determine color based on ccusage thresholds
    if [[ "$context_num" -lt 50 ]]; then
        CONTEXT_COLOR="$GREEN"
    elif [[ "$context_num" -lt 80 ]]; then
        CONTEXT_COLOR="$YELLOW"
    else
        CONTEXT_COLOR="$RED"
    fi

    # Extract cost info (everything after 💰 up to today)
    cost_part=$(echo "$ccusage_full" | sed 's/.*💰/💰/' | sed 's/\(.*today\).*/\1/')

    # Handle N/A session (resume case)
    if [[ "$cost_part" =~ N/A[[:space:]]*session ]]; then
        cost_part=$(echo "$cost_part" | sed 's/N\/A session/\$0.00 session/')
    fi

    base_part="🤖 ${model}${CONTEXT_COLOR}(${context_num}%)${RESET} | ${cost_part}"
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
