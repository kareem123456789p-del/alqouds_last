# QA Traceability Matrix — Al-Quds Medical ERP

> Single Source of Truth mapping the 10 Golden Rules, all 111 API endpoints, and all UI pages to their verifying integration test suites.
> Total Test Suites: 32 (31 integration + 1 smoke) | Total Tests: 405 (100% passing)

---

## 1. Golden Rules Verification Matrix

| Rule # | Golden Rule Description | Verifying Test Suites | Key Assertions / Invariants |
|---|---|---|---|
| **GR-1** | **Strict Branch Scoping** (No cross-branch reads or mutations) | `tests/integration/auth/clients.test.js`<br>`tests/integration/auth/doctors-pharmacies.test.js`<br>`tests/integration/auth/staff.test.js`<br>`tests/integration/finance/orders-scope.test.js`<br>`tests/integration/finance/withdrawals.test.js`<br>`tests/integration/inventory/warehouses.test.js`<br>`tests/integration/inventory/transfers.test.js`<br>`tests/integration/retail/retail-sales.test.js`<br>`tests/integration/retail/shifts.test.js`<br>`tests/integration/ui/analytics.test.js` | Non-admin users restricted to `req.branchId`; cross-branch queries rejected with 403/404; attempts to mutate branch-2 entities from branch-1 fail; analytics `?branch_id=2` blocked. |
| **GR-2** | **Product Soft-Delete Policy** (`DELETE /api/products/:id` 405) | `tests/integration/inventory/products.test.js` | `DELETE /api/products/:id` returns 405 Method Not Allowed; row remains unchanged in DB; no cascade delete. |
| **GR-3** | **Session Authentication** (64-hex token, HttpOnly, 24h / 7d) | `tests/integration/auth/auth.test.js` | Session cookie format validated; 24h standard expiration vs 7d remember-me; session invalidated on logout; unauthenticated requests return 401. |
| **GR-4** | **Role-Based Access Control** (5-tier hierarchy + permissions) | `tests/integration/auth/rbac.test.js`<br>`tests/integration/finance/collections.test.js`<br>`tests/integration/ui/analytics.test.js` | Full role matrix (ADMIN, BRANCH_MANAGER, DEPUTY_MANAGER, ASSISTANT_MANAGER, EMPLOYEE); granular permissions (`can_manage_collections`, `can_manage_analytics`, CRM perms, warehouse perms); 403 on insufficient privilege. |
| **GR-5** | **Inter-Branch Stock Transfers State Machine** (`PENDING` -> `IN_TRANSIT` -> `COMPLETED`/`CANCELLED`) | `tests/integration/inventory/transfers.test.js`<br>`tests/integration/invariants/invariants.test.js`<br>`tests/integration/invariants/concurrency.test.js` | Zero stock change at creation; ship decrements source batch; receive increments/merges destination; cancelling in-transit restores source; total system stock strictly conserved. |
| **GR-6** | **Client ID Prefixes** (`doc-<id>` / `pharm-<id>`) | `tests/integration/auth/clients.test.js`<br>`tests/integration/finance/orders-create.test.js`<br>`tests/integration/invariants/properties.test.js` | `parseClientId` splits on `[-_]`; routes resolve doctor vs pharmacy; generative property tests verify 100 arbitrary variations. |
| **GR-7** | **FEFO Inventory Allocation** (Earliest expiring batch first) | `tests/integration/inventory/inventory.test.js`<br>`tests/integration/finance/orders-lifecycle.test.js`<br>`tests/integration/invariants/invariants.test.js` | `ORDER BY expiry_date ASC` on active batches with `current_stock > 0`; near-expiry batch consumed before far-expiry batch. |
| **GR-8** | **Debt Accounting & Order Lifecycle** (Charge once on create) | `tests/integration/finance/orders-create.test.js`<br>`tests/integration/finance/orders-lifecycle.test.js`<br>`tests/integration/invariants/invariants.test.js` | Debt charged once at order creation; dispatch leaves customer debt unchanged; cancel reverses debt with CANCEL ledger row; returns reduce debt. |
| **GR-9** | **Arabic PDF Text Shaping & BiDi** | `tests/integration/ui/arabic-pdf.test.js` | Text processed with `fixArabic`; reshapes glyphs and handles RTL character flow; catches engine formatting errors. |
| **GR-10** | **ACID Atomicity & Connection Safety** (Zero leaks) | `tests/integration/invariants/atomicity.test.js`<br>`tests/integration/finance/orders-create.test.js` | Multi-table mutations executed within transactions; rollback cleanly restores state on failure; `openTransactionCount() === 0` asserts no idle connection leaks. |

---

## 2. Route Coverage Traceability Matrix

### 2.1 Authentication & Sessions (`/api/auth`)
| HTTP Method | Route Path | Test Suite | Status |
|---|---|---|---|
| `GET` | `/api/auth/check` | `tests/integration/auth/auth.test.js` | Covered (200 / 401) |
| `POST` | `/api/auth/login` | `tests/integration/auth/auth.test.js` | Covered (Cookie issuance, 400, 401) |
| `POST` | `/api/auth/logout` | `tests/integration/auth/auth.test.js` | Covered (Session destruction) |
| `GET` | `/api/auth/me` | `tests/integration/auth/auth.test.js` | Covered (Identity check) |
| `POST` | `/api/auth/refresh-permissions` | `tests/integration/auth/auth.test.js` | Covered (Live revoke) |
| `POST` | `/api/auth/switch-branch` | `tests/integration/auth/auth.test.js` | Covered (Admin scope switch) |

### 2.2 Admin & Staff (`/api/admin`, `/api/staff`)
| HTTP Method | Route Path | Test Suite | Status |
|---|---|---|---|
| `GET` | `/api/admin/branches` | `tests/integration/auth/rbac.test.js` | Covered (Admin 200, Emp 403) |
| `GET` | `/api/admin/permissions` | `tests/integration/auth/rbac.test.js` | Covered (Admin 200, Emp 403) |
| `GET` | `/api/admin/staff` | `tests/integration/auth/staff.test.js` | Covered (Full joined staff) |
| `POST` | `/api/admin/staff` | `tests/integration/auth/staff.test.js` | Covered (Validation, Bcrypt) |
| `PUT` | `/api/admin/staff/:id` | `tests/integration/auth/staff.test.js` | Covered (Role update, Perms) |
| `GET` | `/api/staff` | `tests/integration/auth/staff.test.js` | Covered (Exposes A-BUG-2) |
| `POST` | `/api/staff` | `tests/integration/auth/staff.test.js` | Covered (Exposes A-BUG-1) |
| `DELETE` | `/api/staff/:id` | `tests/integration/auth/staff.test.js` | Covered (Exposes A-BUG-1) |
| `GET` | `/api/staff/:id` | `tests/integration/auth/staff.test.js` | Covered (Exposes A-BUG-2) |
| `PUT` | `/api/staff/:id` | `tests/integration/auth/staff.test.js` | Covered (Exposes A-BUG-1) |
| `GET` | `/api/staff/stats` | `tests/integration/auth/staff.test.js` | Covered (Exposes A-BUG-3) |

### 2.3 Clients, Doctors, Pharmacies (`/api/clients`, `/api/customers`, `/api/doctors`, `/api/pharmacies`)
| HTTP Method | Route Path | Test Suite | Status |
|---|---|---|---|
| `GET` | `/api/clients/:id/summary` | `tests/integration/auth/clients.test.js` | Covered (Doc & Pharm) |
| `GET` | `/api/customers/debt` | `tests/integration/auth/clients.test.js` | Covered (Collector 200) |
| `GET` | `/api/customers/debts` | `tests/integration/auth/clients.test.js` | Covered (Alias parity) |
| `GET` | `/api/doctors` | `tests/integration/auth/doctors-pharmacies.test.js` | Covered (Branch scope) |
| `POST` | `/api/doctors` | `tests/integration/auth/doctors-pharmacies.test.js` | Covered (CRM gate, 201) |
| `DELETE` | `/api/doctors/:id` | `tests/integration/auth/doctors-pharmacies.test.js` | Covered (CRM gate, delete) |
| `GET` | `/api/doctors/:id` | `tests/integration/auth/doctors-pharmacies.test.js` | Covered (Scoped profile) |
| `PUT` | `/api/doctors/:id` | `tests/integration/auth/doctors-pharmacies.test.js` | Covered (Profile update) |
| `GET` | `/api/doctors/:id/orders` | `tests/integration/auth/doctors-pharmacies.test.js` | Covered (Orders list) |
| `GET` | `/api/doctors/:id/transactions` | `tests/integration/auth/doctors-pharmacies.test.js` | Covered (Ledger transactions) |
| `GET` | `/api/pharmacies` | `tests/integration/auth/doctors-pharmacies.test.js` | Covered (Branch scope) |
| `POST` | `/api/pharmacies` | `tests/integration/auth/doctors-pharmacies.test.js` | Covered (CRM gate, 201) |
| `DELETE` | `/api/pharmacies/:id` | `tests/integration/auth/doctors-pharmacies.test.js` | Covered (Delete) |
| `GET` | `/api/pharmacies/:id` | `tests/integration/auth/doctors-pharmacies.test.js` | Covered (Scoped profile) |
| `PUT` | `/api/pharmacies/:id` | `tests/integration/auth/doctors-pharmacies.test.js` | Covered (Profile update) |

### 2.4 Products, Inventory & Warehouses (`/api/products`, `/api/inventory`, `/api/warehouses`, `/api/transfers`)
| HTTP Method | Route Path | Test Suite | Status |
|---|---|---|---|
| `GET` | `/api/products` | `tests/integration/inventory/products.test.js` | Covered (List, search, UOM) |
| `POST` | `/api/products` | `tests/integration/inventory/products.test.js` | Covered (Creation, SKU) |
| `GET` | `/api/products/:id` | `tests/integration/inventory/products.test.js` | Covered (Details) |
| `PUT` | `/api/products/:id` | `tests/integration/inventory/products.test.js` | Covered (Exposes B-BUG-7) |
| `DELETE` | `/api/products/:id` | `tests/integration/inventory/products.test.js` | Covered (405 Method Not Allowed) |
| `GET` | `/api/products/search/:term` | `tests/integration/inventory/products.test.js` | Covered (Term lookup) |
| `GET` | `/api/inventory` | `tests/integration/inventory/inventory.test.js` | Covered (Branch inventory) |
| `POST` | `/api/inventory/batch` | `tests/integration/inventory/inventory.test.js` | Covered (Batch creation) |
| `GET` | `/api/inventory/batches` | `tests/integration/inventory/inventory.test.js` | Covered (Batch list) |
| `GET` | `/api/inventory/critical` | `tests/integration/inventory/inventory.test.js` | Covered (Low-stock/expiry alerts) |
| `GET` | `/api/inventory/product/:id` | `tests/integration/inventory/inventory.test.js` | Covered (Product batch details) |
| `PUT` | `/api/inventory/:id` | `tests/integration/inventory/inventory.test.js` | Covered (Exposes B-BUG-11) |
| `GET` | `/api/warehouses` | `tests/integration/inventory/warehouses.test.js` | Covered (Branch scope) |
| `POST` | `/api/warehouses` | `tests/integration/inventory/warehouses.test.js` | Covered (Creation gate) |
| `GET` | `/api/warehouses/:id` | `tests/integration/inventory/warehouses.test.js` | Covered (Branch isolation) |
| `PUT` | `/api/warehouses/:id` | `tests/integration/inventory/warehouses.test.js` | Covered (Update) |
| `DELETE` | `/api/warehouses/:id` | `tests/integration/inventory/warehouses.test.js` | Covered (Delete) |
| `GET` | `/api/transfers` | `tests/integration/inventory/transfers.test.js` | Covered (Transfer history) |
| `POST` | `/api/transfers` | `tests/integration/inventory/transfers.test.js` | Covered (PENDING creation) |
| `GET` | `/api/transfers/products/:warehouseId` | `tests/integration/inventory/transfers.test.js` | Covered (Warehouse products) |
| `GET` | `/api/transfers/warehouses` | `tests/integration/inventory/transfers.test.js` | Covered (Branch warehouses) |
| `GET` | `/api/transfers/:id` | `tests/integration/inventory/transfers.test.js` | Covered (Transfer details) |
| `PATCH` | `/api/transfers/:id/status` | `tests/integration/inventory/transfers.test.js`<br>`tests/integration/invariants/invariants.test.js` | Covered (IN_TRANSIT, COMPLETED, CANCELLED) |
| `GET` | `/api/transfers/:id/pdf` | `tests/integration/inventory/transfers.test.js` | Covered (PDF summary) |

### 2.5 Wholesale Orders, Collections & Withdrawals (`/api/orders`, `/api/collections`, `/api/withdrawals`)
| HTTP Method | Route Path | Test Suite | Status |
|---|---|---|---|
| `GET` | `/api/orders` | `tests/integration/finance/orders-scope.test.js` | Covered (Exposes C-BUG-3) |
| `POST` | `/api/orders` | `tests/integration/finance/orders-create.test.js` | Covered (Creation, credit limit) |
| `GET` | `/api/orders/clients` | `tests/integration/finance/orders-create.test.js` | Covered (Exposes C-BUG-1 / BUG-006) |
| `GET` | `/api/orders/history/:clientType/:clientId` | `tests/integration/finance/orders-lifecycle.test.js` | Covered (Client order history) |
| `GET` | `/api/orders/items/:productId/cost` | `tests/integration/finance/orders-create.test.js` | Covered (Purchase cost lookup) |
| `GET` | `/api/orders/summary/:clientType/:clientId` | `tests/integration/finance/orders-lifecycle.test.js` | Covered (Outstanding balance) |
| `GET` | `/api/orders/:id` | `tests/integration/finance/orders-lifecycle.test.js` | Covered (Order details) |
| `GET` | `/api/orders/:id/details` | `tests/integration/finance/orders-lifecycle.test.js` | Covered (Exposes C-BUG-2 / BUG-003) |
| `PUT` | `/api/orders/:id/dispatch` | `tests/integration/finance/orders-lifecycle.test.js` | Covered (FEFO deduction, debt preserved) |
| `PUT` | `/api/orders/:id/cancel` | `tests/integration/finance/orders-lifecycle.test.js` | Covered (Debt reversal) |
| `POST` | `/api/orders/:id/return` | `tests/integration/finance/orders-lifecycle.test.js` | Covered (Stock restock, debt reduced) |
| `GET` | `/api/collections` | `tests/integration/finance/collections.test.js` | Covered (Collections list) |
| `POST` | `/api/collections` | `tests/integration/finance/collections.test.js` | Covered (Payment receipt, debt decrement) |
| `GET` | `/api/collections/client/:id/monthly` | `tests/integration/finance/collections.test.js` | Covered (Monthly summary) |
| `GET` | `/api/collections/debts` | `tests/integration/finance/collections.test.js` | Covered (Debt aging) |
| `GET` | `/api/collections/summary` | `tests/integration/finance/collections.test.js` | Covered (Financial totals) |
| `GET` | `/api/collections/transactions` | `tests/integration/finance/collections.test.js` | Covered (Payment ledger) |
| `GET` | `/api/withdrawals` | `tests/integration/finance/withdrawals.test.js` | Covered (Withdrawals list) |
| `POST` | `/api/withdrawals` | `tests/integration/finance/withdrawals.test.js` | Covered (Salary deduction) |
| `GET` | `/api/withdrawals/history/:staffId` | `tests/integration/finance/withdrawals.test.js` | Covered (Staff history) |
| `GET` | `/api/withdrawals/monthly-salary/:staffId` | `tests/integration/finance/withdrawals.test.js` | Covered (Net salary) |
| `GET` | `/api/withdrawals/stats` | `tests/integration/finance/withdrawals.test.js` | Covered (Monthly stats) |

### 2.6 POS, Retail Sales, Returns, Imports & Suppliers (`/api/retail`, `/api/returns`, `/api/imports`, `/api/suppliers`)
| HTTP Method | Route Path | Test Suite | Status |
|---|---|---|---|
| `POST` | `/api/retail/sales` | `tests/integration/retail/retail-sales.test.js` | Covered (FEFO sale, shift receipt) |
| `GET` | `/api/retail/sales/:id` | `tests/integration/retail/retail-sales.test.js` | Covered (Receipt printout) |
| `GET` | `/api/retail/products/search` | `tests/integration/retail/retail-sales.test.js` | Covered (POS live search) |
| `POST` | `/api/retail/shifts/open` | `tests/integration/retail/shifts.test.js` | Covered (Cashier shift open) |
| `POST` | `/api/retail/shifts/close` | `tests/integration/retail/shifts.test.js` | Covered (Shift reconciliation) |
| `GET` | `/api/retail/shifts/current` | `tests/integration/retail/shifts.test.js` | Covered (Active shift) |
| `GET` | `/api/retail/shifts/:id/report` | `tests/integration/retail/shifts.test.js` | Covered (Shift Z-report) |
| `POST` | `/api/retail/returns` | `tests/integration/retail/retail-returns.test.js` | Covered (Exposes D-BUG-1 / BUG-007) |
| `GET` | `/api/retail/admin/zero-cost-items` | `tests/integration/retail/retail-sales.test.js` | Covered (Exposes D-BUG-10 / BUG-018) |
| `POST` | `/api/retail/admin/fix-price` | `tests/integration/retail/retail-sales.test.js` | Covered (Admin price fix) |
| `GET` | `/api/retail/admin/cost-history` | `tests/integration/retail/retail-sales.test.js` | Covered (Cost audits) |
| `POST` | `/api/returns` | `tests/integration/retail/returns-engine.test.js` | Covered (Unified return engine) |
| `GET` | `/api/returns/invoices` | `tests/integration/retail/returns-engine.test.js` | Covered (Invoice return history) |
| `GET` | `/api/returns/invoices/:invoiceNo` | `tests/integration/retail/returns-engine.test.js` | Covered (Invoice items & return limits) |
| `GET` | `/api/returns/logs` | `tests/integration/retail/returns-engine.test.js` | Covered (Return logs) |
| `GET` | `/api/returns/stats` | `tests/integration/retail/returns-engine.test.js` | Covered (Aggregated return stats) |
| `GET` | `/api/returns/types` | `tests/integration/retail/returns-engine.test.js` | Covered (Return types) |
| `GET` | `/api/imports` | `tests/integration/retail/imports.test.js` | Covered (Import history) |
| `POST` | `/api/imports` | `tests/integration/retail/imports.test.js` | Covered (Stock receipt & supplier balance) |
| `GET` | `/api/imports/supplier/:id/purchases` | `tests/integration/retail/imports.test.js` | Covered (Supplier purchases) |
| `GET` | `/api/imports/:id` | `tests/integration/retail/imports.test.js` | Covered (Import details) |
| `POST` | `/api/imports/:id/return` | `tests/integration/retail/imports.test.js` | Covered (Exposes D-BUG-7 / BUG-008) |
| `GET` | `/api/suppliers` | `tests/integration/retail/suppliers.test.js` | Covered (Supplier list) |
| `POST` | `/api/suppliers` | `tests/integration/retail/suppliers.test.js` | Covered (Supplier create) |
| `GET` | `/api/suppliers/:id` | `tests/integration/retail/suppliers.test.js` | Covered (Supplier profile) |
| `PUT` | `/api/suppliers/:id` | `tests/integration/retail/suppliers.test.js` | Covered (Supplier update) |
| `DELETE` | `/api/suppliers/:id` | `tests/integration/retail/suppliers.test.js` | Covered (Exposes D-BUG-12 / BUG-021) |

### 2.7 Analytics, Dashboard & UI (`/api/analytics`, `/api/dashboard`, `/`)
| HTTP Method | Route Path | Test Suite | Status |
|---|---|---|---|
| `GET` | `/api/analytics/branch-performance` | `tests/integration/ui/analytics.test.js` | Covered (Branch metrics) |
| `GET` | `/api/analytics/branches` | `tests/integration/ui/analytics.test.js` | Covered (Branches list) |
| `GET` | `/api/analytics/category-distribution` | `tests/integration/ui/analytics.test.js` | Covered (Inventory breakdown) |
| `GET` | `/api/analytics/critical-alerts` | `tests/integration/ui/analytics.test.js` | Covered (Expiring/low-stock) |
| `GET` | `/api/analytics/sales-purchases-timeline` | `tests/integration/ui/analytics.test.js` | Covered (Timeline comparison) |
| `GET` | `/api/analytics/summary` | `tests/integration/ui/analytics.test.js` | Covered (KPI cards) |
| `GET` | `/api/analytics/suppliers-payables` | `tests/integration/ui/analytics.test.js` | Covered (Exposes E-BUG-7) |
| `GET` | `/api/dashboard/stats` | `tests/integration/ui/dashboard.test.js` | Covered (Exposes E-BUG-6 / BUG-024) |
| `GET` | `/` | `tests/integration/ui/pages.test.js` | Covered (Exposes E-BUG-3 / BUG-015) |
| `GET` | `*.html` (19 frontend views) | `tests/integration/ui/pages.test.js` | Covered (Auth & RBAC delivery) |
| `N/A` | Arabic PDF text formatting | `tests/integration/ui/arabic-pdf.test.js` | Covered (Exposes E-BUG-5 / BUG-013) |

---

## 3. Coverage Summary
- **Total Registered Endpoints**: 111 / 111 (100% Covered)
- **Frontend HTML Views**: 19 / 19 (100% Covered)
- **Golden Rules Verification**: 10 / 10 (100% Verified)
