---
name: qe-cicd-pipeline-qe-orchestrator
description: Orchestrate quality engineering across CI/CD pipeline phases. Use
  when designing test strategies, planning quality gates, or implementing
  shift-left/shift-right testing.
---

## phase-agent-matrix

Phase-Agent Matrix

## quality-gate-thresholds

Quality Gate Thresholds

## fleet-configuration

- **Topology**: hierarchical - **Max Agents**: 10 per phase - **Coordination**: aqe/* memory namespace

## pipeline-phases

Pipeline Phases

## commit-shift-left

**Goal:** Catch defects early, ensure testability

## build

**Goal:** Validate integration, ensure coverage

## integrationtest

**Goal:** Validate contracts, performance, security

## staging

**Goal:** Validate production-like environment, resilience
