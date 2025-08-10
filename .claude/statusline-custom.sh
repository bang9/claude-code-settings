#!/bin/bash

# Read JSON input
input=$(cat)

# Get ccusage output first - this was working fine
ccusage_full=$(echo "$input" | npx -y ccusage@latest statusline 2>/dev/null || echo "")

# If ccusage fails or returns invalid data, use fallback
if [[ -z "$ccusage_full" || "$ccusage_full" =~ \.sh ]]; then
    # Fallback: get model from JSON and use defaults
    model=$(echo "$input" | jq -r '.model.display_name // "Sonnet 4"' 2>/dev/null)
    base_part="🤖 $model | 💰 $0.00 session / $0.00 today"
else
    # ccusage worked, check if session shows N/A (new session) or has actual cost
    if [[ "$ccusage_full" =~ N/A[[:space:]]*session ]]; then
        # New session (resume case) - replace N/A with $0.00
        base_part=$(echo "$ccusage_full" | sed 's/N\/A session/\$0.00 session/')
    else
        # Ongoing session - keep ccusage output as is
        base_part="$ccusage_full"
    fi
    
    # Remove the block and rate info (everything after "today")  
    base_part=$(echo "$base_part" | sed 's/\(.*today\).*/\1/')
fi

# Add git info
branch=$(git branch --show-current 2>/dev/null || echo "no-git")

# Color codes
GREEN='\033[1;32m'
YELLOW='\033[1;93m'
RED='\033[1;31m'
BLUE='\033[1;34m'
RESET='\033[0m'

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