---
name: qcsd-ideation-swarm
description: "QCSD Ideation phase swarm for Quality Criteria sessions using HTSM
  v6.3, Risk Storming, and Testability analysis before development begins. Uses
  5-tier browser cascade: Vibium → agent-browser → Playwright+Stealth → WebFetch
  → WebSearch-fallback."
---

## url-based-analysis-mode-v71

When analyzing a live website URL, use this specialized execution pattern.

## parameters

- `URL`: Website to analyze (required) - `OUTPUT_FOLDER`: Where to save reports (default: `${PROJECT_ROOT}/Agentic QCSD/{domain}/` or `./Agentic QCSD/{domain}/`)

## -url-mode-complete-execution-flow

**You MUST follow ALL phases in order. Skipping phases is a FAILURE.**

## phase-url-1-setup-and-content-fetch-auto

**The browser cascade is now FULLY AUTOMATED via `scripts/fetch-content.js`.**

## phase-url-2-programmatic-flag-detection-

**You MUST detect flags from the fetched content. Do NOT skip this phase.**

## phase-url-3-spawn-core-agents-parallel

**All 3 core agents MUST be spawned. Fewer is a FAILURE.**

## website-content

${content}

## analysis-requirements

Analyze ALL 10 HTSM v6.3 categories with weight and testability score for each.
