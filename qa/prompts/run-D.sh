#!/usr/bin/env bash
set -euo pipefail
cd /home/ahmed/Projects/alquods-qa-D
PROMPT="$(cat /home/ahmed/Projects/alqouds_last/qa/prompts/COMMON.md /home/ahmed/Projects/alqouds_last/qa/prompts/D.md)"
exec opencode run -m opencode/flint-40b-free --auto --title "QA worker D" "$PROMPT"
