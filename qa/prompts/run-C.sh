#!/usr/bin/env bash
set -euo pipefail
cd /home/ahmed/Projects/alquods-qa-C
PROMPT="$(cat /home/ahmed/Projects/alqouds_last/qa/prompts/COMMON.md /home/ahmed/Projects/alqouds_last/qa/prompts/C.md)"
exec opencode run -m opencode/mimo-v2.6-flash-free --auto --title "QA worker C" "$PROMPT"
