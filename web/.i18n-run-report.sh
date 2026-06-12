#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")"
REPORT="$(dirname "$0")/.i18n-run-report.txt"
: > "$REPORT"

run_cmd() {
  local name="$1"
  shift
  {
    echo "===== COMMAND: $name ====="
    echo "CMD: $*"
    echo "--- OUTPUT START ---"
  } >> "$REPORT"
  if "$@" >> "$REPORT" 2>&1; then
    local code=0
  else
    local code=$?
  fi
  {
    echo "--- OUTPUT END ---"
    echo "EXIT_CODE: $code"
    echo ""
  } >> "$REPORT"
}

run_cmd "yarn i18n:extract" yarn i18n:extract
run_cmd "yarn i18n:check" yarn i18n:check

echo "DONE" >> "$REPORT"
