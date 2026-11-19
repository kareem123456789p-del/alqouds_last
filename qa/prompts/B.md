# Worker B — Products, Inventory, Warehouses, Inter-Branch Transfers

Your test directory: `tests/integration/inventory/`. Suggested files:
`products.test.js`, `inventory.test.js`, `warehouses.test.js`, `transfers.test.js`.

## Assigned routes (21) — every one must be exercised

Products (4): `GET /api/products`, `POST /api/products`, `DELETE /api/products/:id`,
`PUT /api/products/:id`.

Inventory (4): `GET /api/inventory`, `DELETE /api/inventory/:id`, `PUT /api/inventory/:id`,
`GET /api/inventory/batches/:warehouseId/:productId`.

Warehouse (7): `POST /api/warehouse`, `DELETE /api/warehouse/:id`, `PUT /api/warehouse/:id`,
`GET /api/warehouse/:id/inventory`, `GET /api/warehouse/list`, `GET /api/warehouse/movements`,
`GET /api/warehouse/stats`.

Transfers (6): `GET /api/transfers`, `POST /api/transfers`, `PATCH /api/transfers/:id/status`,
`GET /api/transfers/audit-logs`, `GET /api/transfers/products/:warehouseId`,
`GET /api/transfers/warehouses`.

## Spec oracles

- `readme.md` §8.1 Master-Mirror Catalog & Inventory Pattern (deletion protocol, 405 on
  `DELETE /api/products/:id`, mirror wipe for the active branch, double-lock joins).
- `readme.md` §8.6 Inter-Branch Stock Transfers (state machine, audit trail).
- `readme.md` §Database Schema (products, warehouse_inventory, warehouses, stock_transfers,
  stock_transfer_items, stock_audit_logs).
- `readme.md` route tables (~615, ~660, ~750) for documented permissions and payloads.
- Golden Rules 1, 2, 4, 5, 7.

## Must-test behaviors

Products (master catalog is global — no branch scoping):
- `GET /api/products` returns active products only, joined UOM names; after a soft delete the
  product disappears.
- `POST /api/products`: name required → 400 when missing; valid payload creates a row with
  `quantity = 0`, `price = 0`, correct `base_uom_id`/`bulk_uom_id`/`conversion_factor`;
  an unknown UOM name is created in `uom` (no duplicate).
- `PUT /api/products/:id`: updates name/UOM/factor/price. A partial update that omits `price`
  must not silently reset the price to 0 — verify against README's "update" semantics.
  Updating a nonexistent id must not return success.
- `DELETE /api/products/:id` is **405** and must not change the row (Golden Rule 2).

Inventory:
- `GET /api/inventory` is branch-scoped: branch 1 sees only branch-1 warehouses/batches;
  branch 2 sees only branch-2. `?branch_id=2` is ignored for a branch-1 employee (Golden Rule 1).
- `GET /api/inventory/batches/:warehouseId/:productId` returns only batches with stock > 0 for
  that warehouse in the caller's branch, ordered by `expiry_date ASC` (Golden Rule 7).
  A branch-2 warehouse id requested by branch 1 returns empty/404, never branch-2 rows.
- `PUT /api/inventory/:id`: updates stock/batch/expiry/threshold for a row in the caller's
  branch; a branch-2 row id returns 404; invalid/missing `current_stock` must be 400, and a
  negative stock value must be rejected (never persist negative inventory).
- `DELETE /api/inventory/:id` (id is the **product** id): sets `is_active = 0`,
  `is_deleted = 1`, keeps the `products` row, deletes `warehouse_inventory` rows only for the
  caller's branch, and returns `warehouse_rows_deleted`. The row must still exist for historical
  FKs. Deleting a product must never execute `DELETE FROM products`.

Warehouses:
- `GET /api/warehouse/list` and `/stats` are branch-scoped and their counts match raw SQL.
- `POST /api/warehouse` requires `MANAGE_WAREHOUSES_ADD` (`wh1` allowed, `emp1` 403); the new
  warehouse always lands in the caller's branch even if the body says otherwise.
- `PUT` requires `MANAGE_WAREHOUSES_EDIT`; branch-2 warehouse id → 404 for branch 1.
- `DELETE` requires `MANAGE_WAREHOUSES_DELETE`; branch-2 id → 404. Decide what should happen to
  a warehouse that still holds stock (FK error vs. rejection) and assert a 4xx, not a 500.
- `GET /api/warehouse/:id/inventory` and `/movements` are branch-scoped; unknown/foreign id
  does not leak data.

Transfers (state machine — Golden Rule 5):
- `POST /api/transfers` uses `req.branchId` as the source (body source is ignored); rejects
  same-branch destination (400) and empty items (400); rejects a batch that does not belong to
  the source branch; rejects quantity > available; a **negative or zero quantity must be 400**.
- Successful create: `stock_transfers` row `PENDING`, `stock_transfer_items` rows, source stock
  unchanged. `GET /api/transfers` shows transfers where the caller is source or destination.
- Ship (`PATCH {status:'IN_TRANSIT'}`): only source branch (or admin) may ship; only from
  `PENDING`; source batch stock decreases by exactly the quantity; `stock_audit_logs` gets a
  negative `TRANSFER_OUT` row; a second ship is rejected (400).
- Receive (`COMPLETED`): only destination branch (or admin); only from `IN_TRANSIT`; destination
  stock increases by exactly the quantity (existing batch merges, otherwise a new batch is
  created); audit gets `TRANSFER_IN`; stock is conserved across branches for that product.
- Cancel: source branch or admin; `PENDING` cancel leaves stock unchanged; `IN_TRANSIT` cancel
  restores the source stock exactly; cancelling `COMPLETED` is rejected.
- Unauthorized transition by the wrong branch → 400/403, and no stock or status changes.
- `GET /api/transfers/audit-logs` is branch-scoped. `GET /api/transfers/warehouses` and
  `/products/:warehouseId` only expose the caller's branch.

## Suspected defects to verify (reproduce before tagging)

1. `createTransfer` does not validate `quantity > 0`. A negative quantity passes the stock check
   and later **increases** source stock when shipped (`current_stock - (-5)`). Critical.
2. `createTransfer` does not verify that `item.item_id` is the product of `batch_id`. A crafted
   transfer can move product A while labelling it product B; completion then creates destination
   stock for the wrong product.
3. `createTransfer` returns **500** for business validation failures (insufficient stock,
   missing batch) where the API contract expects 400.
4. `updateStatus` computes `isAdmin` from mixed-case strings and does not recognise
   `SUPER ADMIN` (the seeded role value), so a super admin may be blocked from shipping,
   receiving or cancelling across branches.
5. `transfer_code` is generated from `COUNT(*) + 1`, so it can collide after deletes or
   concurrent creates (uniqueness constraint → 500).
6. `PUT /api/products/:id` writes `parseFloat(price) || 0` unconditionally: a partial update
   wipes the price, and updating a nonexistent id still returns success.
7. `PUT /api/inventory/:id` writes `current_stock` without validation: `undefined`/null causes
   a 500, and negative values are persisted.
8. `deleteWarehouse` is a hard delete; with stock rows present the FK may turn a legitimate
   delete into a 500.

Number these `B-BUG-n`, add `test.failing` with `@known-bug B-BUG-n`, and record expected vs
actual in `qa/status/B.json`. Do not assert 500 as correct.

## Done criteria

Route table complete in `qa/status/B.json`, suite green with `test.failing` for confirmed bugs,
committed on `qa/B`, final line `QA_WORKER_DONE:B`.
