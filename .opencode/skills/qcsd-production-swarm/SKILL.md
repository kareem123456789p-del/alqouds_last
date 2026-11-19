---
name: qcsd-production-swarm
description: QCSD Production Telemetry phase swarm for post-release production
  health assessment using DORA metrics, root cause analysis, defect prediction,
  and cross-phase feedback loops. Consumes CI/CD outputs
  (RELEASE/REMEDIATE/BLOCK decisions, release readiness metrics) and produces
  feedback signals to Ideat
---

## overview

The Production Swarm takes releases that passed CI/CD verification and assesses their health in the live production environment. Where the CI/CD Swarm asks "Is this change safe to release?", the Production Swarm asks "Is the release healthy in production?"

## qcsd-phase-positioning

QCSD Phase Positioning

## key-differentiators-from-cicd-swarm

Key Differentiators from CI/CD Swarm

## parameters

- `TELEMETRY_DATA`: Path to production telemetry, incident reports, and DORA metrics (required, e.g., `production/telemetry/`) - `RELEASE_ID`: Release identifier for tracking (optional, e.g., `v3.6.9`) - `OUTPUT_FOLDER`: Where to save reports (default: `${PROJECT_ROOT}/Agentic QCSD/production/`) - `

## enforcement-rules---read-first

**These rules are NON-NEGOTIABLE. Violation means skill execution failure.**

## phase-1-analyze-production-context-flag-

**MANDATORY: You must complete this analysis before Phase 2.**

## retrieve-cicd-phase-signals-cross-phase-

Before analyzing production context, retrieve the most recent CI/CD phase signals from memory. These provide the release readiness baseline that the Production Swarm builds upon.

## step-05-auto-detect-pre-collected-teleme

Before requiring manual telemetry input, check if the GitHub Actions telemetry collection workflow has pre-collected DORA metrics. This runs automatically after every npm publish and weekly on schedule.
