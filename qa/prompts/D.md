# Worker D — POS/Retail, Returns Engine, Imports & Suppliers

Your test directory: `tests/integration/retail/`. Suggested files:
`shifts.test.js`, `retail-sales.test.js`, `retail-returns.test.js`, `returns-engine.test.js`,
`imports.test.js`, `suppliers.test.js`.

## Assigned routes (25) — every one must be exercised

Retail (10): `POST /api/retail/admin/fix-price`, `GET /api/retail/admin/zero-cost-products`,
`GET /api/retail/products/search`, `POST /api/retail/returns`, `POST /api/retail/sales`,
`GET /api/retail/sales/:id`, `GET /api/retail/shifts/:id/report`,
`POST /api/retail/shifts/close`, `GET /api/retail/shifts/current`,
`POST /api/retail/shifts/open`.

Returns (4): `GET /api/returns/history`, `GET /api/returns/invoice/:id`,
`GET /api/returns/invoices-tree`, `POST /api/returns/process`.

Imports (5): `GET /api/imports`, `POST /api/imports`, `POST /api/imports/:id/return`,
`GET /api/imports/suppliers`, `GET /api/imports/warehouse-stock`.

Suppliers (6): `GET /api/suppliers`, `POST /api/suppliers`, `DELETE /api/suppliers/:id`,
`GET /api/suppliers/:id`, `PUT /api/suppliers/:id`, `GET /api/suppliers/:id/history`.

## Spec oracles

- `readme.md` §8.3 POS & Shift Management (one open shift per branch; FEFO; products.quantity
  decrement; honest COGS with `cost_missing`; admin price repair).
- `readme.md` §8.4 Inbound Supply Shipments (multipart `items` + optional `invoiceImage`,
  `SHP-` shipment id, batch upsert, `IMPORT_CHARGE`, supplier returns via FEFO +
  `RETURN_CREDIT`).
- `readme.md` §8.5 Comprehensive Returns (invoice tree, `sold_qty - already_returned_qty`
  validation, stock re-injection, debt reduction, `returns`/`return_items` audit).
- `readme.md` route tables (~640, ~650, ~675).
- Golden Rules 1, 5, 7.

## Must-test behaviors

POS shifts:
- `GET /api/retail/shifts/current` → `{shift:null}` when none; after open, returns the branch's
  open shift. `POST /shifts/open` creates one; a second open in the same branch → 400.
- Branch isolation: branch 1 and branch 2 can each have one open shift; branch 1's
  `/current` never returns branch 2's shift; closing in branch 1 does not close branch 2.
- `POST /shifts/close` closes the caller's branch shift; with none → 400.
- `GET /shifts/:id/report` for a branch-2 shift as branch 1 → 404 (not a report).
- `GET /products/search?q=para&warehouse_id=1` returns only branch-1 stock, with nearest expiry;
  a branch-2 warehouse id does not leak.

POS sales:
- Requires an open shift; without one → 400 and no stock change.
- Valid sale: `{source_warehouse_id:1, items:[{product_id:1, qty:3, unit_price:5}]}` → 201;
  `warehouse_inventory` decreases by 3 FEFO (`expiry_date ASC`); `products.quantity` decreases
  by 3; `retail_sales.total_amount` = 15; `retail_sale_items` row with `cost_price` from the
  DB (7? no — product 1 purchase price is 2), `profit_amount` = (5-2)*3; sale is linked to the
  **branch's** open shift.
- Honest accounting: a sale of product 5 (`purchase_price = 0`) must not invent profit; the
  report must flag `cost_missing` and contribute 0 profit until `fix-price` backfills it.
- Insufficient stock → 400 and **no** partial stock/sale rows (transaction rollback).
- `GET /sales/:id` returns the sale + items; a branch-2 sale id as branch 1 → 404.
- `GET /shifts/:id/report` totals (revenue, COGS, profit) match the sale rows; `cost_missing`
  count is correct; zero-cost products appear in `/admin/zero-cost-products`; `POST
  /admin/fix-price` updates `products.purchase_price` and backfills `retail_sale_items.cost_price`.
  These admin routes must be admin-only (README says "Admins can…").

POS returns (critical):
- A return for a valid original sale must validate against `sold_qty - already_returned_qty`.
  Returning more than sold, returning a product not on the invoice, or returning against a
  nonexistent/foreign-branch invoice must be 400/404 with no stock or cash movement.
- A valid partial return restores stock and `products.quantity`, writes a negative
  `retail_sales`/`retail_sale_items` record in the caller's branch, and does not touch another
  branch's shift.
- The return must use the **caller's branch** open shift, not any global open shift.

Unified returns engine:
- `GET /api/returns/invoices-tree` returns Month → Day → Invoice nodes for dispatched wholesale
  orders and positive retail sales, branch-scoped.
- `GET /api/returns/invoice/:id` resolves a wholesale order number and a retail sale id, with
  `returnable_qty` per line; a branch-2 invoice as branch 1 → 404/403.
- `POST /api/returns/process` for a wholesale invoice: valid partial return restores stock,
  increments `products.quantity`, reduces doctor/pharmacy debt, writes `returns` +
  `return_items` + `RETURN` ledger; over-return → 400 with no partial changes; a fully returned
  order becomes `Returned`.
- Same for a retail invoice: `retail_sale_items.returned_qty` is respected; over-return → 400.
- `GET /api/returns/history` is branch-scoped and reflects processed returns.

Imports:
- `GET /api/imports`, `/suppliers`, `/warehouse-stock` are branch-scoped and shaped for the UI.
- `POST /api/imports` is multipart: `.field('items', JSON.stringify([...]))` and optionally
  `.attach('invoiceImage', Buffer.from(...), 'invoice.png')`. Valid import → 200/201;
  `import_logs` row with `SHP-` shipment id and branch; batch stock increases; existing
  matching batch (`batch_number` + `expiry_date` + `warehouse_id`) is merged, not duplicated;
  `products.quantity`, `purchase_price`, `price` update; `supplier_transactions` gets
  `IMPORT_CHARGE` for the total.
- Validation: empty items / missing supplier / missing warehouse → 400, no rows.
- `POST /api/imports/:id/return`: partial return deducts stock FEFO, increments
  `import_logs.returned_qty`, writes negative `RETURN_CREDIT`, and reduces the supplier balance
  effect; over-return → 400; full return sets `import_logs.status = 'Returned'`.
  A branch-2 import log as branch 1 → 404, no stock movement.

Suppliers:
- CRUD is branch-scoped: list/detail/update/delete only the caller's branch; branch-2 id → 404.
- Create requires company name; duplicate `supplier_code` → 400 (not 500); update round-trip.
- `GET /:id/history` returns import charges, returns, payments and
  `total_outstanding_balance`; it must equal `SUM(supplier_transactions.total_amount)` for that
  supplier (the seed creates matching transactions, so the invariant holds at t0).
- Deleting a supplier that has transactions should be rejected cleanly (4xx), not 500.

## Suspected defects to verify (reproduce before tagging)

1. `POST /api/retail/returns` destructures `original_sale_id` but **never uses it**: no check
   that the sale exists, belongs to the branch, or that `return_qty <= sold - returned`. Any
   cashier can mint stock and refunds. Critical.
2. POS sale/return shift lookup is global (`WHERE status='OPEN' ORDER BY id DESC LIMIT 1`), not
   branch-scoped; a sale can be attached to another branch's shift.
3. `GET /api/retail/sales/:id` and `GET /api/retail/shifts/:id/report` have no branch check.
4. POS sales trust a client-supplied `cost_price` when present, allowing profit manipulation;
   README's honest-accounting rule implies the DB cost must win.
5. `/api/retail/admin/*` routes have no admin/permission gate.
6. `POST /api/imports/:id/return` loads the import log by id with no branch check, then deducts
   stock using `importLog.warehouse_id` and the caller's branch — cross-branch corruption.
7. Full import return executes `UPDATE import_logs SET status = "Returned"` (double quotes =
   identifier in PostgreSQL) → 500 on the final return.
8. `POST /api/imports` does not verify the warehouse belongs to the caller's branch.
9. `DELETE /api/suppliers/:id` is a hard delete; with transactions the FK may 500.
10. Retail return/import-return validation failures often return 500 instead of 400.

Number these `D-BUG-n`, add `test.failing` with `@known-bug D-BUG-n`, and record expected vs
actual in `qa/status/D.json`. Do not assert 500 as correct. For FEFO, test the documented
`expiry_date ASC` order only.

## Done criteria

Route table complete in `qa/status/D.json`, suite green with `test.failing` for confirmed bugs,
committed on `qa/D`, final line `QA_WORKER_DONE:D`.
