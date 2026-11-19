---
name: qe-pr-review
description: Scope-aware GitHub PR review with user-friendly tone and trust tier validation
---

## arguments

- `<pr-number>` — GitHub PR number to review. If omitted, prompt the user.

## steps

Steps

## 1-read-the-full-diff

1. Read the Full Diff

## 2-scope-check

- Only analyze AQE/QE skills (NOT Claude Flow platform skills) - Platform skills to EXCLUDE: v3-*, flow-nexus-*, agentdb-*, reasoningbank-*, swarm-*, github-*, hive-mind-advanced, hooks-automation, iterative-loop, stream-chain, skill-builder, sparc-methodology, pair-programming, release, debug-loop,

## 3-summarize-changes

Write a user-friendly summary of what changed and why: - Focus on outcomes, not implementation details - Avoid overly technical jargon - Keep it to 3-5 bullet points

## 4-trust-tier-validation

For any skill changes, validate trust_tier assignments: - **tier 3** = has eval infrastructure (evals/, schemas/, scripts/) - **tier 2** = tested but no eval framework - **tier 1** = untested - Flag inconsistencies (e.g., a skill with evals at tier 2 should be tier 3)

## 5-code-quality-review

Check for: - Hardcoded version strings - Production safety concerns (adapter changes, breaking changes) - Missing test coverage for new code - Security issues (exposed secrets, injection risks)

## 6-post-review

6. Post Review
