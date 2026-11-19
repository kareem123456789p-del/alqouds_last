---
name: qe-debug-loop
description: Hypothesis-driven autonomous debugging with real command validation
---

## arguments

- `<symptom>` — Description of the bug or unexpected behavior. If omitted, prompt the user.

## phases

Phases

## reproduce

Run the exact command that shows the bug. Capture and display the REAL output. Confirm the bug is visible.

## hypothesize-and-test-up-to-5-iterations

For each iteration: 1. State a specific hypothesis (e.g., "the query targets v2 tables but data is in v3 tables") 2. Run a REAL command to test it (e.g., `sqlite3 [db path] '.tables'` then `SELECT COUNT(*) FROM [table]`) 3. Record whether the hypothesis was confirmed or rejected 4. If rejected, form

## fix

Make the minimal targeted fix. Explain: - What the root cause was - What you're changing and why - What the blast radius is (which other code paths are affected)

## verify

Run the SAME reproduction command from Phase 1. The output must now show correct values. If it doesn't, go back to Phase 2.

## regression

Regression

## rules

- NEVER guess or simulate output — always run real commands - NEVER make code changes before confirming root cause - Always check for the pattern across the entire codebase, not just one file - If blocked after 5 hypotheses, stop and ask the user for guidance
