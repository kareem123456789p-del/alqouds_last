---
name: qe-release
description: End-to-end npm release workflow with verification gates and
  hardcoded-version protection
---

## architecture

This project has a **dual-package structure** — both must stay in sync:

## arguments

- `<version>` — Target version (e.g., `3.5.5`). If omitted, prompt the user.

## steps

Steps

## 1-pre-flight-ensure-clean-state

1. Pre-Flight: Ensure Clean State

## 2-version-audit

Read the current version from `package.json` (source of truth). Then grep the ENTIRE codebase for hardcoded version strings — current version, old versions, and any version-like patterns. Check both package.json files are in sync.

## 3-bump-version

Update both package.json files to the target version:

## 4-update-changelog

Add a new section to `v3/CHANGELOG.md` following Keep a Changelog format:

## version---yyyy-mm-dd

[<version>] - YYYY-MM-DD
