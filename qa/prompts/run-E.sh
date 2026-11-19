#!/usr/bin/env bash
set -euo pipefail
cd /home/ahmed/Projects/alquods-qa-E
PROMPT="$(cat /home/ahmed/Projects/alqouds_last/qa/prompts/COMMON.md /home/ahmed/Projects/alqouds_last/qa/prompts/E.md)"
exec opencode run -m opencode/nemotron-3.5-super-vl-free --auto --title "QA worker E" "$PROMPT"
