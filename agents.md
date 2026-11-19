# AGENTS.md — Master AI Agent Handover Guide

> **Quick AI Instruction**: If you are an AI model assigned to work on the Al-Quds Medical ERP repository, read this file first. It contains everything you need to understand the current state, run the test suites, review fixed defects, and continue engineering work.

---

## 1. Quick Facts & Environment

- **Repository**: `/home/ahmed/Projects/alqouds_last`
- **Current Branch**: `qa/full-coverage`
- **Application**: Al-Quds Medical ERP & Inventory System (مركز القدس الطبي)
- **Tech Stack**: Node.js (Express 4), PostgreSQL 18.6 with mysql2-compat layer (`db.js`), Vanilla JS frontend.
- **Database Connection**: PostgreSQL running on port **5433** (cluster: `~/.local/share/alquods-qa/pgdata`), test database: `alquods_test_main`. Auth: trust.
- **Environment File**: `.env.test` (configured for test DB; gitignored).
- **Test Runner**: Jest 29 (`--runInBand`, serial execution).

---

## 2. Project Status & Gate Verdict

| Phase | Description | Status |
|---|---|---|
| **P0: Recon** | Route inventory, baseline schema audit | ✅ Completed (`qa/ROUTE_INVENTORY.md`, 111 routes) |
| **P1: Foundation** | Deterministic test DB, harness, fixtures, auth helpers, smoke test | ✅ Completed (`c859a39`, `1330472`) |
| **P2: Domain Test Suites** | Comprehensive integration suites across all 5 functional domains | ✅ Completed (Workers A–E) |
| **P3: Invariants & ACID** | Cross-domain invariants, conservation laws, concurrency, property tests | ✅ Completed (Worker F) |
| **P4: Review & AQE** | Code review, audit trail, coverage metrics (83.43% line, 64% branch) | ✅ Completed |
| **P5: Bug Remediation** | Full remediation of all 28 identified bugs (BUG-001..BUG-028) | ✅ Completed (405/405 tests passing) |
| **Quality Gate Verdict** | **PASS (READY TO SHIP)** | ✅ Verified |

---

## 3. Test Suite & Verification Commands

All 32 Jest test suites (406 integration tests) and 3 Playwright E2E test suites (12 browser tests) are passing with 0 failures, 0 skipped:

```bash
# Run all 32 Jest test suites (smoke + 31 integration suites)
npm test

# Run only Jest integration suites
npm run test:int

# Run browser-based Playwright E2E test suites (Auth, Navigation, POS Retail)
npm run test:e2e

# Run a specific domain suite:
npx jest tests/integration/auth         # Auth, RBAC, Staff, Clients, Doctors/Pharmacies (5 suites, 85 tests)
npx jest tests/integration/inventory    # Products, Inventory, Warehouses, Transfers (5 suites, 89 tests)
npx jest tests/integration/finance      # Orders, Collections, Withdrawals (6 suites, 65 tests)
npx jest tests/integration/retail       # POS Retail, Returns, Imports, Suppliers (6 suites, 82 tests)
npx jest tests/integration/ui           # Analytics, Dashboard, Pages, Arabic PDF (4 suites, 54 tests)
npx jest tests/integration/invariants   # Invariants, Atomicity, Concurrency, Fast-Check (4 suites, 19 tests)
npx playwright test tests/e2e/auth.spec.js        # Authentication & Session E2E
npx playwright test tests/e2e/navigation.spec.js  # Operational Navigation & RTL Views
npx playwright test tests/e2e/pos-retail.spec.js  # POS Cashier & Retail Interface
```

---

## 4. Comprehensive Repository Documentation Guide

Every incoming AI agent should use these documents to navigate, understand, and safely modify the codebase:

| Document / Location | Primary Purpose | How It Guides Incoming Agents |
|---|---|---|
| [agents.md](file:///home/ahmed/Projects/alqouds_last/agents.md) | **Master Handover Guide** | **Start here.** Quick orientation, environment facts, test commands, and high-level architectural state. |
| [continuous.md](file:///home/ahmed/Projects/alqouds_last/continuous.md) | **Continuous State & Architecture** | Single source of truth for complete file inventory, PostgreSQL cluster details, migration sequence, and domain division. |
| [readme.md](file:///home/ahmed/Projects/alqouds_last/readme.md) | **System Specification & Oracles** | Authoritative requirements document containing the **10 Golden Rules**, route tables, RBAC permissions, and business rules. |
| [qa/BUSINESS_LOGIC_AND_TEST_PLAN.md](file:///home/ahmed/Projects/alqouds_last/qa/BUSINESS_LOGIC_AND_TEST_PLAN.md) | **Business Logic Decisions & User Q&A** | Holds the active domain questions, user decisions, route options, and implementation directives for new features or behavior changes. |
| [qa/BUGS.md](file:///home/ahmed/Projects/alqouds_last/qa/BUGS.md) | **Defect Ledger (BUG-001..BUG-028)** | Complete history of all 28 identified bugs, with reproduction steps, affected endpoints, severity, and verified fix commits. |
| [qa/QA_REPORT.md](file:///home/ahmed/Projects/alqouds_last/qa/QA_REPORT.md) | **Executive QA Audit & Coverage** | Formal QA sign-off containing Istanbul test coverage stats (lines/branches), Golden Rules compliance, and deployment readiness verdict. |
| [qa/STATE.md](file:///home/ahmed/Projects/alqouds_last/qa/STATE.md) | **Orchestrator Checkpoint** | Chronological record of commits, multi-agent worker status (Workers A–F), and phase progression. |
| [qa/ROUTE_INVENTORY.md](file:///home/ahmed/Projects/alqouds_last/qa/ROUTE_INVENTORY.md) | **Canonical Route Map** | Complete inventory of all 111 API endpoints across 19 route modules with HTTP methods, query parameters, and access controls. |
| [qa/TRACEABILITY.md](file:///home/ahmed/Projects/alqouds_last/qa/TRACEABILITY.md) | **Requirements Traceability Matrix** | Bidirectional mapping linking every specification clause and Golden Rule to dedicated integration test suites. |
| [setup_pg.sql](file:///home/ahmed/Projects/alqouds_last/setup_pg.sql) & [scripts/](file:///home/ahmed/Projects/alqouds_last/scripts/) | **Database Schema & Migrations** | Baseline PostgreSQL DDL and chronological migration scripts executed by `tests/setup/globalSetup.js`. |
| [tests/helpers/](file:///home/ahmed/Projects/alqouds_last/tests/helpers/) | **Test Infrastructure Helpers** | `db.js` (raw pg queries & stock calculations), `auth.js` (cookie jars & role login helpers), and `seed.js` (multi-branch test data generator). |

---

## 5. Summary of Bug Remediations (BUG-001..BUG-028)

1. **Schema & Foundations**: Added missing `branch_id` columns across transactional tables (`c859a39`).
2. **Domain 1 (Auth/RBAC/Staff/CRM)**: Fixed staff permission checks (`requireAdmin`), branch-scoped staff queries, and doctor/pharmacy CRUD isolation (`4c50c63`).
3. **Domain 2 (Products/Inventory/Transfers)**: Fixed product price erasure on partial update (404 on nonexistent), non-negative inventory validations, warehouse foreign branch check, destination branch validation, positive transfer quantities, row-level locking (`SELECT ... FOR UPDATE`) preventing double-ship race conditions, and `warehouse_id` on new batch creation (`4b38b19`).
4. **Domain 3 (Wholesale Orders/Finance)**: Fixed nonexistent `clients` table lookup (union of `doc-` and `pharm-`), `orders.created_by` column, early validation open transaction leaks, branch scoping on order dispatch/cancellation, and total debt calculations (`87c2d3a`).
5. **Domain 4 (Retail/POS/Returns/Suppliers)**: Secured admin fixing routes with `requireAdmin`, scoped retail sales and shifts to caller branch, validated POS return invoices and product quantities against original sales, fixed double-quote SQL syntax error in import returns, prevented deleting suppliers with active transactions, and fixed supplier history queries (`996142c`).
6. **Domain 5 (Analytics/Dashboard/Pages/PDF)**: Enforced strict branch isolation preventing non-admin branch override via `?branch_id=2`, fixed client count in dashboard to include both doctors and pharmacies, guarded `/dashboard.html` against regular employees, fixed root `/` redirect for admins and super admins, and resolved the `bidi-js` Arabic text reshaping crash (`17039d1`).

---

## 6. Next Steps for Incoming Agents

If assigned further tasks on this project:
1. Verify clean git working directory: `git status`.
2. Run test suite to verify baseline health: `npm test`.
3. If deploying or creating PR:
   - Ensure branch `qa/full-coverage` is up to date with remote: `git push origin qa/full-coverage`.
   - Never weaken any test or revert Golden Rule enforcements.
