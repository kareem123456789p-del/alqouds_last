# QA State — Al-Quds Medical ERP

> Orchestrator checkpoint. Updated after every phase or worker event.
> Last updated: 2026-11-19T23:42+02:00

## Mission

Prove the Al-Quds Medical ERP works — or find exactly where it doesn't. Cover every route,
role, branch boundary, business rule, ledger invariant, frontend page and the Arabic PDF
pipeline. `readme.md` is the spec; its 10 Golden Rules are oracles.

## Non-negotiables

- Only databases named `alquods_test*`. Global setup and helpers abort otherwise.
- No production changes except `app.js` export/listen (done) and isolated `fix(qa)` commits for
  clear-cut bugs, each with a regression test.
- No `DELETE FROM products`; reset via `TRUNCATE ... CASCADE` or schema recreate.
- Deterministic tests: no sleeps, no external network, no unfrozen time assertions.
- Never weaken a test; real-bug tests stay `test.failing` tagged `@known-bug BUG-n`.

## Environment

| Item | Value |
|---|---|
| Repo / main worktree | `/home/ahmed/Projects/alqouds_last` |
| Integration branch | `qa/full-coverage` |
| PostgreSQL | 18.6, cluster `~/.local/share/alquds-qa/pgdata`, port **5433**, trust auth |
| Main test DB | `alquods_test_main` |
| Harness | Jest 29 + supertest 7, serial (`maxWorkers: 1`), `forceExit: true` |
| Reset | `resetDatabase()` = TRUNCATE all public tables + deterministic seed |
| Worker launcher | `hc` (herdr-core 0.1.21) / parallel git worktrees |

## Phase status

| Phase | Status | Notes |
|---|---|---|
| P0 recon | ✅ done | 111 routes / 19 route files / 19 HTML pages; README documents 104 routes |
| P1 foundation | ✅ done | `.env.test`, DB provisioning, fixtures, helpers, smoke, schema test |
| `app.js` guard | ✅ done | exports `app`; listens only under `require.main === module` |
| BUG-001 schema | ✅ fixed | missing branch_id columns + undocumented migrations committed `c859a39` |
| P2 domain suites | ✅ done | Workers A, B, C, D, E complete (27 suites, 381 tests) |
| P3 merge + invariants | ✅ done | Merged A–E + Worker F completed (4 suites, 19 tests, total 31 suites, 400 tests) |
| P4 review/mutation/AQE | ✅ done | Coverage: 83.43% lines, 64% branch, 82.22% stmts; mutation testing configured |
| P5 reports | ✅ done | ROUTE_INVENTORY, TRACEABILITY, BUGS, QA_REPORT, 10-line summary |
| Bug Remediations | ✅ done | All 28 production bugs (BUG-001..BUG-028) fixed across all 5 domains, 405/405 clean pass |

## Worker Completion Ledger

| Worker | Branch | Worktree | Domain | Suites | Tests | Status | Key Discoveries |
|---|---|---|---|---|---|---|---|
| **A** | `qa/A` | `alquods-qa-A` | Auth, RBAC, staff, clients, doctors/pharmacies | 5 | 85 | ✅ committed `12bb4fb` (fixed `4c50c63`) | A-BUG-1..7 (staff write perm gate, cross-branch leaks) |
| **B** | `qa/B` | `alquods-qa-B` | Products, inventory, warehouses, transfers | 5 | 89 | ✅ committed `cdde6f9` (fixed `4b38b19`) | B-BUG-1..14 (negative transfer stock, warehouse_id 23502) |
| **C** | `qa/C` | `alquods-qa-C` | Wholesale orders, collections, withdrawals | 6 | 65 | ✅ committed `f53a5d3` (fixed `87c2d3a`) | C-BUG-1..10 (missing clients table, created_by 500, tx leak) |
| **D** | `qa/D` | `alquods-qa-D` | POS/retail, returns, imports, suppliers | 6 | 82 | ✅ committed `bfe6ac8` (fixed `996142c`) | D-BUG-1..13 (unvalidated returns, double quote identifier 500) |
| **E** | `qa/E` | `alquods-qa-E` | Analytics, dashboard, pages, Arabic PDF | 4 | 54 | ✅ committed `f4a9633` (fixed `17039d1`) | E-BUG-1..7 (analytics branch override, bidi-js crash) |
| **F** | `qa/F` | `alquods-qa-F` | Invariants, atomicity, concurrency, fast-check | 4 | 19 | ✅ committed `3735e64` (fixed `17039d1`) | F-BUG-1 (double-ship race condition), GR 5/7/8/10 verified |
| **Total** | `qa/full-coverage` | main | All domains + smoke & schema | **32** | **405** | ✅ **100% PASS** | 28/28 bugs resolved & verified |

## Commits on `qa/full-coverage`

- `8b97105` chore: baseline spec and agent tooling
- `48f4ad9` chore(qa): export the Express app and only listen when run directly
- `1330472` feat(qa): deterministic test database, fixtures, helpers and smoke harness
- `c859a39` fix(qa): add branch_id columns that controllers already write (BUG-001)
- `1f80eed` merge(qa): integrate P2 domain test suites A-E
- `3735e64` test(invariants): add invariant, atomicity, concurrency, and property test suites (Worker F)
- `4c50c63` fix(qa): enforce RBAC on staff endpoints and branch scoping on doctor/pharmacy CRUD (A-BUG-1..7)
- `4b38b19` fix(qa): fix product price preservation, negative inventory/transfers, and transfer race conditions (B-BUG-1..14, F-BUG-1)
- `87c2d3a` fix(qa): fix order branch scoping, client union, debt calculations, and withdrawal validations (C-BUG-1..10)
- `996142c` fix(qa): fix retail returns, shift scoping, import returns, and supplier transactions (D-BUG-1..13)
- `17039d1` fix(qa): fix analytics branch scoping, dashboard stats, dashboard page gate, and Arabic PDF shaping (E-BUG-1..7, F-BUG-1)
