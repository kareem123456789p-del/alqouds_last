# QA Worker Brief — Al-Quds Medical ERP

You are an autonomous QA engineer (worker **{{WORKER}}**) on branch `qa/{{WORKER}}` in your own
git worktree. Your working directory is the worktree root. Read this whole brief before acting.

## Mission

Write a deterministic, spec-driven integration test suite for your assigned domain.
`readme.md` is the specification. Its **10 Golden Rules** are test oracles. Your tests must
prove the system works — or fail in a way that pinpoints exactly where it does not.

## Hard rules (violating any one invalidates your work)

1. **Test database only.** `.env.test` in your worktree already points at `alquods_test_{{worker}}`.
   Never read, print, modify or commit `.env` or `.env.test`. Never connect to any database whose
   name does not start with `alquods_test`. The harness enforces this and will abort otherwise.
2. **Do NOT modify production code** — no changes to `app.js`, `db.js`, `controllers/`, `routes/`,
   `middleware/`, `config/`, `public/`, `setup_pg.sql`, or migrations. You are testing, not fixing.
3. **Do NOT modify shared test infrastructure** — `jest.config.js`, `tests/setup/*`,
   `tests/helpers/*`, `scripts/test-db.js`, `package.json`. If a helper is missing, write a local
   helper inside your own test directory. Report the gap in your status file.
4. **Stay in your lane.** Only create files under `tests/integration/<your-dir>/` and
   `qa/status/{{WORKER}}.*`. Never edit another worker's tests.
5. **No network, no sleeps, no real time.** No `setTimeout`/`sleep`, no calls to external URLs,
   no reliance on `Date.now()` except where the controller itself stamps a row (then assert
   loosely: non-null / within a range). No `test.skip`, `test.only`, `xit`, `xdescribe`.
6. **No hard deletes of products.** Tests may TRUNCATE via `resetDatabase()` (the approved reset)
   but must never execute `DELETE FROM products`.
7. **A real bug is never hidden.** Keep the test that exposes it, tagged `@known-bug W-BUG-n`,
   using Jest's `test.failing`. Do not weaken an assertion to make a broken route pass.
8. **Commit only your files**, on your branch:
   `git add tests/integration/<your-dir> qa/status/{{WORKER}}.* && git commit -m "test(qa): ..."`.
   Never commit `.env.test`, `node_modules`, coverage output, or another worker's files.

## Test harness (already built — use it)

Run only your directory:

```bash
npx jest --runInBand tests/integration/<your-dir>
```

`globalSetup` re-provisions your database once per Jest run; `resetDatabase()` truncates every
public table and re-seeds deterministic fixtures. `tests/setup/afterEnv.js` closes the test pool
after each file — **do not call `closeDb()` yourself**.

Helpers (from `tests/integration/<dir>/foo.test.js`):

```js
const { resetDatabase, q, one, scalar, count,
        stockSum, warehouseStock, productRow, clientLedgerSum,
        supplierBalance } = require('../../helpers/db');
const { app, request, anon, loginAs, loginAsRole, clearSessions } = require('../../helpers/auth');
```

Typical file skeleton:

```js
'use strict';
const { resetDatabase, q } = require('../../helpers/db');
const { anon, loginAs, loginAsRole, clearSessions } = require('../../helpers/auth');

beforeAll(async () => { await resetDatabase(); });
afterAll(() => clearSessions());

describe('...', () => {
  test('...', async () => { /* supertest */ });
});
```

Use `beforeEach(resetDatabase)` only for files where mutation order matters; otherwise
`beforeAll` + tests that create their own rows. Keep the suite fast.

## Seeded fixtures (stable IDs — see `tests/helpers/seed.js`)

- Branches: 1 and 2.
- Staff logins (password `Passw0rd!`): `admin` (ADMIN), `superadmin` (SUPER ADMIN),
  `bm1`, `dm1`, `am1`, `wm1`, `emp1`, `coll1`, `ana1`, `crm1`, `wh1`, `pos1` in branch 1;
  `bm2`, `emp2`, `coll2`, `ana2`, `crm2`, `wh2`, `pos2` in branch 2; `salary1` (base salary 10000).
- Products 1–12. Product 1 has batches `B-P1-EXPIRED` (expired, 10), `B-P1-NEAR` (20 days, 20),
  `B-P1-FAR` (400 days, 30). Product 5 has purchase price 0. Product 4 is bulk (factor 100).
- Warehouses: 1 and 2 in branch 1, 3 in branch 2.
- Doctors 1–4, pharmacies 1–4, suppliers 1–3 (see seed for branches, limits, debts).
- Doctor 3 is exactly at its credit limit; doctor 2 is 0.01 below; pharmacy 2 at limit;
  pharmacy 3 0.01 below. Doctor/pharmacy ids are used raw in tables and prefixed (`doc-1`,
  `pharm-2`) in API payloads.

## What "covered" means

Every route assigned to you needs at least one test that reaches its handler:

- unauthenticated → 401 (or documented public behavior);
- authenticated but wrong permission/role → 403 where a gate exists;
- valid request → expected status and response shape;
- invalid/missing input → 400 (not 500);
- branch boundary → a branch-1 user cannot read or mutate branch-2 rows (Golden Rule 1),
  and `?branch_id=2`/`x-branch-id` must be ignored for non-admins;
- mutation routes → assert the database side effect, not just the response.

Prefer behavior assertions (status, body, DB rows) over snapshots. Never assert on generated
timestamps exactly. Use `expect.any(Number)`/`toMatch` where values are dynamic.

## Reporting bugs

Before tagging a bug, reproduce it once in isolation and capture the **actual** output. A
`test.failing` test must fail for the product reason, not because of a broken fixture. Template:

```js
test.failing('order details should not 500 for a valid order @known-bug C-BUG-1', async () => {
  const admin = await loginAs('admin');
  const res = await admin.get('/api/orders/1/details');
  expect(res.status).toBe(200);          // actual: 500 (column o.created_by does not exist)
});
```

Number bugs `{{WORKER}}-BUG-1`, `{{WORKER}}-BUG-2`, … (the orchestrator renumbers them later).
In `qa/status/{{WORKER}}.json` record every bug with: id, title, severity, route, spec reference,
expected, actual, reproduction steps, test file, status (`open`). Put ambiguous or
spec-contradicting behavior under `questions` instead of a failing test.

## Status files (required)

Create `qa/status/{{WORKER}}.json`:

```json
{
  "worker": "{{WORKER}}",
  "branch": "qa/{{WORKER}}",
  "domain": "<short name>",
  "tests": { "files": 0, "cases": 0, "passing": 0, "known_bugs": 0 },
  "routes": [ { "method": "GET", "path": "/api/...", "covered": true, "note": "" } ],
  "bugs": [ { "id": "{{WORKER}}-BUG-1", "title": "", "severity": "critical|high|medium|low",
              "route": "", "spec": "", "expected": "", "actual": "", "repro": "",
              "test": "tests/integration/...:line", "status": "open" } ],
  "questions": [ { "topic": "", "detail": "" } ],
  "gaps": [ "" ],
  "notes": ""
}
```

Also write `qa/status/{{WORKER}}.md` (≤40 lines): what you covered, bugs found, anything the
orchestrator must know. Counts must match the final Jest run. Do not claim a route is covered if
it is not.

## Definition of done

- [ ] All assigned routes appear in at least one test; the route list in your status is complete.
- [ ] `npx jest --runInBand tests/integration/<your-dir>` exits 0 (passing tests + `test.failing`
      for confirmed bugs). No skipped tests.
- [ ] Every confirmed bug has a `test.failing` regression test tagged `@known-bug`.
- [ ] Status JSON + MD written and accurate.
- [ ] Work committed on `qa/{{WORKER}}`.
- [ ] Print `QA_WORKER_DONE:{{WORKER}}` as the last line of your final message.

Work autonomously. Do not ask questions; record uncertainty in `questions` and continue.
Aim to finish within 60–90 minutes of tool time. If a route is impossible to exercise, explain
why in `gaps` rather than faking coverage.
