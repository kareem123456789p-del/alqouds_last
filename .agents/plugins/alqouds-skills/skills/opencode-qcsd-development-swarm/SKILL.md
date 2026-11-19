---
name: qcsd-development-swarm
description: QCSD Development phase swarm for in-sprint code quality assurance
  using TDD adherence, code complexity analysis, coverage gap detection, and
  defect prediction. Consumes Refinement outputs (BDD scenarios, SFDIPOT
  priorities) and produces signals for Verification.
---

## overview

The Development Swarm takes refined stories (that passed Refinement) and validates code quality during sprint execution. Where the Ideation Swarm asks "Should we build this?" and the Refinement Swarm asks "How should we test this?", the Development Swarm asks "Is the code quality sufficient to ship?

## qcsd-phase-positioning

QCSD Phase Positioning

## key-differentiators-from-refinement-swar

Key Differentiators from Refinement Swarm

## parameters

- `SOURCE_PATH`: Source code directory to analyze (required, e.g., `src/auth/`) - `TEST_PATH`: Test directory for coverage analysis (optional, e.g., `tests/auth/`) - `OUTPUT_FOLDER`: Where to save reports (default: `${PROJECT_ROOT}/Agentic QCSD/development/`)

## enforcement-rules---read-first

**These rules are NON-NEGOTIABLE. Violation means skill execution failure.**

## phase-1-analyze-code-context-flag-detect

**MANDATORY: You must complete this analysis before Phase 2.**

## flag-detection-check-all-six

Flag Detection (Check ALL SIX)

## validation-checkpoint

Before proceeding to Phase 2, confirm:
