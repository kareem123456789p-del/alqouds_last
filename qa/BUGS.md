# Bug Ledger — Al-Quds Medical ERP QA

> **Status Legend**:
> - **confirmed**: Reproduced against test database via dedicated `@known-bug` integration test (tagged with `test.failing`).
> - **fixed**: Verified fix committed with passing regression test.
> - **suspected**: Identified in initial review, awaiting dedicated regression assertion.

---

## 1. Master Bug Ledger

| Canonical ID | Worker ID | Severity | Area | Affected Route(s) | Summary | Status |
|---|---|---|---|---|---|---|
| **BUG-001** | — | **high** | install | `schema.test.js` | README migrations incomplete; missing `branch_id` on multiple transactional tables. | **fixed** `c859a39` |
| **BUG-002** | `A-BUG-1` | **critical** | staff/RBAC | `POST,PUT,DELETE /api/staff` | Staff write routes lack Admin permission checks; regular employees can modify staff. | **confirmed** |
| **BUG-003** | `C-BUG-2` | **high** | orders | `GET /api/orders/:id/details` | Query joins `orders.created_by = s.id`, but column does not exist → 500 error. | **confirmed** |
| **BUG-004** | `C-BUG-3` | **critical** | orders/scope | `GET,PUT /api/orders/*` | Orders listing, details, dispatch, and cancel lack branch scoping (Golden Rule 1). | **confirmed** |
| **BUG-005** | `C-BUG-4` | **high** | orders/tx | `POST /api/orders` | Early return on validation inside open transaction leaks connection `idle in transaction`. | **confirmed** |
| **BUG-006** | `C-BUG-1` | **high** | orders | `GET /api/orders/clients` | Query selects from nonexistent `clients` table → 500 error. | **confirmed** |
| **BUG-007** | `D-BUG-1` | **critical** | POS returns | `POST /api/retail/returns` | Destructures `original_sale_id` but never queries it; arbitrary refunds and stock minted. | **confirmed** |
| **BUG-008** | `D-BUG-7` | **high** | imports | `POST /api/imports/:id/return` | Final return executes `UPDATE ... status = "Returned"` (double quotes in PG) → 500 syntax error. | **confirmed** |
| **BUG-009** | `B-BUG-1` | **critical** | transfers | `POST /api/transfers` | Accepts negative item quantities, artificially increasing source warehouse stock. | **confirmed** |
| **BUG-010** | `B-BUG-7` | **high** | products | `PUT /api/products/:id` | Partial update wipes price to 0; nonexistent product ID returns 200 success. | **confirmed** |
| **BUG-011** | `B-BUG-11` | **high** | inventory | `PUT /api/inventory/:id` | Writes `current_stock` without validation; allows negative physical stock. | **confirmed** |
| **BUG-012** | `E-BUG-1` | **critical** | analytics/scope | `GET /api/analytics/*` | Non-admin analysts can supply `?branch_id=2` to access foreign branch financial data. | **confirmed** |
| **BUG-013** | `E-BUG-5` | **high** | Arabic PDF | `public/js/arabic_pdf_helpers.js` | `fixArabic()` passes incorrect arguments to `bidi-js`, catches TypeError, returns unshaped text. | **confirmed** |
| **BUG-014** | `E-BUG-4` | **medium** | pages/RBAC | `GET /dashboard.html` | Dashboard HTML page is served to non-admin employees without `requireAdmin`. | **confirmed** |
| **BUG-015** | `E-BUG-3` | **medium** | routing | `GET /` | `express.static` registered before `app.get('/')` serves `index.html`, bypassing dashboard redirect. | **confirmed** |
| **BUG-016** | `C-BUG-8` | **high** | withdrawals | `POST /api/withdrawals` | Accepts negative withdrawal amounts; staff lookup is not branch-scoped. | **confirmed** |
| **BUG-017** | `D-BUG-4` | **high** | POS/retail | `POST /api/retail/sales` | Sales attach to any active shift globally without branch scoping. | **confirmed** |
| **BUG-018** | `D-BUG-10` | **high** | POS/retail | `/api/retail/admin/*` | Cost-fixing and zero-cost list endpoints lack Admin Only authorization gates. | **confirmed** |
| **BUG-019** | `D-BUG-9` | **medium** | imports/scope | `POST /api/imports/:id/return` | Loads import log without branch validation and deducts stock from foreign branch. | **confirmed** |
| **BUG-020** | `C-BUG-6` | **medium** | collections | `POST /api/collections` | Any non-`doc` prefix (e.g. `xyz-1`) defaults to pharmacy 1 instead of returning 400. | **confirmed** |
| **BUG-021** | `D-BUG-12` | **medium** | suppliers | `DELETE /api/suppliers/:id` | Hard SQL delete crashes with 500 foreign key constraint when transactions exist. | **confirmed** |
| **BUG-022** | `B-BUG-6` | **medium** | transfers | `PATCH /api/transfers/:id/status` | Cancelled transfers can be cancelled repeatedly without error handling. | **confirmed** |
| **BUG-023** | `A-BUG-2` | **high** | staff/scope | `GET /api/staff` | Regular employee can list all staff members across foreign branches (Golden Rule 1). | **confirmed** |
| **BUG-024** | `E-BUG-6` | **medium** | dashboard | `GET /api/dashboard/stats` | `registered_clients` counts doctors only, completely omitting pharmacies. | **confirmed** |
| **BUG-025** | `B-BUG-14` | **high** | transfers | `PATCH /api/transfers/:id/status` | Receiving transfer for new batch omits `warehouse_id`, violating NOT NULL constraint (23502). | **confirmed** |
| **BUG-026** | `E-BUG-7` | **high** | analytics | `GET,POST /api/analytics/suppliers/*` | Queries relation `supplier_payments` which does not exist in schema → 500 error. | **confirmed** |
| **BUG-027** | `F-BUG-1` | **critical** | transfers/race | `PATCH /api/transfers/:id/status` | Double-ship race condition: concurrent `IN_TRANSIT` transitions double-deduct inventory. | **confirmed** |
| **BUG-028** | `D-BUG-13` | **medium** | suppliers | `GET /api/suppliers/:id/history` | Inner joins `import_logs`, omitting balance rows where `import_log_id` is null. | **confirmed** |

---

## 2. Detailed Defect Reports & Reproduction Steps

### BUG-002 (`A-BUG-1`): Staff write routes have no Admin Only permission gate
- **Severity**: Critical
- **Affected Endpoints**: `POST /api/staff`, `PUT /api/staff/:id`, `DELETE /api/staff/:id`
- **Reproduction**:
  1. Log in as regular employee `emp1`.
  2. Send `POST /api/staff` with `{ name: "Hacked", role: "EMPLOYEE", branch_id: 1 }`.
  3. Response is 201/200, creating a staff record without admin rights.
- **Expected**: HTTP 403 Forbidden for non-admin users.

### BUG-003 (`C-BUG-2`): Missing column `orders.created_by` crashes order details
- **Severity**: High
- **Affected Endpoints**: `GET /api/orders/:id/details`
- **Reproduction**:
  1. Create a valid wholesale order.
  2. Call `GET /api/orders/:id/details`.
  3. Server throws `error: column o.created_by does not exist` and responds with HTTP 500.
- **Expected**: Successful 200 JSON order response or graceful fallback to creator name.

### BUG-004 (`C-BUG-3`): Orders lack branch scoping (Golden Rule 1 violation)
- **Severity**: Critical
- **Affected Endpoints**: `GET /api/orders`, `PUT /api/orders/:id/dispatch`, `PUT /api/orders/:id/cancel`
- **Reproduction**:
  1. Create order under branch 2.
  2. Log in as employee of branch 1 (`emp1`).
  3. Query `GET /api/orders` — branch 2 order is returned.
  4. Send `PUT /api/orders/:id/dispatch` from branch 1 — order is dispatched and branch 2 inventory deducted.
- **Expected**: HTTP 403 or 404; branch 1 users cannot view or mutate branch 2 orders.

### BUG-005 (`C-BUG-4`): Open transaction leak on early validation return
- **Severity**: High
- **Affected Endpoints**: `POST /api/orders`
- **Reproduction**:
  1. Send `POST /api/orders` with missing `warehouse_id`.
  2. Handler calls `connection.beginTransaction()`, triggers early return `res.status(400)`.
  3. Connection is never rolled back or released, remaining `idle in transaction` in PostgreSQL.
- **Expected**: Every validation failure must execute `rollback()` and `release()`.

### BUG-007 (`D-BUG-1`): Arbitrary refund and stock minting via POS returns
- **Severity**: Critical
- **Affected Endpoints**: `POST /api/retail/returns`
- **Reproduction**:
  1. Call `POST /api/retail/returns` with `{ original_sale_id: 999999, items: [{ product_id: 1, qty: 50, refund_amount: 1000 }] }`.
  2. Controller never checks whether sale `999999` exists or what was purchased.
  3. Refund is granted and 50 units of product 1 are added into inventory.
- **Expected**: Validation of original sale invoice, items purchased, and maximum refundable quantities.

### BUG-013 (`E-BUG-5`): Arabic PDF text reshaper crashes on invalid bidi engine invocation
- **Severity**: High
- **Affected Components**: `public/js/arabic_pdf_helpers.js`, `scripts/build_arabic_pdf.js`
- **Reproduction**:
  1. Call `fixArabic("مركز القدس الطبي")`.
  2. Helper invokes `bidiEngine.getReorderedString(reshaped, 'rtl')`.
  3. `bidi-js` throws `TypeError: Cannot read properties of undefined (reading 'forEach')`.
  4. Error is caught and raw unshaped Arabic text is returned, printing disconnected/reversed glyphs in PDFs.
- **Expected**: Correct `bidi-js` invocation with embedding levels, returning proper reshaped Arabic glyphs.

### BUG-025 (`B-BUG-14`): Stock transfer receive path violates NOT NULL constraint
- **Severity**: High
- **Affected Endpoints**: `PATCH /api/transfers/:id/status` (`status: 'COMPLETED'`)
- **Reproduction**:
  1. Initiate transfer of product batch from branch 1 to branch 2 where branch 2 does not yet have the batch.
  2. Transition transfer to `IN_TRANSIT`.
  3. Transition transfer to `COMPLETED`.
  4. Controller attempts to `INSERT INTO warehouse_inventory` omitting `warehouse_id`.
  5. PostgreSQL throws `error: null value in column "warehouse_id" violates not-null constraint (23502)`.
- **Expected**: Destination warehouse ID provided during batch insertion.

### BUG-027 (`F-BUG-1`): Concurrent double-ship race condition
- **Severity**: Critical
- **Affected Endpoints**: `PATCH /api/transfers/:id/status`
- **Reproduction**:
  1. Create a stock transfer with 5 units.
  2. Send two concurrent `PATCH` requests setting status to `IN_TRANSIT`.
  3. Both queries read `status === 'PENDING'` simultaneously because no `FOR UPDATE` lock is acquired.
  4. Both deduct 5 units from inventory, causing 10 units to be deducted instead of 5.
- **Expected**: Row-level locking (`SELECT ... FOR UPDATE`) preventing concurrent state transitions.

---

## 3. Severity Breakdown
- **Critical (5)**: BUG-002, BUG-004, BUG-007, BUG-009, BUG-012, BUG-027
- **High (12)**: BUG-001 (fixed), BUG-003, BUG-005, BUG-006, BUG-008, BUG-010, BUG-011, BUG-013, BUG-016, BUG-017, BUG-018, BUG-023, BUG-025, BUG-026
- **Medium (7)**: BUG-014, BUG-015, BUG-019, BUG-020, BUG-021, BUG-022, BUG-024, BUG-028
