#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: pr-author/respond/scripts/run.sh --input <raw-input.json> [options]

Options:
  --input <path>             Raw build input JSON for pr-author respond
  --timeout <duration>       Prompt timeout (default: 0s, disabled)
  --entry <path>             Prompt entry module (default: pr-author respond web/app.mjs)
  --payload-out <path>       Persist normalized prompt payload JSON
  --triage-map-out <path>    Persist generated triage-map JSON
  --prompt-result-out <path> Persist raw prompt result JSON
  --normalized-out <path>    Persist normalized triage result JSON
  --help                     Show this message
EOF
}

INPUT_PATH=""
TIMEOUT="0s"
ENTRY_PATH=""
PAYLOAD_OUT=""
TRIAGE_MAP_OUT=""
PROMPT_RESULT_OUT=""
NORMALIZED_OUT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --input)
      INPUT_PATH="${2:-}"
      shift 2
      ;;
    --timeout)
      TIMEOUT="${2:-}"
      shift 2
      ;;
    --entry)
      ENTRY_PATH="${2:-}"
      shift 2
      ;;
    --payload-out)
      PAYLOAD_OUT="${2:-}"
      shift 2
      ;;
    --triage-map-out)
      TRIAGE_MAP_OUT="${2:-}"
      shift 2
      ;;
    --prompt-result-out)
      PROMPT_RESULT_OUT="${2:-}"
      shift 2
      ;;
    --normalized-out)
      NORMALIZED_OUT="${2:-}"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$INPUT_PATH" ]]; then
  echo "--input is required" >&2
  usage >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
SKILL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd -P)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

if [[ -z "$ENTRY_PATH" ]]; then
  ENTRY_PATH="${SKILL_DIR}/web/app.mjs"
fi

PAYLOAD_PATH="${PAYLOAD_OUT:-$TMP_DIR/payload.json}"
TRIAGE_MAP_PATH="${TRIAGE_MAP_OUT:-$TMP_DIR/triage-map.json}"
PROMPT_RESULT_PATH="${PROMPT_RESULT_OUT:-$TMP_DIR/prompt-result.json}"
NORMALIZED_PATH="${NORMALIZED_OUT:-$TMP_DIR/normalized-triage.json}"

NODE_BIN="${NODE_BINARY:-$(command -v node 2>/dev/null || command -v nodejs 2>/dev/null || true)}"
if [[ -z "$NODE_BIN" ]]; then
  echo "node is required to run pr-author respond" >&2
  exit 1
fi

"$NODE_BIN" "${SCRIPT_DIR}/build-payload.mjs" \
  --input "$INPUT_PATH" \
  --payload-out "$PAYLOAD_PATH" \
  --triage-map-out "$TRIAGE_MAP_PATH"

"$NODE_BIN" "${SCRIPT_DIR}/prompt.mjs" --entry "$ENTRY_PATH" --timeout "$TIMEOUT" < "$PAYLOAD_PATH" | tee "$PROMPT_RESULT_PATH" > /dev/null

"$NODE_BIN" "${SCRIPT_DIR}/parse-result.mjs" \
  --prompt-result "$PROMPT_RESULT_PATH" \
  --triage-map "$TRIAGE_MAP_PATH" \
  --output "$NORMALIZED_PATH"

cat "$NORMALIZED_PATH"
