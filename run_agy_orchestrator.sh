#!/usr/bin/env bash
# Orchestrator runner: invoke agy (antigravity CLI) with the edited continuous prompt,
# inside a herdr (hc) terminal. Runs non-interactively via --print.
set -euo pipefail

cd /home/ahmed/Projects/alqouds_last
export HERDR_ENV=1

AGY=/home/ahmed/.local/bin/agy
PROMPT_FILE=/home/ahmed/Projects/alqouds_last/continuous_prompt_for_agy.md

if [ ! -x "$AGY" ]; then
  echo "ERROR: agy not found at $AGY" >&2
  exit 1
fi
if [ ! -f "$PROMPT_FILE" ]; then
  echo "ERROR: prompt file not found at $PROMPT_FILE" >&2
  exit 1
fi

echo "=== agy plugin list (pre-run check) ==="
"$AGY" plugin list 2>&1 | head -20 || true

echo "=== Running agy orchestrator (--print, 300s timeout) ==="
"$AGY" --print --print-timeout 300 "$(cat "$PROMPT_FILE")"
