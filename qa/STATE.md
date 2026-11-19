# QA State — Al-Quds Medical ERP

> Orchestrator checkpoint. Updated after every phase or worker event.
> Last updated: 2026-11-19T22:33+02:00

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
| Integration branch | `qa/full-coverage` (HEAD `c859a39`) |
| PostgreSQL | 18.6, cluster `~/.local/share/alquds-qa/pgdata`, port **5433**, trust auth |
| Main test DB | `alquods_test_main` |
| Harness | Jest 29 + supertest 7, serial (`maxWorkers: 1`), `forceExit: true` |
| Reset | `resetDatabase()` = TRUNCATE all public tables + deterministic seed |
| Worker launcher | `hc` (herdr-core 0.1.21); `herdr` CLI itself is not installed |

## Phase status

| Phase | Status | Notes |
|---|---|---|
| P0 recon | ✅ done | 111 routes / 19 route files / 19 HTML pages; README documents 104 routes |
| P1 foundation | ✅ done | `.env.test`, DB provisioning, fixtures, helpers, smoke, schema test |
| `app.js` guard | ✅ done | exports `app`; listens only under `require.main === module` |
| BUG-001 schema | ✅ fixed | missing branch_id columns + undocumented migrations |
| P2 domain suites | 🟡 running | workers A–E launched 22:32 |
| P3 merge + invariants | ⏳ pending | merge A–E, then worker F |
| P4 review/mutation/AQE | ⏳ pending | independent review, mutation score, AQE gate |
| P5 reports | ⏳ pending | ROUTE_INVENTORY, TRACEABILITY, BUGS, QA_REPORT, 10-line summary |

## Commits on `qa/full-coverage`

- `8b97105` chore: baseline spec and agent tooling
- `48f4ad9` chore(qa): export the Express app and only listen when run directly
- `1330472` feat(qa): deterministic test database, fixtures, helpers and smoke harness
- `c859a39` fix(qa): add branch_id columns that controllers already write (BUG-001)
- `+` chore(qa): worker briefs and state checkpoint (this commit)

## Workers (P2)

Each worker has its own worktree, branch, database and `.env.test`; `node_modules` is a symlink
to the main install. Workers may only add tests under their directory and `qa/status/<W>.*`.

| W | Branch | Worktree | DB | Model | Domain | State |
|---|---|---|---|---|---|---|
| A | `qa/A` | `alquods-qa-A` | `alquods_test_a` | `opencode/big-pickle` | auth, RBAC, staff, clients, doctors/pharmacies | 🟡 running |
| B | `qa/B` | `alquods-qa-B` | `alquods_test_b` | `opencode/longcat-2.5-free` | products, inventory, warehouses, transfers | 🟡 running |
| C | `qa/C` | `alquods-qa-C` | `alquods_test_c` | `opencode/mimo-v2.6-flash-free` | orders, collections, withdrawals | 🟡 running |
| D | `qa/D` | `alquods-qa-D` | `alquods_test_d` | `opencode/flint-40b-free` | POS/retail, returns, imports, suppliers | 🟡 running |
| E | `qa/E` | `alquods-qa-E` | `alquods_test_e` | `opencode/nemotron-3.5-super-vl-free` | analytics, dashboard, pages, Arabic PDF | 🟡 running |
| F | `qa/F` | `alquods-qa-F` | `alquods_test_f` | `opencode/hy4-flash-free` | invariants, atomicity, concurrency, property tests | ⏳ after merge |

All worker databases are provisioned and schema-verified (26 tables, 10 critical columns).

## Worker contracts

- Test dirs: A `tests/integration/auth/`, B `.../inventory/`, C `.../finance/`,
  D `.../retail/`, E `.../ui/`.
- Each route in scope must appear in ≥1 test that reaches the handler; branch boundaries and
  DB side effects are asserted, not just response codes.
- Confirmed bugs: `test.failing` + `@known-bug W-BUG-n`; report expected vs actual in
  `qa/status/W.json`.
- Forbidden: editing production code, shared helpers, jest config, `.env.test`; `test.skip`;
  sleeps; network.

## Open risks

- Weak/free worker models may produce shallow tests or stall; supervise via `hc read`, narrow
  the scope or respawn if needed.
- Jest `globalSetup` re-provisions the DB on every run; only one Jest process per worktree.
- Playwright/browser coverage is optional for E; if Chromium cannot launch, record it as an
  environment gap rather than faking UI coverage.
- FEFO including expired batches is **spec-compliant** (`ORDER BY expiry_date ASC`) but a
  business risk; document it, do not fail it.
