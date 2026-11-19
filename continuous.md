# CONTINUOUS.md — Al-Quds Medical ERP QA Continuation Guide

> Purpose: This file is the single source of truth for project state, file inventory, environment, bugs, and next steps. For a concise entry point, see [agents.md](file:///home/ahmed/Projects/alqouds_last/agents.md).
>
> Project: Al-Quds Medical Inventory & ERP System (مركز القدس الطبي) — Node/Express + PostgreSQL multi-branch medical ERP.
> Repo: /home/ahmed/Projects/alqouds_last
> Branch: qa/full-coverage
> Last updated: 2026-11-20
> Gate Verdict: PASS (READY TO SHIP) — 32 test suites, 405 tests passing, 28/28 bugs resolved.

---

## 1. PROJECT OVERVIEW

A multi-branch medical supply ERP with strict data isolation (Golden Rule 1), dual-entry accounting/ledgers, FEFO batch inventory, inter-branch transfers, POS/retail, Arabic PDF generation, and an in-memory session auth system.

- Spec / oracle: readme.md (contains the 10 Golden Rules, route tables, and business rules).
- Main entry: app.js — exports app; listens only under require.main === module (tests import app directly).
- Database: PostgreSQL 18.6, cluster at ~/.local/share/alquods-qa/pgdata, port 5433, trust auth.
- Test DB: alquods_test_main (main worktree).
- Test runner: Jest 29 + supertest 7, maxWorkers: 1, forceExit: true, serial. globalSetup re-provisions the DB once per run.
- Coverage: collectCoverageFrom covers app.js, db.js, config/**, middleware/**, controllers/**, routes/**.


## 2. GIT STATE & WORKER LEDGER

On branch `qa/full-coverage`

Phase Status Summary:
- P0 Recon: ✅ Completed (`qa/ROUTE_INVENTORY.md` — 111 routes mapped)
- P1 Foundation: ✅ Completed (`.env.test`, deterministic seed, fixtures, smoke harness)
- P2 Domain Suites: ✅ Completed (Workers A–E: 27 suites, 381 tests)
- P3 Merge & Invariants: ✅ Completed (Worker F: 4 suites, 19 tests)
- P4 Review & AQE: ✅ Completed (83.43% line coverage, 64% branch coverage)
- P5 Reporting & Bug Remediation: ✅ Completed (All 28 bugs BUG-001..BUG-028 remediated and verified; 405/405 tests passing clean)

Worker Table:
| Worker | Domain | Suites | Tests | Bugs Fixed | Status |
|---|---|---|---|---|---|
| A | Auth, RBAC, staff, clients, doctors/pharmacies | 5 | 85 | A-BUG-1..7 | ✅ Complete |
| B | Products, inventory, warehouses, transfers | 5 | 89 | B-BUG-1..14 | ✅ Complete |
| C | Wholesale orders, collections, withdrawals | 6 | 65 | C-BUG-1..10 | ✅ Complete |
| D | POS/retail, returns, imports, suppliers | 6 | 82 | D-BUG-1..13 | ✅ Complete |
| E | Analytics, dashboard, pages, Arabic PDF | 4 | 54 | E-BUG-1..7 | ✅ Complete |
| F | Invariants, atomicity, concurrency, property tests | 4 | 19 | F-BUG-1 | ✅ Complete |
| **Total** | **All domains + smoke & schema** | **32** | **405** | **28 / 28** | ✅ **PASS** |


## 3. COMPLETE FILE INVENTORY

### 3.1 Production code (do NOT modify — workers are testing only)

| File | Purpose |
|---|---|
| app.js | Express app, middleware, route mounting, auth guard, branch scope, error handler, root/dashboard/pos routes |
| config/db.js | Database wrapper (pg Pool) — keep compatibility |
| config/multer.js | File upload config |
| middleware/branchScope.js | Attaches req.branchId per authenticated request |
| controllers/*.js | 17 controllers: admin, analytics, auth, collection, dashboard, doctor, import, inventory, order, pharmacy, product, retail, returns, staff, supplier, transfer, warehouse, withdrawal |
| routes/*.js | 19 route files matching the controllers above |
| public/*.html | 19 pages: admin_fix, analytics, collections, dashboard, doctors, import, index, inventory, login, orders, pharmacy_directory, pos, products, retail_sales, staff_directory, suppliers, transfer, warehouse, withdrawals |
| public/js/*.js | Frontend page logic (incl. arabic_pdf_helpers.js, authGuard.js) |
| public/css/*.css | Stylesheets |
| public/fonts/*, public/*.png | Assets |

### 3.2 Test infrastructure (shared — do NOT modify)

| File | Purpose |
|---|---|
| jest.config.js | Jest config: serial, globalSetup provisions DB, coverage from production sources |
| tests/setup/env.js | Loads .env.test, enforces alquods_test* DB naming rule |
| tests/setup/globalSetup.js | Provisions test DB (setup_pg.sql + migrations) once per run |
| tests/setup/afterEnv.js | Closes test pool after each file |
| tests/helpers/db.js | q, one, scalar, resetDatabase, closeDb, stockSum, warehouseStock, productRow, clientLedgerSum, clientDebt, supplierBalance, count, openTransactionCount, activeConnectionCount, parseClientId |
| tests/helpers/auth.js | app, request, loginAs, loginAsRole, regFor, anon, clearSessions + seeded role→reg map |

### 3.3 QA artifacts (untracked — in main worktree, need committing)

| File | Purpose |
|---|---|
| qa/BUGS.md | Bug ledger: status legend, BUG-001…BUG-024 with severity/area/summary/status, business risks, fixed section |
| qa/STATE.md | Orchestrator checkpoint: mission, non-negotiables, environment, phase status, commits, worker table, contracts, open risks |
| qa/ROUTE_INVENTORY.md | Generated route inventory: 111 routes across 19 route files, diff vs README (104 documented), frontend page list (19) |

### 3.4 Temp / scratch files (root level — temporary, from previous agent's exploration)

| File | Size | Likely purpose | Action |
|---|---|---|---|
| query | 8 B | Unknown / stray | Inspect, then delete or move to tmp/ |
| scratch3.js | 469 B | Scratch exploration | Inspect, then delete or move to tmp/ |
| scratch_check.js | 621 B | Scratch check | Inspect, then delete or move to tmp/ |
| tmp_check_schema.js | 419 B | Schema check | Inspect, then delete or move to tmp/ |
| tmp_create_admin.js | 1,056 B | Create admin user | Inspect, then delete or move to tmp/ |
| tmp_doc.json | 1,062 B | JSON fixture | Inspect, then delete or move to tmp/ |
| tmp_get_admin.js | 321 B | Get admin | Inspect, then delete or move to tmp/ |
| tmp_migrate_batch.js | 1,327 B | Batch migration | Inspect, then delete or move to tmp/ |

### 3.5 Standalone root scripts (exploration / one-off fixes)

| File | Purpose |
|---|---|
| add_branch_id_to_all.js | Add branch_id columns (related to BUG-001 fix) |
| audit_complete_isolation.js | Full isolation audit |
| check_orders.js, check_schema.js, check_staff_cols.js, check_staff.js | DB/schema inspection scripts |
| test_order.js, test_uom.js | One-off order/UOM tests |

### 3.7 Other root files

| File | Purpose |
|---|---|
| alquods.sql, setup_alquods_db.sql, setup-db.js, setup_pg.js, setup_pg.sql, setup_withdrawals.js | DB setup / provisioning |
| schema_live.json, schema_orders.txt, schema_output.json, schema.txt, schema_tx.txt | Schema dumps |
| scripts/db_schema.json, scripts/db_schema.txt | Schema docs |
| ALQUODS DT (4).drawio | DB diagram (DrawIO) |
| Amiri-Regular.ttf, Cairo-Regular.ttf | Arabic fonts |
| readme.md | Full spec + Golden Rules (the oracle) |
| package.json | Scripts: start, dev, test, test:int, test:e2e, test:coverage, test:mutation, test:db, test:db:reset |
| .env.test | Test DB connection (DO NOT commit; in .gitignore) |

## 4. ENVIRONMENT SETUP

From qa/STATE.md:
- PostgreSQL 18.6, cluster ~/.local/share/alquods-qa/pgdata, port 5433, trust auth
- Main test DB: alquods_test_main
- .env.test exists at repo root (points at alquods_test_main); it is gitignored — do not read/modify/commit it
- node_modules is installed at repo root; worker worktrees symlink to it

To run the main worktree tests:
cd /home/ahmed/Projects/alqouds_last
npx jest --runInBand               # full suite (re-provisions alquods_test_main)
npx jest --runInBand tests/integration/<dir>   # one directory

Critical rule: Every test must connect only to a database whose name starts with alquods_test. The helpers enforce this and will abort otherwise. Never connect to a production/non-test DB.

## 5. WHAT IS DONE vs UNCOMPLETED

Done (committed on qa/full-coverage):
- 8b97105 chore: baseline spec and agent tooling
- 48f4ad9 chore(qa): export the Express app and only listen when run directly
- 1330472 feat(qa): deterministic test database, fixtures, helpers and smoke harness
- c859a39 fix(qa): add branch_id columns that controllers already write (BUG-001 fixed)

In progress / uncompleted:
- QA artifacts not committed: qa/BUGS.md, qa/STATE.md, qa/prompts/ are untracked. Commit them first.
- Worker A: DONE — committed `12bb4fb test(qa): add Worker A auth, RBAC, staff and client integration suite`; 5 test files, 85 tests passed (73 ordinary + 12 test.failing), 7 known bugs (A-BUG-1…A-BUG-7). But `qa/status/A.json` and `qa/status/A.md` are still UNTRACKED — commit them next. Then merge qa/A into qa/full-coverage.
- Workers B–E: NOT STARTED — all still at base commit c859a39, no test files under tests/integration/<domain>/, no qa/status/. Each needs its full domain suite written.
- Worker F: PENDING — only after A–E are merged.
- P3 merge + invariants: pending. Merge A–E branches, then worker F.
- P4 review/mutation/AQE: pending.

The tests/integration/ directory in the main worktree is empty. All worker test code lives in the separate worker worktrees (alquods-qa-A … alquods-qa-E). Worker A's tests are in alquods-qa-A/tests/integration/auth/. Workers B–E should write theirs under tests/integration/inventory/, tests/integration/finance/, tests/integration/retail/, tests/integration/ui/ respectively.

## 6. KNOWN BUGS LEDGER (from qa/BUGS.md)

| ID | Severity | Area | Summary | Status |
|---|---|---|---|---|
| BUG-001 | high | install | README migration list incomplete; fresh install cannot boot | fixed c859a39 |
| BUG-002 | critical | staff/RBAC | /api/staff writes have no permission gate, reads no branch filter; POST omits NOT NULL registration_number/password_hash → 500 | suspected |
| BUG-003 | high | orders | GET /api/orders/:id/details joins nonexistent orders.created_by → 500 | suspected |
| BUG-004 | critical | orders/scope | Orders not branch-scoped; branch-1 can read/mutate branch-2 orders | suspected |
| BUG-005 | high | orders/tx | createOrder early-returns inside open transaction without rollback; connection stays idle in transaction | suspected |
| BUG-006 | high | orders | GET /api/orders/clients queries nonexistent clients table → 500 | suspected |
| BUG-007 | critical | POS returns | POST /api/retail/returns never uses original_sale_id; no existence/branch check, no sold-returned validation | suspected |
| BUG-008 | high | imports | UPDATE import_logs SET status = "Returned" — double quotes = identifier in PG → 500 | suspected |
| BUG-009 | critical | transfers | POST /api/transfers accepts negative quantities; shipping increases stock | suspected |
| BUG-010 | high | products | PUT /api/products/:id writes parseFloat(price) || 0 unconditionally; partial update wipes price; nonexistent id returns success | suspected |
| BUG-011 | high | inventory | PUT /api/inventory/:id writes current_stock without validation; null → 500, negative persisted | suspected |
| BUG-012 | critical | analytics/scope | Analytics accept ?branch_id=2 from non-admins (Golden Rule 1 violation) | suspected |
| BUG-013 | high | Arabic PDF | fixArabic() calls bidi-js with wrong args; throws, returns raw text — no shaping in any PDF | confirmed |
| BUG-014 | medium | pages/RBAC | GET /dashboard.html behind requireAuth but not requireAdmin | suspected |
| BUG-015 | medium | pages | Root role check misses SUPER ADMIN; super admin sent to /index.html | suspected |
| BUG-016 | high | withdrawals | Negative amounts accepted; staff lookup not branch-scoped | suspected |
| BUG-017 | high | POS/retail | Shift lookup global, not branch-scoped; /sales/:id, /shifts/:id/report lack branch checks | suspected |
| BUG-018 | high | POS/retail | /api/retail/admin/* no admin gate; sales trust client-supplied cost_price | suspected |
| BUG-019 | medium | imports/scope | Import return no branch check; cross-branch stock deduction | suspected |
| BUG-020 | medium | collections | Non-doc prefix silently targets pharmacy 1 (Golden Rule 6); overpayment → negative debt | suspected |
| BUG-021 | medium | suppliers | DELETE hard delete; FK may 500 | suspected |
| BUG-022 | medium | transfers | updateStatus mixed-case isAdmin doesn't recognize SUPER ADMIN | suspected |
| BUG-023 | medium | transfers | transfer_code from COUNT(*)+1 can collide → 500 | suspected |
| BUG-024 | medium | dashboard | registered_clients counts doctors only, not pharmacies | suspected |

Business risks (not failing tests): FEFO includes expired batches; client-supplied prices; overpayment drives negative debt; hard deletes.

Rule for bugs: Never assert a 500 as correct. Confirmed bugs → test.failing tagged @known-bug <id>. Record expected vs actual in qa/status/<W>.json.


## 8. STEP-BY-STEP CONTINUATION PLAN

Follow this order. Do not skip steps.

Step 1 — Inspect temp/scratch files (10 min): Read each file in §3.4 and §3.5 to determine if it contains anything useful. Then either move useful content into the appropriate place (scripts/, migration, or a test), or delete the file / move it to a tmp/ staging folder. Do not leave mystery files in the repo root.

Step 2 — Commit the QA artifacts (5 min):
cd /home/ahmed/Projects/alqouds_last
git add qa/BUGS.md qa/STATE.md qa/ROUTE_INVENTORY.md qa/prompts/
git commit -m "chore(qa): add bug ledger, state checkpoint, route inventory and worker briefs"

Step 3 — Check worker progress (5 min): In each worker worktree, check whether the worker finished:
for w in A B C D E; do
  echo "=== Worker $w ==="
  cd /home/ahmed/Projects/alquods-qa-$w
  git --no-pager log --oneline -5
  ls qa/status/ 2>/dev/null || echo "  no status files yet"
  cd /home/ahmed/Projects/alqouds_last
done
Look for qa/status/<W>.json and qa/status/<W>.md and the final line QA_WORKER_DONE:<W>.

Step 4 — Run the main-worktree smoke suite (to confirm baseline is green):
cd /home/ahmed/Projects/alqouds_last
npx jest --runInBand
Expect: passing tests + test.failing for confirmed bugs (BUG-013 is confirmed). Exit code 0.

Step 5 — Continue P2 domain suites: Pick a worker domain not yet done and write its integration tests under tests/integration/<domain>/ (main worktree) or in the worker's own worktree, following qa/prompts/COMMON.md:
- Test every assigned route (reachable handler).
- Unauthenticated → 401; wrong permission → 403; valid → expected status+shape; invalid input → 400 (not 500); branch boundary → 404/no leak; mutation → assert DB side effect.
- Suspected defects → test.failing + @known-bug <id>.
- Write qa/status/<W>.json and qa/status/<W>.md (counts must match the final Jest run).
- Commit: git add tests/integration/<dir> qa/status/<W>.* && git commit -m "test(qa): ..."
- Finish line: QA_WORKER_DONE:<W>

Step 6 — P3 merge + worker F: After A–E are done, merge qa/A…qa/E into qa/full-coverage. Launch worker F (qa/F, alquods-test-f) for invariants, atomicity, concurrency, property tests (uses openTransactionCount, activeConnectionCount from tests/helpers/db.js).

Step 7 — P4 review / mutation / AQE gate: Independent review of all tests. Run npm run test:mutation (stryker) and check mutation score. Run AQE gate (.agentic-qe/ tooling).

## 9. COMMAND REFERENCE

Run full suite (main worktree): npx jest --runInBand
Run one worker's directory: npx jest --runInBand tests/integration/auth  (or inventory, finance, retail, ui)
Coverage: npx jest --runInBand --coverage
DB provision/reset: node scripts/test-db.js   |   node scripts/test-db.js --reset
Launch a QA worker (from main worktree): bash qa/prompts/run-A.sh   (etc. — runs in the worker's own worktree)
Check git status: git status   |   git --no-pager log --oneline -10

## 10. HARD RULES (from COMMON.md — non-negotiable)

1. Test database only. Never read/print/modify/commit .env or .env.test. Never connect to a DB not named alquods_test*.
2. Do NOT modify production code (app.js, db.js, controllers/, routes/, middleware/, config/, public/, setup_pg.sql, migrations). You are testing, not fixing.
3. Do NOT modify shared test infrastructure (jest.config.js, tests/setup/*, tests/helpers/*, scripts/test-db.js, package.json).
4. Stay in your lane. Only create files under tests/integration/<your-dir>/ and qa/status/<W>.*. Never edit another worker's tests.
5. No network, no sleeps, no real time. No setTimeout/sleep, no external URLs, no test.skip/test.only/xit/xdescribe.
6. No DELETE FROM products. Reset via resetDatabase() (TRUNCATE + seed).
7. A real bug is never hidden. Keep the test, tag @known-bug W-BUG-n with test.failing. Do not weaken an assertion.
8. Commit only your files on your branch. Never commit .env.test, node_modules, coverage, or another worker's files.

## 11. IMPORTANT PATHS

- Repo root: /home/ahmed/Projects/alqouds_last
- Worker worktrees: /home/ahmed/Projects/alquods-qa-{A,B,C,D,E,F}
- PostgreSQL cluster: ~/.local/share/alquods-qa/pgdata (port 5433)
- QA artifacts: qa/BUGS.md, qa/STATE.md, qa/ROUTE_INVENTORY.md, qa/prompts/
- Temp files to triage: root-level scratch*.js, tmp_*.js, tmp_*.json, query

## 12. IMMEDIATE NEXT ACTIONS (do these first)

1. Read qa/STATE.md, qa/BUGS.md, qa/prompts/COMMON.md in full.
2. Inspect the root-level temp/scratch files (scratch3.js, scratch_check.js, tmp_*.js, tmp_*.json, query) and decide keep/delete/move.
3. Commit qa/ artifacts if not already committed.
4. Check each worker worktree for qa/status/<W>.json/.md and QA_WORKER_DONE:<W>.
5. Run npx jest --runInBand in the main worktree to confirm the baseline is green.
6. Continue the unfinished worker domain suite(s) per Step 5.


Step 8 — P5 reports: Produce ROUTE_INVENTORY, TRACEABILITY, BUGS (update qa/BUGS.md), QA_REPORT, and a 10-line summary.

## 7. GOLDEN RULES (test oracles — from readme.md)

Key cited rules:
- Golden Rule 1: Branch scoping / no cross-branch reads or mutations.
- Golden Rule 2: DELETE /api/products/:id returns 405, row unchanged.
- Golden Rule 5: Transfer state machine (PENDING → IN_TRANSIT → COMPLETED/CANCELLED); stock conserved.
- Golden Rule 6: Client ids are doc-<id> / pharm-<id>; split on [-_].
- Golden Rule 7: FEFO = ORDER BY expiry_date ASC, batches with stock > 0.
- Golden Rule 8: Debt charged once at order creation; dispatch doesn't change debt; cancel reverses; return reduces.
- Golden Rule 9: Always pass Arabic through fixArabic() before PDF output.

Read readme.md §15 for the full list.

- P5 reports: pending.

The tests/integration/ directory in the main worktree is empty. All worker test code is in the separate worker worktrees (alquods-qa-A … alquods-qa-E). If you want to add tests to the main worktree, create them under tests/integration/<domain>/ following the COMMON.md template.

| .agentic-qe/ | Agentic QE v3 memory/config/patterns/witness-keys/workers (AI agent tooling state) |
| .claude/ | Claude agent definitions, guidance shards, templates |

| verify_isolation.js | Isolation verification |

### 3.6 Scripts directory (scripts/)

Migration / setup / test scripts: add-base-salary.js, add_expiry_column.js, add_margin_columns.js, alter_doctors.js, build_arabic_pdf.js, check.js, check_schema_live.js, db_schema.json, db_schema.txt, download_amiri.js, download_b64.js, gen_route_inventory.js, import_schema.js, inject_sidebar.js, migrate_batches.js, migrate_client_tx_branch_id.js, migrate_imports.js, migrate_orders_warehouse.js, migrate_returns.js, migrate_returns_tables.js, migrate-staff.js, migrate_suppliers.js, migrate_suppliers.sql, migrate_uom.js, patch_orders.js, patch_retail_controller.js, patch_retail_html.js, patch_retail_js.js, patch_suppliers_js.js, seed_doctors.js, setup_orders.js, setup_pharmacies.js, setup_retail_tables.js, setup_suppliers.js, setup_supplier_transactions.js, setup_warehouses.js, test-db.js, test_migration.js, test_queries.js, test_returns_system.js, update_schema_supplies.js

| tmp_prod.json | 1,736 B | Product JSON | Inspect, then delete or move to tmp/ |
| tmp_warehouses.json | 686 B | Warehouse JSON | Inspect, then delete or move to tmp/ |
| tmp_wi.js | — | Warehouse inventory temp | Inspect, then delete or move to tmp/ |

| qa/prompts/COMMON.md | Shared worker brief: mission, hard rules, harness, helpers, skeleton, covered definition, bug reporting, status files, done criteria |
| qa/prompts/A.md … E.md | Per-worker assigned routes, spec oracles, must-test behaviors, suspected defects, done criteria (QA_WORKER_DONE:<letter>) |
| qa/prompts/run-A.sh … run-E.sh | Bash launchers: cd <worktree> && cat COMMON.md <worker>.md | opencode run -m <model> --auto --title "QA worker <letter>" "$PROMPT" |

| tests/helpers/seed.js | Deterministic fixtures: 2 branches, staff, UOMs, products, warehouses, batches, doctors, pharmacies, suppliers |
| tests/helpers/assertions.js | assertNoCrossBranchRows, assertNoSecrets, expectUnauthorized |
| tests/integration/ | Empty — workers A–E write their suites here (auth/, inventory/, finance/, retail/, ui/) |

## 13. ANTIGRAVITY (agy) SKILLS PLUGIN

The repo's Claude Code skills (`.claude/skills/`, 86) and OpenCode skills (`.opencode/skills/`, 84) have been packaged into an Antigravity plugin so the `agy` CLI can access them.

### What was done

- Created `/home/ahmed/Projects/alqouds_last/.agents/plugins/alqouds-skills/`:
  - `plugin.json` — manifest (`name: alqouds-skills`, version 1.0.0)
  - `skills/claude-<name>/` — copies of the 86 Claude skills (namespaced `claude-` to avoid collisions)
  - `skills/opencode-<name>/` — copies of the 84 OpenCode skills (namespaced `opencode-`)
- Installed the plugin into antigravity:
  - `agy plugin install /home/ahmed/Projects/alqouds_last/.agents/plugins/alqouds-skills`
  - Installed to `/home/ahmed/.gemini/config/plugins/alqouds-skills`
- Result: `alqouds-skills (enabled, 1.0.0)` — **154 skills** accessible to antigravity
  - (170 files installed; ~16 name-colliding variants deduplicated by SKILL.md `name` field)

### Verification

```bash
# Confirm plugin is installed and enabled
agy plugin list
# Expected: alqouds-skills (enabled, 1.0.0) — Components: 154 skills

# Re-validate the plugin (from the repo's plugin dir)
agy plugin validate /home/ahmed/Projects/alqouds_last/.agents/plugins/alqouds-skills --strict

# Re-install after any changes to the plugin dir
agy plugin install /home/ahmed/Projects/alqouds_last/.agents/plugins/alqouds-skills
```

### Notes

- Skills are registered by their SKILL.md `name` field, so Claude skills keep their original names (e.g. `a11y-ally`) and OpenCode skills keep theirs (e.g. `qe-skill-builder`).
- The 18 skills with identical names in both sets are deduplicated; one version of each shared name is registered. Antigravity namespaces skills to prevent collisions at runtime.
- If you update the repo skills, re-copy them into `.agents/plugins/alqouds-skills/skills/` and re-run `agy plugin install`.


## 13. ANTIGRAVITY (agy) SKILLS PLUGIN

The repo's Claude Code skills (`.claude/skills/`, 86) and OpenCode skills (`.opencode/skills/`, 84) have been packaged into an Antigravity plugin so the `agy` CLI can access them.

### What was done

- Created `/home/ahmed/Projects/alqouds_last/.agents/plugins/alqouds-skills/`:
  - `plugin.json` — manifest (`name: alqouds-skills`, version 1.0.0)
  - `skills/claude-<name>/` — copies of the 86 Claude skills (namespaced `claude-` to avoid collisions)
  - `skills/opencode-<name>/` — copies of the 84 OpenCode skills (namespaced `opencode-`)
- Installed the plugin into antigravity:
  - `agy plugin install /home/ahmed/Projects/alqouds_last/.agents/plugins/alqouds-skills`
  - Installed to `/home/ahmed/.gemini/config/plugins/alqouds-skills`
- Result: `alqouds-skills (enabled, 1.0.0)` — **154 skills** accessible to antigravity
  - (170 files installed; ~16 name-colliding variants deduplicated by SKILL.md `name` field)

### Verification

```bash
# Confirm plugin is installed and enabled
agy plugin list
# Expected: alqouds-skills (enabled, 1.0.0) — Components: 154 skills

# Re-validate the plugin (from the repo's plugin dir)
agy plugin validate /home/ahmed/Projects/alqouds_last/.agents/plugins/alqouds-skills --strict

# Re-install after any changes to the plugin dir
agy plugin install /home/ahmed/Projects/alqouds_last/.agents/plugins/alqouds-skills
```

### Notes

- Skills are registered by their SKILL.md `name` field, so Claude skills keep their original names (e.g. `a11y-ally`) and OpenCode skills keep theirs (e.g. `qe-skill-builder`).
- The 18 skills with identical names in both sets are deduplicated; one version of each shared name is registered. Antigravity namespaces skills to prevent collisions at runtime.
- If you update the repo skills, re-copy them into `.agents/plugins/alqouds-skills/skills/` and re-run `agy plugin install`.

