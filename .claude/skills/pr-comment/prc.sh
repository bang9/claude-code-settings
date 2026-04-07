#!/usr/bin/env bash
set -euo pipefail

PRC_DIR="$HOME/.prc"

die() { echo "error: $*" >&2; exit 1; }
die_validation() { echo "validation: $*" >&2; exit 1; }
die_api() { echo "api: $*" >&2; exit 2; }

# Get owner/repo from git remote
get_repo_info() {
  local remote
  remote=$(git remote get-url origin 2>/dev/null) || die "not a git repo or no origin remote"
  # Handle SSH (git@github.com:owner/repo.git) and HTTPS (https://github.com/owner/repo.git)
  echo "$remote" | sed -E 's#^(git@github\.com:|https://github\.com/)##; s/\.git$//'
}

# Get project dir: ~/.prc/{owner}-{repo}
get_project_dir() {
  local repo_info
  repo_info=$(get_repo_info)
  local owner repo
  owner=$(echo "$repo_info" | cut -d/ -f1)
  repo=$(echo "$repo_info" | cut -d/ -f2)
  echo "${PRC_DIR}/${owner}-${repo}"
}

# Find active (draft) session for current branch, or empty string
find_active_session() {
  local project_dir branch
  project_dir=$(get_project_dir)
  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || die "not a git repo"
  # Sanitize branch name for filename (replace / with -)
  local safe_branch="${branch//\//-}"

  if [[ ! -d "$project_dir" ]]; then
    echo ""
    return
  fi

  # Find most recent draft session for this branch
  local latest=""
  for f in "${project_dir}/${safe_branch}"-*.json; do
    [[ -f "$f" ]] || continue
    local status
    status=$(jq -r '.review.status' "$f" 2>/dev/null) || continue
    if [[ "$status" == "draft" ]]; then
      latest="$f"
    fi
  done
  echo "$latest"
}

# Require an active session, exit if none
ensure_session() {
  local session
  session=$(find_active_session)
  if [[ -z "$session" ]]; then
    die "no active session. run: prc.sh init"
  fi
  echo "$session"
}

# Next comment ID (max existing + 1)
next_comment_id() {
  local session="$1"
  local max_id
  max_id=$(jq '[.comments[].id] | (max // 0)' "$session")
  echo $((max_id + 1))
}

cmd_init() {
  local repo_info
  repo_info=$(get_repo_info)
  local owner repo
  owner=$(echo "$repo_info" | cut -d/ -f1)
  repo=$(echo "$repo_info" | cut -d/ -f2)

  # Check for existing active session
  local existing
  existing=$(find_active_session)
  if [[ -n "$existing" ]]; then
    echo "Active session exists: $existing"
    return 0
  fi

  # Detect PR
  local pr_json
  pr_json=$(gh pr view --json number,headRefBranch 2>/dev/null) || die "no PR found for current branch. push and create a PR first"
  local pr_number branch
  pr_number=$(echo "$pr_json" | jq -r '.number')
  branch=$(echo "$pr_json" | jq -r '.headRefBranch')

  # Create session directory
  local project_dir
  project_dir=$(get_project_dir)
  mkdir -p "$project_dir"

  # Create session file
  local safe_branch="${branch//\//-}"
  local timestamp
  timestamp=$(date +%Y%m%d-%H%M)
  local session_file="${project_dir}/${safe_branch}-${timestamp}.json"

  jq -n \
    --argjson number "$pr_number" \
    --arg owner "$owner" \
    --arg repo "$repo" \
    --arg branch "$branch" \
    '{
      pr: { number: $number, owner: $owner, repo: $repo, branch: $branch },
      review: { id: null, status: "draft", submitted_event: null },
      comments: []
    }' > "$session_file"

  echo "Session created: $session_file"

  # Auto-sync: pull existing pending review comments if any
  if sync_result=$(_sync_pending_review "$session_file" 2>/dev/null); then
    echo "Auto-synced: ${sync_result}"
  fi
}

cmd_validate() {
  local session="${1:-}"
  if [[ -z "$session" ]]; then
    session=$(ensure_session)
  fi

  local errors=""

  # Check file is valid JSON
  if ! jq empty "$session" 2>/dev/null; then
    die_validation "invalid JSON: $session"
  fi

  # Required pr fields
  local pr_check
  pr_check=$(jq -r '
    if (.pr.number | type) != "number" then "pr.number must be a number\n" else "" end +
    if (.pr.owner | type) != "string" or .pr.owner == "" then "pr.owner is required\n" else "" end +
    if (.pr.repo | type) != "string" or .pr.repo == "" then "pr.repo is required\n" else "" end +
    if (.pr.branch | type) != "string" or .pr.branch == "" then "pr.branch is required\n" else "" end
  ' "$session")
  errors="${errors}${pr_check}"

  # Review status
  local review_status
  review_status=$(jq -r '.review.status' "$session")
  if [[ "$review_status" != "draft" && "$review_status" != "submitted" ]]; then
    errors="${errors}review.status must be 'draft' or 'submitted'\n"
  fi

  # Comments validation
  local comment_errors
  comment_errors=$(jq -r '
    .comments | to_entries[] |
    "[\(.key)]" as $idx |
    (
      if (.value.id | type) != "number" or .value.id < 1 then "\($idx) id must be positive integer\n" else "" end +
      if (.value.file | type) != "string" or .value.file == "" then "\($idx) file is required\n" else "" end +
      if (.value.start_line != null and (.value.start_line | type) != "number") then "\($idx) start_line must be null or number\n" else "" end +
      if (.value.line | type) != "number" then "\($idx) line must be a number\n" else "" end +
      if (.value.body | type) != "string" or .value.body == "" then "\($idx) body is required\n" else "" end +
      if (.value.status | IN("draft","pending","submitted") | not) then "\($idx) status must be draft|pending|submitted\n" else "" end +
      if (.value.status == "pending" or .value.status == "submitted") and (.value.github_comment_id == null) then "\($idx) github_comment_id required for pending/submitted\n" else "" end
    )
  ' "$session" 2>/dev/null || echo "")
  errors="${errors}${comment_errors}"

  # Check unique IDs
  local dup_check
  dup_check=$(jq -r '
    [.comments[].id] | group_by(.) | map(select(length > 1)) |
    if length > 0 then "duplicate comment IDs: \(map(.[0]) | join(","))\n" else "" end
  ' "$session")
  errors="${errors}${dup_check}"

  if [[ -n "$errors" ]]; then
    die_validation "$errors"
  fi

  echo "valid"
}

cmd_add() {
  local file="" start_line="" line="" body=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --file) file="$2"; shift 2 ;;
      --start-line) start_line="$2"; shift 2 ;;
      --line) line="$2"; shift 2 ;;
      --body) body="$2"; shift 2 ;;
      *) die "add: unknown option: $1" ;;
    esac
  done

  [[ -n "$file" ]] || die "add: --file is required"
  [[ -n "$line" ]] || die "add: --line is required"
  [[ -n "$body" ]] || die "add: --body is required"

  local session
  session=$(ensure_session)

  # Check session not submitted
  local review_status
  review_status=$(jq -r '.review.status' "$session")
  if [[ "$review_status" == "submitted" ]]; then
    die "session already submitted. run 'init' to start a new session"
  fi

  local new_id
  new_id=$(next_comment_id "$session")

  local sl_arg="null"
  [[ -n "$start_line" ]] && sl_arg="$start_line"

  local tmp
  tmp=$(mktemp)
  jq --argjson id "$new_id" \
     --arg file "$file" \
     --argjson sl "$sl_arg" \
     --argjson line "$line" \
     --arg body "$body" \
     '.comments += [{
       id: $id,
       file: $file,
       start_line: $sl,
       line: $line,
       body: $body,
       status: "draft",
       github_comment_id: null
     }]' "$session" > "$tmp"
  mv "$tmp" "$session"

  cmd_validate "$session" >/dev/null
  local line_display="${file}:${line}"
  [[ "$sl_arg" != "null" ]] && line_display="${file}:${start_line}-${line}"
  echo "Comment #${new_id} added (${line_display})"
}

cmd_update() {
  local comment_id="${1:-}"
  [[ -n "$comment_id" ]] || die "update: comment ID required"
  shift

  local file="" start_line="" line="" body=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --file) file="$2"; shift 2 ;;
      --start-line) start_line="$2"; shift 2 ;;
      --line) line="$2"; shift 2 ;;
      --body) body="$2"; shift 2 ;;
      *) die "update: unknown option: $1" ;;
    esac
  done

  [[ -n "$file" || -n "$start_line" || -n "$line" || -n "$body" ]] || die "update: at least one of --file, --start-line, --line, --body required"

  local session
  session=$(ensure_session)

  # Check comment exists
  local exists
  exists=$(jq --argjson id "$comment_id" '[.comments[] | select(.id == $id)] | length' "$session")
  [[ "$exists" -gt 0 ]] || die "update: comment #${comment_id} not found"

  local tmp
  tmp=$(mktemp)

  local jq_filter='.comments = [.comments[] | if .id == $id then'
  local jq_updates=""
  local jq_args=(--argjson id "$comment_id")

  if [[ -n "$file" ]]; then
    jq_updates="${jq_updates} .file = \$file |"
    jq_args+=(--arg file "$file")
  fi
  if [[ -n "$start_line" ]]; then
    jq_updates="${jq_updates} .start_line = \$sl |"
    jq_args+=(--argjson sl "$start_line")
  fi
  if [[ -n "$line" ]]; then
    jq_updates="${jq_updates} .line = \$line |"
    jq_args+=(--argjson line "$line")
  fi
  if [[ -n "$body" ]]; then
    jq_updates="${jq_updates} .body = \$body |"
    jq_args+=(--arg body "$body")
  fi

  # Remove trailing pipe
  jq_updates="${jq_updates% |}"
  jq_filter="${jq_filter} ${jq_updates} else . end]"

  jq "${jq_args[@]}" "$jq_filter" "$session" > "$tmp"
  mv "$tmp" "$session"

  cmd_validate "$session" >/dev/null

  # If comment is pending, update on GitHub too
  local gh_comment_id status
  gh_comment_id=$(jq -r --argjson id "$comment_id" '.comments[] | select(.id == $id) | .github_comment_id' "$session")
  status=$(jq -r --argjson id "$comment_id" '.comments[] | select(.id == $id) | .status' "$session")

  if [[ "$status" == "pending" && "$gh_comment_id" != "null" && -n "$body" ]]; then
    local owner repo
    owner=$(jq -r '.pr.owner' "$session")
    repo=$(jq -r '.pr.repo' "$session")
    gh api "repos/${owner}/${repo}/pulls/comments/${gh_comment_id}" \
      --method PATCH -f body="$body" >/dev/null 2>&1 || die_api "failed to update GitHub comment"
    echo "Comment #${comment_id} updated (local + GitHub)"
  else
    echo "Comment #${comment_id} updated"
  fi
}

cmd_delete() {
  local comment_id="${1:-}"
  [[ -n "$comment_id" ]] || die "delete: comment ID required"

  local session
  session=$(ensure_session)

  # Check comment exists
  local exists
  exists=$(jq --argjson id "$comment_id" '[.comments[] | select(.id == $id)] | length' "$session")
  [[ "$exists" -gt 0 ]] || die "delete: comment #${comment_id} not found"

  # If pending, delete from GitHub too
  local gh_comment_id status owner repo
  gh_comment_id=$(jq -r --argjson id "$comment_id" '.comments[] | select(.id == $id) | .github_comment_id' "$session")
  status=$(jq -r --argjson id "$comment_id" '.comments[] | select(.id == $id) | .status' "$session")
  owner=$(jq -r '.pr.owner' "$session")
  repo=$(jq -r '.pr.repo' "$session")

  if [[ "$status" == "pending" && "$gh_comment_id" != "null" ]]; then
    gh api "repos/${owner}/${repo}/pulls/comments/${gh_comment_id}" \
      --method DELETE >/dev/null 2>&1 || die_api "failed to delete GitHub comment"
  fi

  local tmp
  tmp=$(mktemp)
  jq --argjson id "$comment_id" '.comments = [.comments[] | select(.id != $id)]' "$session" > "$tmp"
  mv "$tmp" "$session"

  cmd_validate "$session" >/dev/null
  echo "Comment #${comment_id} deleted"
}

cmd_list() {
  local session
  session=$(ensure_session)

  local count
  count=$(jq '.comments | length' "$session")

  if [[ "$count" -eq 0 ]]; then
    echo "No comments"
    return 0
  fi

  printf "%-4s %-8s %-30s %-10s %s\n" "ID" "STATUS" "FILE" "LINE" "BODY"
  printf "%-4s %-8s %-30s %-10s %s\n" "---" "------" "----" "----" "----"
  jq -r '.comments[] | [.id, .status, .file, (.start_line // ""), .line, .body] | @tsv' "$session" | \
    while IFS=$'\t' read -r id status file start_line line body; do
      local short_body="${body:0:50}"
      [[ ${#body} -gt 50 ]] && short_body="${short_body}..."
      local line_display="$line"
      [[ -n "$start_line" ]] && line_display="${start_line}-${line}"
      printf "%-4s %-8s %-30s %-10s %s\n" "$id" "$status" "$file" "$line_display" "$short_body"
    done
}

cmd_status() {
  local session
  session=$(find_active_session)

  if [[ -z "$session" ]]; then
    echo "No active session"
    echo "Run: prc.sh init"
    return 0
  fi

  local pr_number owner repo branch review_status review_id
  pr_number=$(jq -r '.pr.number' "$session")
  owner=$(jq -r '.pr.owner' "$session")
  repo=$(jq -r '.pr.repo' "$session")
  branch=$(jq -r '.pr.branch' "$session")
  review_status=$(jq -r '.review.status' "$session")
  review_id=$(jq -r '.review.id' "$session")

  local total draft pending submitted
  total=$(jq '.comments | length' "$session")
  draft=$(jq '[.comments[] | select(.status == "draft")] | length' "$session")
  pending=$(jq '[.comments[] | select(.status == "pending")] | length' "$session")
  submitted=$(jq '[.comments[] | select(.status == "submitted")] | length' "$session")

  echo "PR: ${owner}/${repo}#${pr_number} (${branch})"
  echo "Review: ${review_status} (id: ${review_id})"
  echo "Comments: ${total} total (draft: ${draft}, pending: ${pending}, submitted: ${submitted})"
  echo "Session: ${session}"

  if [[ "$total" -gt 0 ]]; then
    echo ""
    cmd_list
  fi
}

cmd_submit() {
  local draft=false event="" body=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --draft) draft=true; shift ;;
      --event) event="$2"; shift 2 ;;
      --body) body="$2"; shift 2 ;;
      *) die "submit: unknown option: $1" ;;
    esac
  done

  if [[ "$draft" == true ]]; then
    submit_draft
  else
    submit_final "$event" "$body"
  fi
}

submit_draft() {
  local session
  session=$(ensure_session)

  local owner repo pr_number
  owner=$(jq -r '.pr.owner' "$session")
  repo=$(jq -r '.pr.repo' "$session")
  pr_number=$(jq -r '.pr.number' "$session")

  # Check for draft comments
  local draft_count
  draft_count=$(jq '[.comments[] | select(.status == "draft")] | length' "$session")
  [[ "$draft_count" -gt 0 ]] || die "no draft comments to submit"

  # Get or create pending review
  local review_id
  review_id=$(jq -r '.review.id' "$session")

  if [[ "$review_id" == "null" ]]; then
    # Create new pending review (no event = PENDING state)
    local review_response
    review_response=$(gh api "repos/${owner}/${repo}/pulls/${pr_number}/reviews" \
      --method POST -f body="" 2>&1) || die_api "failed to create review: $review_response"
    review_id=$(echo "$review_response" | jq -r '.id')

    local tmp
    tmp=$(mktemp)
    jq --argjson rid "$review_id" '.review.id = $rid' "$session" > "$tmp"
    mv "$tmp" "$session"
  fi

  # Get latest commit SHA for the PR
  local commit_id
  commit_id=$(gh api "repos/${owner}/${repo}/pulls/${pr_number}" --jq '.head.sha' 2>/dev/null) || die_api "failed to get PR head SHA"

  # Add each draft comment to the review
  local draft_ids
  draft_ids=$(jq -r '.comments[] | select(.status == "draft") | .id' "$session")

  for cid in $draft_ids; do
    local file start_line line body
    file=$(jq -r --argjson id "$cid" '.comments[] | select(.id == $id) | .file' "$session")
    start_line=$(jq -r --argjson id "$cid" '.comments[] | select(.id == $id) | .start_line // empty' "$session")
    line=$(jq -r --argjson id "$cid" '.comments[] | select(.id == $id) | .line' "$session")
    body=$(jq -r --argjson id "$cid" '.comments[] | select(.id == $id) | .body' "$session")

    local api_args=(
      "repos/${owner}/${repo}/pulls/${pr_number}/comments"
      --method POST
      -f body="$body"
      -f path="$file"
      -F line="$line"
      -f side="RIGHT"
      -f commit_id="$commit_id"
      -F pull_review_id="$review_id"
    )
    if [[ -n "$start_line" ]]; then
      api_args+=(-F start_line="$start_line" -f start_side="RIGHT")
    fi

    local response
    response=$(gh api "${api_args[@]}" 2>&1) || die_api "failed to add comment #${cid}: $response"

    local gh_comment_id
    gh_comment_id=$(echo "$response" | jq -r '.id')

    # Update comment status in session
    local tmp
    tmp=$(mktemp)
    jq --argjson cid "$cid" --argjson ghid "$gh_comment_id" \
      '.comments = [.comments[] | if .id == $cid then .status = "pending" | .github_comment_id = $ghid else . end]' \
      "$session" > "$tmp"
    mv "$tmp" "$session"
  done

  cmd_validate "$session" >/dev/null
  echo "${draft_count} comment(s) submitted as draft review (review #${review_id})"
}

submit_final() {
  local event="${1:-COMMENT}"
  local body="${2:-}"

  # Validate event type
  case "$event" in
    APPROVE|REQUEST_CHANGES|COMMENT) ;;
    "") event="COMMENT" ;;
    *) die "submit: invalid event type: $event (must be APPROVE, REQUEST_CHANGES, or COMMENT)" ;;
  esac

  local session
  session=$(ensure_session)

  local owner repo pr_number review_id review_status
  owner=$(jq -r '.pr.owner' "$session")
  repo=$(jq -r '.pr.repo' "$session")
  pr_number=$(jq -r '.pr.number' "$session")
  review_id=$(jq -r '.review.id' "$session")
  review_status=$(jq -r '.review.status' "$session")

  [[ "$review_id" != "null" ]] || die "no pending review. run 'submit --draft' first"
  [[ "$review_status" == "draft" ]] || die "review already submitted"

  # Submit any remaining draft comments first
  local draft_count
  draft_count=$(jq '[.comments[] | select(.status == "draft")] | length' "$session")
  if [[ "$draft_count" -gt 0 ]]; then
    submit_draft
  fi

  # Submit the review
  local api_args=(
    "repos/${owner}/${repo}/pulls/${pr_number}/reviews/${review_id}/events"
    --method POST
    -f event="$event"
  )
  if [[ -n "$body" ]]; then
    api_args+=(-f body="$body")
  fi

  gh api "${api_args[@]}" >/dev/null 2>&1 || die_api "failed to submit review"

  # Update session
  local tmp
  tmp=$(mktemp)
  jq --arg event "$event" '
    .review.status = "submitted" |
    .review.submitted_event = $event |
    .comments = [.comments[] | if .status == "pending" then .status = "submitted" else . end]
  ' "$session" > "$tmp"
  mv "$tmp" "$session"

  cmd_validate "$session" >/dev/null
  echo "Review submitted (${event}) on ${owner}/${repo}#${pr_number}"
}

# Core sync logic. Upserts remote pending review comments into a session.
# Returns 0 on success with summary on stdout, 1 if no pending review found.
_sync_pending_review() {
  local session="$1"
  local owner repo pr_number
  owner=$(jq -r '.pr.owner' "$session")
  repo=$(jq -r '.pr.repo' "$session")
  pr_number=$(jq -r '.pr.number' "$session")

  local gh_user
  gh_user=$(gh api user --jq '.login' 2>/dev/null) || return 1

  local reviews
  reviews=$(gh api "repos/${owner}/${repo}/pulls/${pr_number}/reviews" 2>/dev/null) || return 1

  local pending_review
  pending_review=$(echo "$reviews" | jq --arg user "$gh_user" '
    [.[] | select(.state == "PENDING" and .user.login == $user)] | last
  ')
  [[ "$pending_review" != "null" && -n "$pending_review" ]] || return 1

  local review_id
  review_id=$(echo "$pending_review" | jq -r '.id')

  local remote_comments
  remote_comments=$(gh api "repos/${owner}/${repo}/pulls/${pr_number}/reviews/${review_id}/comments" 2>/dev/null) || return 1

  # Set review ID
  local tmp
  tmp=$(mktemp)
  jq --argjson rid "$review_id" '.review.id = $rid' "$session" > "$tmp"
  mv "$tmp" "$session"

  local remote_count added=0 updated=0
  remote_count=$(echo "$remote_comments" | jq 'length')

  for i in $(seq 0 $((remote_count - 1))); do
    local gh_comment_id file start_line line body
    gh_comment_id=$(echo "$remote_comments" | jq -r ".[$i].id")
    file=$(echo "$remote_comments" | jq -r ".[$i].path")
    start_line=$(echo "$remote_comments" | jq ".[$i].start_line")
    line=$(echo "$remote_comments" | jq -r ".[$i].line // .[$i].original_line // 0")
    body=$(echo "$remote_comments" | jq -r ".[$i].body")

    local exists
    exists=$(jq --argjson ghid "$gh_comment_id" '[.comments[] | select(.github_comment_id == $ghid)] | length' "$session")

    tmp=$(mktemp)
    if [[ "$exists" -gt 0 ]]; then
      jq --argjson ghid "$gh_comment_id" --arg file "$file" --argjson sl "$start_line" \
         --argjson line "$line" --arg body "$body" \
         '.comments = [.comments[] | if .github_comment_id == $ghid then .file = $file | .start_line = $sl | .line = $line | .body = $body else . end]' \
         "$session" > "$tmp"
      mv "$tmp" "$session"
      updated=$((updated + 1))
    else
      local new_id
      new_id=$(next_comment_id "$session")
      jq --argjson id "$new_id" --arg file "$file" --argjson sl "$start_line" --argjson line "$line" \
         --arg body "$body" --argjson ghid "$gh_comment_id" \
         '.comments += [{ id: $id, file: $file, start_line: $sl, line: $line, body: $body, status: "pending", github_comment_id: $ghid }]' \
         "$session" > "$tmp"
      mv "$tmp" "$session"
      added=$((added + 1))
    fi
  done

  echo "${added} added, ${updated} updated (${remote_count} remote, review #${review_id})"
}

cmd_sync() {
  local session
  session=$(find_active_session)

  if [[ -z "$session" ]]; then
    # No session — init first, which auto-syncs
    cmd_init
    return
  fi

  local result
  result=$(_sync_pending_review "$session") || die "no pending review found"
  cmd_validate "$session" >/dev/null
  echo "Synced: ${result}"
  echo "Session: ${session}"
}

usage() {
  cat <<'EOF'
Usage: prc.sh <command> [options]

Commands:
  init                              Create new review session (auto-detects PR)
  sync                              Sync pending review comments from GitHub to local
  status                            Show current session state
  validate                          Validate session JSON schema
  add --file <path> [--start-line <n>] --line <n> --body <text>   Add comment
  update <id> [--file] [--start-line] [--line] [--body]   Update comment
  delete <id>                       Delete comment
  list                              List comments
  submit --draft                    Submit draft comments as GitHub pending review
  submit [--event <type>] [--body <text>]   Submit review (default: COMMENT)
EOF
}

main() {
  local action="${1:-}"
  shift || true

  case "$action" in
    init)     cmd_init "$@" ;;
    sync)     cmd_sync "$@" ;;
    status)   cmd_status "$@" ;;
    validate) cmd_validate "$@" ;;
    add)      cmd_add "$@" ;;
    update)   cmd_update "$@" ;;
    delete)   cmd_delete "$@" ;;
    list)     cmd_list "$@" ;;
    submit)   cmd_submit "$@" ;;
    help|-h|--help) usage ;;
    "") usage ;;
    *) die "unknown command: $action" ;;
  esac
}

main "$@"
