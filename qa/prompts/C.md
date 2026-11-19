# Worker C — Wholesale Orders, Collections, Withdrawals (Money & Ledgers)

Your test directory: `tests/integration/finance/`. Suggested files:
`orders-create.test.js`, `orders-dispatch-return.test.js`, `orders-scope.test.js`,
`collections.test.js`, `withdrawals.test.js`.

## Assigned routes (19) — every one must be exercised

Orders (10): `GET /api/orders`, `POST /api/orders`, `PUT /api/orders/:id/cancel`,
`GET /api/orders/:id/details`, `PUT /api/orders/:id/dispatch`, `GET /api/orders/:id/items`,
`POST /api/orders/:id/return`, `GET /api/orders/clients`,
`GET /api/orders/history/:clientType/:clientId`, `GET /api/orders/product/:id/cost-price`.

Collections (6): `GET /api/collections`, `POST /api/collections`,
`GET /api/collections/client/:id/monthly`, `GET /api/collections/debts`,
`GET /api/collections/summary`, `GET /api/collections/transactions`.

Withdrawals (3): `GET /api/withdrawals`, `POST /api/withdrawals`, `GET /api/withdrawals/stats`.

## Spec oracles

- `readme.md` §8.2 (order lifecycle diagram: debt charged at creation, dispatch deducts stock
  only, cancel reverses debt, return restores stock + reduces debt, prefix convention).
- `readme.md` §8.7 (collections: validates client in active branch, decrements debt, writes
  `payments` + negative `client_transactions`).
- `readme.md` §8.8 (withdrawals: monthly sum, 50% flag only).
- `readme.md` route tables (~709, ~721).
- **Golden Rule 1** (branch scoping), **5** (transactions), **6** (prefix parsing),
  **8** (never double-charge debt).

## Must-test behaviors

Orders — creation:
- `POST /api/orders` with `{client_id:'doc-1', warehouse_id:1, items:[{product_id:1,
  warehouse_id:1, qty:2, unit_price:5, base_price:2, profit_margin:3}]}` → 201; order status
  `Pending`; `order_items.subtotal` = 10; doctor 1 `total_debt` +10 **exactly once**; a
  `client_transactions` row type `ORDER` amount +10 with the order's branch; physical stock
  unchanged until dispatch (Golden Rule 8).
- Same for `pharm-1` (pharmacy ledger path).
- Credit-limit boundary: doctor 3 is exactly at 60000 → any positive order 400 with a
  credit-limit message and **no** order/debt row; doctor 2 is 0.01 below → an order totalling
  0.01 is accepted, 0.02 is rejected (use qty 1 and unit_price 0.01/0.02).
- Missing client/warehouse/items → 400; unknown client → 404; malformed prefix → 400/404.
- `GET /api/orders/clients` → 200 with both doctors and pharmacies (id + name + type).
- `GET /api/orders/product/:id/cost-price` → 200 `{cost_price, selling_price}`; unknown id 404.
- `GET /api/orders/history/doctor/1` and `/pharmacy/1` → 200 grouped history; invalid type 400.
- `GET /api/orders` → paginated `{orders,total,limit,offset}`; `GET /:id/details` and
  `/:id/items` return the order + items for a valid order; unknown id 404.

Orders — lifecycle:
- Dispatch a pending order: stock decreases by exactly qty using FEFO (`expiry_date ASC`);
  order becomes `Dispatched`; debt is **unchanged** (Golden Rule 8); a second dispatch is 400.
- Strict batch dispatch (`inventory_id` set) deducts only that batch; insufficient batch → 400
  and no partial stock change.
- Cancel a pending order: debt returns to its pre-order value; `client_transactions` gets a
  negative `CANCEL` row; status `Cancelled`; cancel of a dispatched order is 400.
- Return a dispatched order: `returned_qty` increases, stock is restored, debt decreases by
  `return_qty * unit_price`, a `RETURN` ledger row is written, and over-return beyond
  `qty - returned_qty` is 400 with no partial changes. Returning all items sets `Returned`.
- Insufficient stock dispatch → 400 and **no** stock/status change (transaction rollback).

Orders — scope (Golden Rule 1):
- Branch-1 user `GET /api/orders` sees only branch-1 orders (create one in each branch first).
- Branch-1 user `GET /api/orders/:branch2Id/details` and `/:id/items` → 404, not branch-2 data.
- Branch-1 user dispatch/cancel/return of a branch-2 order → 404/403 and the branch-2 order is
  unchanged.
- `GET /api/orders/history/...` for a branch-2 client as branch-1 user returns no branch-2 rows.

Collections:
- `coll1` (has `can_manage_collections`) can `POST /api/collections` for `doc-2` with amount
  1000: doctor debt decreases by 1000, `payments` row + negative `PAYMENT` ledger row are
  written in branch 1, response `new_balance` matches. `emp1` → 403.
- Branch isolation: branch-1 collector paying `doc-4`/`pharm-4` (branch 2) → 404, no payment
  or ledger row. `?branch_id=2` is ignored for a non-admin.
- `GET /api/collections`, `/transactions`, `/debts`, `/summary` are branch-scoped and their
  numbers match raw SQL; `/debts` lists only `total_debt > 0`; `/summary` totals match
  `payments` and doctor+pharmacy debt.
- `GET /api/collections/client/doc-2/monthly` returns the current-month sum; `pharm-2` works;
  invalid prefix/unknown client → 400/404.
- Invalid payment amounts (0, negative, non-numeric, missing client) → 400, no rows written.

Withdrawals:
- `POST /api/withdrawals` for `salary1` (base 10000) amount 4000 → 201,
  `is_high_ratio:false`, `new_monthly_total:4000`; a second 1500 → `is_high_ratio:true`
  (5500 > 5000) and `new_monthly_total:5500`; `GET /api/withdrawals` shows running totals and
  the flag; `GET /api/withdrawals/stats` monthly total/top employee/alerts match raw SQL.
- Branch isolation: branch-1 user cannot create a withdrawal for branch-2 staff (`bm2`), and
  cannot see branch-2 withdrawals. `?branch_id=2` is ignored for non-admins.
- Invalid input: missing fields → 400; **negative amount → 400**; non-numeric → 400.

## Suspected defects to verify (reproduce before tagging)

1. `GET /api/orders/clients` queries a nonexistent `clients` table → 500.
2. `GET /api/orders/:id/details` joins `staff s ON o.created_by = s.id`; `orders.created_by`
   does not exist → 500 for every valid order.
3. `GET /api/orders`, `/:id/details`, `/:id/items`, dispatch, cancel and return are **not
   branch-scoped** — branch-1 users can read and mutate branch-2 orders (Golden Rule 1).
4. `createOrder` has early `return`s inside an open transaction (missing fields, unknown
   client) without rollback; the connection is released still `idle in transaction`.
5. `createOrder` trusts client-supplied `unit_price`/`base_price`, so the credit limit and
   totals can be manipulated (e.g. `unit_price: 0`). Record as a security/business question if
   the spec's "frozen price snapshots" implies server-side validation.
6. Collections treat any prefix other than `doc` as a pharmacy (`isDoctor = type === 'doc'`),
   so `xyz-1` silently targets pharmacy 1 instead of returning 400.
7. Collections allow overpayment: paying more than `total_debt` drives debt negative. The
   README only says "decrements"; record the correct behavior under `questions` unless you can
   tie it to a stated rule.
8. Withdrawals do not scope the staff lookup: a branch-1 user can create a withdrawal for a
   branch-2 staff member, recorded under branch 1.
9. Withdrawals accept negative amounts (only `!amount` is checked) — a negative withdrawal
   reduces the monthly total.
10. `getClientHistory` computes "outstanding balance" as the sum of all non-cancelled orders,
    not the client's actual `total_debt`; verify against the documented response intent.

Number these `C-BUG-n`, add `test.failing` with `@known-bug C-BUG-n`, and record expected vs
actual in `qa/status/C.json`. Do not assert a 500 as correct. For FEFO, test only the documented
`expiry_date ASC` order (expired-first is what the spec says; note the business risk under
`questions`, do not fail it).

## Done criteria

Route table complete in `qa/status/C.json`, suite green with `test.failing` for confirmed bugs,
committed on `qa/C`, final line `QA_WORKER_DONE:C`.
