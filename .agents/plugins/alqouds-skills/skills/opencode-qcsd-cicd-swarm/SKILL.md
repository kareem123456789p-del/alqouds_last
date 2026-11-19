---
name: qcsd-cicd-swarm
description: QCSD Verification phase swarm for CI/CD pipeline quality gates
  using regression analysis, flaky test detection, quality gate enforcement, and
  deployment readiness assessment. Consumes Development outputs
  (SHIP/CONDITIONAL/HOLD decisions, quality metrics) and produces signals for
  Production monitorin
---

## overview

The CI/CD Swarm takes code that passed Development quality checks and validates it is safe to release through the CI/CD pipeline. Where the Development Swarm asks "Is the code quality sufficient to ship?", the CI/CD Swarm asks "Is this change safe to release?"

## qcsd-phase-positioning

QCSD Phase Positioning

## key-differentiators-from-development-swa

Key Differentiators from Development Swarm

## parameters

- `PIPELINE_ARTIFACTS`: Path to CI/CD artifacts, test results, and build output (required, e.g., `ci/artifacts/`) - `BASELINE_REF`: Git ref for baseline comparison (optional, default: `main`) - `OUTPUT_FOLDER`: Where to save reports (default: `${PROJECT_ROOT}/Agentic QCSD/cicd/`) - `DEPLOY_TARGET`:

## enforcement-rules---read-first

**These rules are NON-NEGOTIABLE. Violation means skill execution failure.**

## phase-1-analyze-pipeline-context-flag-de

**MANDATORY: You must complete this analysis before Phase 2.**

## flag-detection-check-all-six

Flag Detection (Check ALL SIX)

## validation-checkpoint

Before proceeding to Phase 2, confirm:
