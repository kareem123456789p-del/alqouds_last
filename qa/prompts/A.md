# Worker A — Authentication, RBAC, Branch Isolation, Staff & Client Directories

Your test directory: `tests/integration/auth/`. Suggested files:
`auth.test.js`, `rbac.test.js`, `staff.test.js`, `clients.test.js`, `doctors-pharmacies.test.js`.

## Assigned routes (31) — every one must be exercised

Auth (6): `GET /api/auth/check`, `POST /api/auth/login`, `POST /api/auth/logout`,
`GET /api/auth/me`, `POST /api/auth/refresh-permissions`, `POST /api/auth/switch-branch`.

Admin (5, all `requireAdmin`): `GET /api/admin/branches`, `GET /api/admin/permissions`,
`GET /api/admin/staff`, `POST /api/admin/staff`, `PUT /api/admin/staff/:id`.

Staff (6): `GET /api/staff`, `POST /api/staff`, `DELETE /api/staff/:id`,
`GET /api/staff/:id`, `PUT /api/staff/:id`, `GET /api/staff/stats`.

Clients/debt (3): `GET /api/clients/:id/summary`, `GET /api/customers/debt`,
`GET /api/customers/debts`.

Doctors (7): `GET /api/doctors`, `POST /api/doctors`, `DELETE /api/doctors/:id`,
`GET /api/doctors/:id`, `PUT /api/doctors/:id`, `GET /api/doctors/:id/orders`,
`GET /api/doctors/:id/transactions`.

Pharmacies (5): `GET /api/pharmacies`, `POST /api/pharmacies`, `DELETE /api/pharmacies/:id`,
`GET /api/pharmacies/:id`, `PUT /api/pharmacies/:id`.

## Spec oracles (read these before writing tests)

- `readme.md` §Authentication (lines ~140–200): in-memory sessions, 64-hex token, HttpOnly
  `session_token`, 24h / 7d "remember", `/check` re-reads role+permissions live from the DB.
- `readme.md` §Multi-Branch Scoping: non-admins are FORCED to `assigned_branch_id`;
  `?branch_id=` and `x-branch-id` are ignored for them; admins may target any branch.
- `readme.md` route tables (~590, ~692, ~721, ~749) for documented method/permission/payload.
- Golden Rule 1 (`readme.md` line ~1002): never trust body/query branch for non-admins.
- Golden Rule 6: client ids are `doc-<id>` / `pharm-<id>`; split on `[-_]`.

## Must-test behaviors

Auth/session:
- login 200 with `{registration_number, password}`; cookie set; response body has no
  `password_hash`; wrong password 401; unknown user 401; missing fields 400 (not 500);
  inactive/`status != active` user rejected.
- `/api/auth/check` anonymous → 401; authenticated → `authenticated: true`, user id/role/branch,
  permissions array. `/me` mirrors it.
- logout invalidates the session: the same agent is 401 afterwards; a second logout is safe.
- `refresh-permissions` reflects a live DB change: delete a `staff_permissions` row directly,
  call refresh, then assert the permission is gone from the session/`/check`.
- `switch-branch` admin-only (employee → 403); admin switching to branch 2 changes what
  subsequent branch-scoped reads return; invalid branch id → 400.

RBAC:
- `/api/admin/*` is 403 for `emp1`, 200 for `admin` and `superadmin`.
- Doctor/pharmacy writes: `emp1` (no perms) → 403; `crm1` (has CREATE/EDIT/DELETE) → allowed;
  `crm1` cannot create in branch 2.
- `/api/staff` writes are documented **Admin Only** and GETs **Auth + Scope**. Verify all of it.
- Permission checks must be enforced server-side (no UI-only gate).

Branch isolation (Golden Rule 1):
- Branch-1 employee listing doctors/pharmacies/staff sees branch-1 rows only, never branch-2.
- Branch-1 user `GET /api/doctors/4`, `/api/pharmacies/4`, `/api/staff/12` (branch-2 ids) → 404.
- Branch-1 user updating/deleting a branch-2 row → 404 (not 200).
- Branch-1 user sending `?branch_id=2` or `x-branch-id: 2` on doctors/pharmacies/staff still
  sees branch 1. Admin with `?branch_id=2` sees branch 2.
- Creating a doctor/pharmacy as branch-1 staff always lands in branch 1, even if the body has
  `branch_id: 2`.

Directory CRUD:
- Doctor create: missing name/specialty → 400; valid → 201, row in branch 1, defaults
  `credit_limit` 60000; list/detail/update/delete round-trip; deleting a doctor with no orders
  removes/soft-deletes per implementation and a follow-up GET is 404.
- Pharmacy create: valid payload → 201; missing required fields → 400 (a 500 is a bug);
  update/delete round-trip; branch isolation as above.
- `GET /api/doctors/:id/transactions` and `/:id/orders`: 200 with correct shape for a seeded
  doctor; 404 for a branch-2 doctor as branch-1 user; unknown id → 404 (not 500).
- `GET /api/clients/:id/summary`: `doc-1` and `pharm-1` → 200 with client + last transactions;
  invalid prefix → 400; unknown id → 404; branch-2 client as branch-1 user → 404; admin may
  pass `?branch_id=2`.
- `GET /api/customers/debt` and `/debts`: 200 for `coll1` (has `can_manage_collections`);
  403 for `emp1`; data is branch-scoped; shape is an array/object the frontend can consume.
- `GET /api/staff/stats`: counts match `SELECT COUNT(*)` per status in the caller's branch
  (or document the actual global behavior as a bug if README's "Auth + Scope" is violated).

## Suspected defects to verify (do not assume — reproduce first)

1. `controllers/staffController.js` has **no permission gate and no branch filter**:
   any employee can list all staff across branches, create/update/delete staff. README says
   writes are Admin Only and reads are scoped. Also `POST /api/staff` inserts without
   `registration_number`/`password_hash`, which are NOT NULL after `migrate_auth.js` → likely 500.
2. `DELETE /api/staff/:id` is a hard delete and may 500 on FK references; README expects a
   managed delete.
3. `GET /api/doctors/:id/orders` joins `orders.created_by`, a column that may not exist
   (check `setup_pg.sql`) → 500 on a valid doctor.
4. Doctor/pharmacy `DELETE` are hard deletes; if the row has orders/transactions the FK may
   turn a legitimate delete into a 500. If the spec is ambiguous, record it under `questions`.

Number these `A-BUG-n`, add a `test.failing` with `@known-bug A-BUG-n`, and record expected vs
actual (status + body) in `qa/status/A.json`. Never assert a 500 as correct.

## Done criteria

Route table complete in `qa/status/A.json`, suite green with `test.failing` for confirmed bugs,
committed on `qa/A`, final line `QA_WORKER_DONE:A`.
