# Bug Ledger — Al-Quds Medical ERP QA

> Status legend: **confirmed** = reproduced against the test DB; **suspected** = identified by
> code reading, worker verifying; **fixed** = fix committed with a regression test.
> Worker-local ids (`A-BUG-1`, …) are mapped to the `BUG-n` ids below during P3.

| ID | Severity | Area | Summary | Status |
|---|---|---|---|---|
| BUG-001 | high | install | README migration list is incomplete; controllers write `branch_id` on `order_items`, `retail_sale_items`, `supplier_transactions`, `client_transactions`, and require undocumented `staff`/`warehouses` migrations. A fresh install cannot boot. | **fixed** `c859a39` |
| BUG-002 | critical | staff/RBAC | `/api/staff` writes have no permission gate and reads have no branch filter; any employee can list all staff and create/update/delete staff. `POST /api/staff` also omits `registration_number`/`password_hash`, which are NOT NULL → 500. | suspected |
| BUG-003 | high | orders | `GET /api/orders/:id/details` joins `staff s ON o.created_by = s.id`; `orders.created_by` does not exist → 500 for every valid order. | suspected |
| BUG-004 | critical | orders/scope | `GET /api/orders`, order details/items, dispatch, cancel and return are not branch-scoped. A branch-1 user can read and mutate branch-2 orders (Golden Rule 1). | suspected |
| BUG-005 | high | orders/tx | `createOrder` returns early inside an open transaction (missing fields, unknown client) without rollback; the released connection stays `idle in transaction`. | suspected |
| BUG-006 | high | orders | `GET /api/orders/clients` queries a nonexistent `clients` table → 500. | suspected |
| BUG-007 | critical | POS returns | `POST /api/retail/returns` destructures `original_sale_id` but never uses it: no invoice existence/branch check and no `sold - returned` validation. Arbitrary stock and refunds can be minted. | suspected |
| BUG-008 | high | imports | Full supplier return executes `UPDATE import_logs SET status = "Returned"`; PostgreSQL treats double quotes as an identifier → 500 on the final return. | suspected |
| BUG-009 | critical | transfers | `POST /api/transfers` accepts negative quantities; shipping then does `current_stock - (-qty)`, increasing stock. | suspected |
| BUG-010 | high | products | `PUT /api/products/:id` writes `parseFloat(price) || 0` unconditionally; a partial update wipes the price, and a nonexistent id returns success. | suspected |
| BUG-011 | high | inventory | `PUT /api/inventory/:id` writes `current_stock` without validation; null → 500 and negative stock is persisted. | suspected |
| BUG-012 | critical | analytics/scope | Analytics endpoints accept `?branch_id=2` from non-admins and use it (`getSummary`, `getBranchPerformance`, `getSalesPurchasesTimeline`, `getTopProducts`, `getCategoryDistribution`, `getCriticalAlerts`, `getSuppliersPayables`). Golden Rule 1 violation. | suspected |
| BUG-013 | high | Arabic PDF | `fixArabic()` calls `bidiEngine.getReorderedString(reshaped, 'rtl')`; bidi-js expects `(string, embeddingLevelsResult, …)`. It throws, is caught, and returns raw text — no shaping/reordering in any PDF. Golden Rule 9 is effectively broken in `public/js/arabic_pdf_helpers.js` and `scripts/build_arabic_pdf.js`. | **confirmed** (orchestrator, Node repro) |
| BUG-014 | medium | pages/RBAC | `GET /dashboard.html` is behind `requireAuth` but not `requireAdmin`; any employee can load the admin dashboard HTML. | suspected |
| BUG-015 | medium | pages | `GET /` tests `'ADMIN' \|\| 'Admin' \|\| 'Super Admin'`; the seeded `SUPER ADMIN` value is not matched, so a super admin is sent to `/index.html` instead of `/dashboard`. | suspected |
| BUG-016 | high | withdrawals | Withdrawals accept negative amounts (only `!amount` is checked) and do not scope the staff lookup: a branch-1 user can record a withdrawal for branch-2 staff under branch 1. | suspected |
| BUG-017 | high | POS/retail | POS sale/return shift lookup is global, not branch-scoped; sales can attach to another branch's open shift. `GET /sales/:id` and `/shifts/:id/report` also lack branch checks. | suspected |
| BUG-018 | high | POS/retail | `/api/retail/admin/*` (zero-cost list, fix-price) has no admin/permission gate; sales trust a client-supplied `cost_price`, allowing profit manipulation. | suspected |
| BUG-019 | medium | imports/scope | `POST /api/imports/:id/return` loads the import log by id with no branch check and deducts stock using the log's warehouse with the caller's branch — cross-branch corruption. `POST /api/imports` also does not verify the warehouse belongs to the caller's branch. | suspected |
| BUG-020 | medium | collections | Any prefix other than `doc` is treated as a pharmacy, so `xyz-1` silently targets pharmacy 1 instead of 400 (Golden Rule 6). Overpayment can drive debt negative. | suspected |
| BUG-021 | medium | suppliers | `DELETE /api/suppliers/:id` is a hard delete; with transactions present the FK may turn a legitimate delete into a 500. | suspected |
| BUG-022 | medium | transfers | `updateStatus` computes `isAdmin` from mixed-case strings and does not recognise `SUPER ADMIN`, so a super admin may be blocked from shipping/receiving/cancelling across branches. | suspected |
| BUG-023 | medium | transfers | `transfer_code` is generated from `COUNT(*) + 1`; deletes or concurrent creates can collide on the unique code → 500. | suspected |
| BUG-024 | medium | dashboard | `registered_clients` counts doctors only while the UI labels it as the client database (pharmacies are clients too). | suspected |

## Business risks / spec ambiguities (not failing tests)

- **FEFO includes expired batches.** README mandates `ORDER BY expiry_date ASC` without an
  expired filter, so the code is spec-compliant, but selling expired stock is a real business
  risk. Recommend excluding `expiry_date < CURRENT_DATE` from automatic dispatch/retail FEFO.
- **Client-supplied prices.** `createOrder` and POS sales accept `unit_price`/`cost_price` from
  the request. README calls order prices "frozen snapshots", which may imply server-side
  validation; today a client can set `unit_price: 0` and bypass the credit limit.
- **Overpayment.** Collections allow paying more than `total_debt`, producing negative debt.
  The README only says "decrements"; decide whether to reject or cap.
- **Hard deletes.** Doctor/pharmacy/staff/supplier/warehouse deletes are hard SQL deletes; the
  README does not specify soft-delete semantics outside the product catalog. FKs may produce
  500s where a 409/400 is expected.

## Fixed

### BUG-001 — incomplete migration instructions (fixed `c859a39`)

- **Symptom:** a fresh database created from README instructions lacks `branch_id` on
  `order_items`, `retail_sale_items`, `supplier_transactions`, `client_transactions`, and lacks
  columns added by `migrate_auth.js`, `migrate_inventory_permission.js`,
  `migrate_warehouses_isolation.js`, `migrate_strict_isolation.js`.
- **Fix:** `migrate_missing_branch_columns.js` + `setup_pg.sql` updated; the test provisioner
  applies the required-but-undocumented migrations and verifies 26 tables / 10 critical columns.
- **Regression:** `tests/integration/schema.test.js`.
