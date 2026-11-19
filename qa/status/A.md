# QA Worker A — status

## Coverage
All 32 routes enumerated by the brief (its "31" header is a miscount) exercised across 5 files in `tests/integration/auth/`:

- `auth.test.js` — login (cookie/64-hex/HttpOnly/24h+7d, 400/401), check, me, logout,
  refresh-permissions (live DB revoke), switch-branch (403/400/scope change).
- `rbac.test.js` — all five `/api/admin/*` routes (403 employee, 200 admin/superadmin),
  create/update staff with DB side effects + bcrypt, doctor/pharmacy write gates.
- `staff.test.js` — all six `/api/staff` routes; DB side effects, stats, branch isolation.
- `clients.test.js` — client summary (`doc-`/`pharm-`, prefix 400, unknown 404, branch),
  `/api/customers/debt` and `/debts` (403 vs 200, branch-scoped).
- `doctors-pharmacies.test.js` — 12 routes: CRUD round-trips with DB assertions, permissions,
  detail/transactions/orders, query + header branch spoofing, admin branch targeting.

## Result
`npx jest --runInBand tests/integration/auth` → 5 suites passed, **85 tests passed**
(73 ordinary + 12 `test.failing` regressions), 0 skipped. No production code touched.

## Bugs (all reproduced in isolation, `test.failing` + `@known-bug` tags)
- **A-BUG-1 (critical)** `/api/staff` writes have no Admin gate: emp1 gets 201/200 for
  create/update/delete, including a branch-2 staff hard delete.
- **A-BUG-2 (high)** `/api/staff` reads ignore branch scope: emp1 sees all 20 staff and can
  GET branch-2 staff id 12; query/header overrides do not help.
- **A-BUG-3 (medium)** `/api/staff/stats` is global (20/20/0) instead of branch 1 (13/13/0).
- **A-BUG-4 (medium)** `/api/doctors/:id/orders` returns 200 [] for branch-2/unknown ids.
- **A-BUG-5 (high)** login accepts staff with `status='leave'` (200 + valid session).
- **A-BUG-6 (medium)** switch-branch with `branch_id:'abc'` → 500 (PG 22P02), not 400.
- **A-BUG-7 (high)** pharmacy PUT/DELETE return 200 for branch-2 rows without changing them.

## Orchestrator notes
- Five open questions in `A.json`: switch-branch 400-vs-404 contract, ambiguous hard-delete
  ledger handling, credentialless `/api/staff` rows, the brief's stale `orders.created_by`
  suspicion (not reproducible — `branch_id` exists after the harness migration), and the
  brief's 31-vs-32 route-count discrepancy.
- Suspected defect #1 in the brief (NOT NULL credentials causing a 500 on POST /api/staff)
  was **not** confirmed: both columns are nullable in the provisioned schema; the real defect
  is the missing permission/branch gate (A-BUG-1).
- Suspected defect #2 (staff DELETE FK 500) not reproduced; DELETE succeeds, unguarded.
- No harness/helper gaps. `node_modules` is an untracked symlink and is not committed.
