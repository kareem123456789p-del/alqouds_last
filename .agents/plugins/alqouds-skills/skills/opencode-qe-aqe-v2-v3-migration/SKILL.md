---
name: qe-aqe-v2-v3-migration
description: Migrate Agentic QE projects from v2 to v3 with zero data loss
---

## quick-reference

Quick Reference

## migration-command

Migration Command

## what-gets-migrated

What Gets Migrated

## migration-checklist

Migration Checklist

## pre-migration

- [ ] Verify v2 installation exists (`.agentic-qe/` directory) - [ ] Check v2 version: `aqe --version` (should be 2.x.x) - [ ] Backup current data: `npm run backup` (in v2 project) - [ ] Note any custom configurations - [ ] Document current test counts and coverage

## during-migration

- [ ] Update to v3: `npm install agentic-qe@latest` - [ ] Run migration: `aqe migrate` - [ ] Review migration report - [ ] Verify data transferred correctly

## post-migration

- [ ] Run v3 tests: `aqe test` - [ ] Check coverage: `aqe coverage` - [ ] Verify patterns loaded: `aqe patterns list` - [ ] Test MCP integration with Claude Code

## architecture-changes-v2-v3

Architecture Changes (v2 → v3)
