# Worker E — Analytics, Dashboard, Frontend Pages, Arabic PDF Pipeline

Your test directory: `tests/integration/ui/`. Suggested files:
`analytics.test.js`, `dashboard.test.js`, `pages.test.js`, `arabic-pdf.test.js`.
Optional browser spec: `tests/e2e/ui.spec.js` + `playwright.config.js` (see below).

## Assigned routes (14 + 19 pages)

Analytics (9): `GET /api/analytics/branch-performance`, `GET /api/analytics/branches`,
`GET /api/analytics/category-distribution`, `GET /api/analytics/critical-alerts`,
`GET /api/analytics/sales-purchases-timeline`, `GET /api/analytics/summary`,
`GET /api/analytics/suppliers-payables`, `POST /api/analytics/suppliers/pay`,
`GET /api/analytics/top-products`.

Dashboard (1): `GET /api/dashboard/stats`.

Page routes (4): `GET /`, `GET /dashboard`, `GET /pos`, `GET /pos.html`.

Static pages (19): every file in `public/*.html` — `admin_fix`, `analytics`, `collections`,
`dashboard`, `doctors`, `import`, `index`, `inventory`, `login`, `orders`,
`pharmacy_directory`, `pos`, `products`, `retail_sales`, `staff_directory`, `suppliers`,
`transfer`, `warehouse`, `withdrawals`.

## Spec oracles

- `readme.md` §8.9 Analytics (period filters, `branch_id=all` for admins, KPI definitions).
- `readme.md` §Authentication (roles, default redirects: ADMIN/SUPER ADMIN → `/dashboard`,
  everyone else → `/index.html`).
- `readme.md` §Frontend Architecture (~790): unauthenticated → `/login.html`; missing
  `can_manage_collections` on `collections.html` → `/index.html`; missing `can_manage_analytics`
  on `analytics.html` → `/index.html`.
- `readme.md` §11 Arabic PDF Generation (Golden Rule 9: always pass through `fixArabic()`).
- Golden Rule 1 (branch scoping).

## Must-test behaviors

Analytics data setup: the seed has no sales/imports. Insert deterministic rows **directly with
SQL** (`q()` from the helper) so each KPI is exact — do not depend on other controllers:
e.g. one dispatched order (branch 1, 100), one dispatched order (branch 2, 200), one retail sale
(branch 1, 50), one retail sale (branch 2, 70), one import_log (branch 1, 30), one return
(branch 1, 10). Read `setup_pg.sql` for required columns and insert only what is needed.
Use `period=all_time` where possible so date ranges do not make assertions flaky.

- `ana1` (has `can_manage_analytics`) gets 200 from every analytics endpoint; `emp1` gets 403.
- `GET /summary`: response has `total_sales`, `total_net_profit`, `total_purchases`,
  `total_payables`, `inventory_value` objects with `value`/growth fields; branch-1 totals match
  your SQL fixtures and exclude branch-2 rows; admin `?branch_id=all` includes both branches.
- `GET /branches`: admin sees both branches (`is_admin:true`); `ana1` sees only branch 1.
- `GET /branch-performance`: admin `?branch_id=all` returns one entry per active branch with
  revenue/profit; `ana1` returns only branch 1.
- `GET /sales-purchases-timeline`, `/top-products`, `/category-distribution`: arrays with
  non-negative numeric values; branch-1 call excludes branch-2-only products.
- `GET /critical-alerts`: arrays for dead stock/shortages/expiry risks/credit breaches; a
  branch-2-only product must not appear for `ana1`.
- `GET /suppliers-payables`: supplier list with invoice totals; branch-scoped.
- `POST /suppliers/pay` as `ana1` for supplier 1 with amount 100 → 200/201; `supplier_payments`
  row in branch 1 and the payables total drops by 100; amount 0/negative/missing → 400;
  paying a branch-2 supplier (id 3) as `ana1` must not succeed in branch 2.
- **Branch-override matrix (critical):** for every analytics GET, call it as `ana1` with
  `?branch_id=2` and assert no branch-2-only data appears. A non-admin must never be able to
  switch branches via query/body (Golden Rule 1).

Dashboard:
- `GET /api/dashboard/stats` returns `pending_orders`, `dispatched_total`, `inventory_total`,
  `inventory_value`, `registered_clients`, `active_warehouses`; counts match raw SQL for the
  caller's branch; branch 2's data never leaks. Note whether `registered_clients` includes
  pharmacies or only doctors and record the discrepancy as a question/bug.

Pages (supertest, no browser needed):
- Anonymous `GET /index.html`, `/orders.html`, `/analytics.html`, `/pos`, `/dashboard` with
  `Accept: text/html` → 302 to `/login.html` (server-side `requireAuth`), never 200.
- Anonymous `GET /` → 200 and serves `login.html`; `GET /login.html` → 200.
- Logged-in employee: every operational page (`index`, `orders`, `inventory`, `warehouse`,
  `products`, `doctors`, `pharmacy_directory`, `collections`, `transfer`, `withdrawals`,
  `import`, `suppliers`, `analytics`, `admin_fix`, `staff_directory`, `retail_sales`, `pos`)
  → 200 `text/html`; `GET /dashboard` → 302 `/index.html`; `GET /dashboard.html` must not be
  readable by a non-admin (verify; a 200 is a page-level RBAC bug).
- Logged-in admin: `/dashboard` → 200 `dashboard.html`; `/` → 302 `/dashboard`.
- Logged-in **super admin**: `/` must redirect to `/dashboard` per README. The current
  mixed-case role check may redirect to `/index.html`; verify and tag if broken.
- `/pos` and `/pos.html` both serve the POS terminal (same bytes as `retail_sales.html`).
- Every page that is not `login.html`/`dashboard.html` references `js/authGuard.js`; assert
  the static asset `/js/authGuard.js` is served 200 without auth. Check that referenced local
  assets (`/js/*.js`, `/css/*.css`, `/fonts/*`, images) return 200, not 404.
- Static assets must be reachable anonymously; HTML pages must not.

Arabic PDF pipeline (Golden Rule 9):
- Load the browser bundle in Node: `global.window = {};`
  `require('../../../public/js/arabic_pdf_helpers.js')`; then `window.fixArabic` must exist.
- `fixArabic('مركز القدس')` must return a **different** string containing Arabic presentation
  forms (U+FE70–U+FEFF) in visual order; `fixArabic('ABC 123')` preserves Latin/digits;
  `fixArabic('')` → `''`; `fixArabic(null)` → `null`; a mixed string keeps both scripts.
- The same test against `scripts/build_arabic_pdf.js` (load it with `global.window = {}`).
- Static check: `public/js/orders.js`, `retail.js`, `warehouse.js` call `window.fixArabic(...)`
  around Arabic strings before `doc.text`/autoTable cells (Golden Rule 9 call sites).
- jsPDF is loaded from a CDN in the HTML and is **not installed locally**, so do not attempt a
  real PDF render in Node; document that under `gaps`. The shaping function is the testable core.

## Suspected defects to verify (reproduce before tagging)

1. Analytics branch override: `getSummary`, `getBranchPerformance`, `getSalesPurchasesTimeline`,
   `getTopProducts`, `getCategoryDistribution`, `getCriticalAlerts`, `getSuppliersPayables` all
   accept `?branch_id=2` from a **non-admin** and use it. This is a Golden Rule 1 violation.
2. `processSupplierPayment` trusts `req.body.branch_id` for non-admins and never verifies the
   supplier belongs to that branch.
3. `GET /` role check tests `'ADMIN' || 'Admin' || 'Super Admin'`; the seeded `SUPER ADMIN`
   value is not matched, so a super admin is redirected to `/index.html` instead of `/dashboard`.
4. `GET /dashboard.html` is behind `requireAuth` but not `requireAdmin`, so any employee can
   load the admin dashboard HTML (API calls are still protected).
5. `fixArabic` calls `bidiEngine.getReorderedString(reshaped, 'rtl')`, but bidi-js expects
   `(string, embeddingLevelsResult, start, end)`. It throws, catches, and returns the raw text —
   so **no Arabic shaping/reordering happens in any PDF**. Golden Rule 9 is effectively broken.
6. `registered_clients` in dashboard stats counts doctors only, while the UI labels it as the
   client database (pharmacies are clients too). Verify against `public/js/main.js`.

Number these `E-BUG-n`, add `test.failing` with `@known-bug E-BUG-n`, and record expected vs
actual in `qa/status/E.json`.

## Optional browser check (timebox: 20 minutes)

If and only if the Jest page coverage is complete, add a Playwright smoke:
`playwright.config.js` with `webServer: { command: 'node -r dotenv/config app.js', env: {
DOTENV_CONFIG_PATH: '.env.test', PORT: '3105' }, url: 'http://127.0.0.1:3105/login.html' }`.
Log in through the API request context (`context.request.post('/api/auth/login', ...)`) so
cookies are shared, then assert: employee visiting `/collections.html` without
`can_manage_collections` is redirected to `/index.html`; `ana1` visiting `/analytics.html` is
allowed; anonymous `/orders.html` lands on `/login.html`. If Chromium cannot launch in this
environment, record it in `gaps` and do not fake it.

## Done criteria

Route/page table complete in `qa/status/E.json`, suite green with `test.failing` for confirmed
bugs, committed on `qa/E`, final line `QA_WORKER_DONE:E`.
