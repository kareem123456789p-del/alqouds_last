#!/usr/bin/env bash
set -euo pipefail
cd /home/ahmed/Projects/alquods-qa-B
PROMPT="$(cat /home/ahmed/Projects/alqouds_last/qa/prompts/COMMON.md /home/ahmed/Projects/alqouds_last/qa/prompts/B.md)"
exec opencode run -m opencode/longcat-2.5-free --auto --title "QA worker B" "$PROMPT"
