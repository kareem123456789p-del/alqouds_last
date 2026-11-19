#!/usr/bin/env bash
set -euo pipefail
cd /home/ahmed/Projects/alquods-qa-A
PROMPT="$(cat /home/ahmed/Projects/alqouds_last/qa/prompts/COMMON.md /home/ahmed/Projects/alqouds_last/qa/prompts/A.md)"
exec opencode run -m opencode/big-pickle --auto --title "QA worker A" "$PROMPT"
