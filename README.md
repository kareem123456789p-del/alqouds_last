# 🏥 Al-Quds Medical Inventory & ERP System (مركز القدس الطبي)
### *Comprehensive Engineering Architecture, Multi-Branch ERP Engine & AI Agent Operating Manual*

---

> [!IMPORTANT]
> **MANDATORY NOTICE FOR AI AGENTS & SOFTWARE ENGINEERS:**
> This repository is a high-availability, dual-branch Medical Supply & ERP Management System deployed in Aswan, Egypt. It implements strict data isolation, dual-entry accounting, FEFO batch inventory tracking, and custom Arabic PDF generation.
> 
> **NEVER bypass branch isolation boundaries, NEVER delete products directly from the `products` table, and ALWAYS maintain PostgreSQL / `db.js` wrapper compatibility.** Read the [Golden Rules for AI Agents](#-golden-rules-for-ai-agents--developers) before executing any code modifications.

---

## 📑 Table of Contents

1. [Executive Overview & Business Mission](#-executive-overview--business-mission)
2. [Physical Branch Architecture](#-physical-branch-architecture)
3. [Technology Stack & Runtime Environment](#-technology-stack--runtime-environment)
4. [Database Engine & MySQL2 Emulation Layer (`db.js`)](#-database-engine--mysql2-emulation-layer-dbjs)
5. [Authentication, Session Lifecycle & RBAC](#-authentication-session-lifecycle--rbac)
6. [Multi-Branch Scoping & Strict Data Isolation Engine](#-multi-branch-scoping--strict-data-isolation-engine)
7. [Comprehensive Database Schema & Entity Relationships](#-comprehensive-database-schema--entity-relationships)
8. [Core Business Domains & Operational Workflows](#-core-business-domains--operational-workflows)
   - [8.1 The "Master-Mirror" Catalog & Inventory Pattern](#81-the-master-mirror-catalog--inventory-pattern)
   - [8.2 Wholesale Orders, FEFO Dispatch & Customer Debt Ledger](#82-wholesale-orders-fefo-dispatch--customer-debt-ledger)
   - [8.3 Point of Sale (POS) & Shift Management](#83-point-of-sale-pos--shift-management)
   - [8.4 Inbound Supply Shipments & Batch Ingestion](#84-inbound-supply-shipments--batch-ingestion)
   - [8.5 Comprehensive Returns Processing (Orders & POS)](#85-comprehensive-returns-processing-orders--pos)
   - [8.6 Inter-Branch Stock Transfers & Audit Trails](#86-inter-branch-stock-transfers--audit-trails)
   - [8.7 Collections & Market Debt Settlement](#87-collections--market-debt-settlement)
   - [8.8 Staff Salary Advances & Indebtedness Alerts](#88-staff-salary-advances--indebtedness-alerts)
   - [8.9 Executive Business Intelligence & Analytics Engine](#89-executive-business-intelligence--analytics-engine)
9. [Exhaustive API Route Reference](#-exhaustive-api-route-reference)
10. [Frontend Architecture & UI Systems](#-frontend-architecture--ui-systems)
11. [Arabic PDF Generation Engine & Font Architecture](#-arabic-pdf-generation-engine--font-architecture)
12. [Repository File Map & Codebase Organization](#-repository-file-map--codebase-organization)
13. [Migrations, Seeders & Maintenance Scripts](#-migrations-seeders--maintenance-scripts)
14. [Local Setup, Configuration & Deployment](#-local-setup-configuration--deployment)
15. [Golden Rules for AI Agents & Developers](#-golden-rules-for-ai-agents--developers)

---

## 🏢 Executive Overview & Business Mission

**Al-Quds Medical Inventory System** (**مركز القدس للمستلزمات والأجهزة الطبية**) is a full-featured medical ERP and inventory management platform designed to control medical supplies, pharmaceutical distribution, wholesale client billing, local supplier logistics, point-of-sale retail transactions, and inter-branch inventory transfers.

### Core Business Pillars
* **Wholesale Distribution**: Managing doctors and pharmacies with custom credit limits, automated debt ledger updates, and FEFO-driven dispatching.
* **Point of Sale (POS)**: Retail counter sales governed by cashier cash shifts, receipt generation, and real-time inventory deductions.
* **Multi-Warehouse Batch Inventory**: Tracking expiration dates, batch numbers, minimum inventory thresholds, and weighted cost pricing.
* **Strict Multi-Branch Isolation**: Autonomous data scoping per branch with global management oversight for Super Admins.
* **Financial Integrity**: Real-time debt calculation, settlement records, supplier payables management, and staff salary advance tracking.
* **Bilingual Arabic/English Infrastructure**: Arabic RTL user interface with client-side bidirectional shaped PDF invoice/report rendering.

---

## 📍 Physical Branch Architecture

The enterprise operates two primary medical centers in Aswan Governorate, Egypt:

| Branch ID | Branch Code Name | Display Name (Arabic) | Physical Address | Phone Contact |
|---|---|---|---|---|
| **1** | `ALQUODS_1` | مركز القدس 1 للمستلزمات والاجهزة الطبية | اسوان - النفق - عمارة الدكتور عبد الحميد | 01114459296 - 01152950806 |
| **2** | `ALQUODS_2` | مركز القدس 2 للمستلزمات والأجهزة الطبية | اسوان - السيل - شارع المشرحة بجوار مستشفى اسوان الجامعي | 01155675246 - 01221884709 - 01220212028 - 01227831253 |

* Each branch maintains its own warehouses, stock levels, suppliers, retail shifts, doctors/pharmacies ledger, cash collections, and staff.
* Stock movement between Branch 1 and Branch 2 is strictly executed via formal **Stock Transfers** with a 2-phase shipment and receipt protocol.

---

## 🛠 Technology Stack & Runtime Environment

### Backend
* **Runtime**: Node.js (v18.0.0+)
* **Framework**: Express.js 4.18.2
* **Database Driver**: `pg` (v8.13.1) with connection pooling
* **Authentication**: Cookie-based sessions with HTTP-only tokens (`cookie-parser` 1.4.7)
* **Hashing**: `bcrypt` 6.0.0 (Salt rounds: 10)
* **File Processing**: `multer` 2.1.1 (disk storage engine with MIME validation)
* **Environment Management**: `dotenv` 16.3.1
* **Cross-Origin**: `cors` 2.8.5

### Frontend
* **Core**: Pure Vanilla ECMAScript (ES6+), semantic HTML5, modern CSS3 (Custom Properties & Flex/Grid)
* **Icons**: FontAwesome 6 (Pro/Free SVG & CSS)
* **Data Visualization**: Chart.js v4+ (UMD distribution in `public/js/chart.umd.min.js`)
* **PDF Rendering**: jsPDF + custom bundled `arabic-reshaper` and `bidi-js` for RTL Arabic text support
* **State Synchronization**: HTML5 `BroadcastChannel` (`inventory_sync`) for real-time inter-tab state updates

---

## 🗄 Database Engine & MySQL2 Emulation Layer (`db.js`)

The project historically transitioned from MySQL to **PostgreSQL**. To prevent rewriting dozens of controller queries, the core database module `db.js` acts as an **adapter layer** providing a `mysql2`-compatible promise API on top of PostgreSQL.

```
       Controller Code (mysql2 syntax: [rows] = await db.query('SELECT ... WHERE id = ?', [id]))
                                          │
                                          ▼
                         ┌───────────────────────────────────┐
                         │              db.js                │
                         │  • convertPlaceholders(? -> $n)   │
                         │  • appendReturning (INSERT)       │
                         │  • wrapResult ([rows, fields])    │
                         │  • insertId & affectedRows mock   │
                         └───────────────────────────────────┘
                                          │
                                          ▼
                             node-postgres (pg.Pool)
                                          │
                                          ▼
                               PostgreSQL Database
```

### Key Emulation Features in `db.js`:
1. **Placeholder Conversion (`convertPlaceholders`)**: Automatically converts MySQL `?` placeholders into PostgreSQL sequential parameterized placeholders `$1`, `$2`, `$3`, etc.
2. **Auto-Appending `RETURNING *` (`appendReturning`)**: For any statement matching `/^INSERT\s/i`, appends `RETURNING *` if not already present.
3. **Result Destructuring (`wrapResult`)**: Wraps the PostgreSQL `QueryArrayResult` into `[rows, fields]` array matching `mysql2/promise`. It also injects:
   - `rows.insertId`: Extracted from `rows[0].id` when available.
   - `rows.affectedRows`: Populated from PostgreSQL `result.rowCount`.
4. **Transaction Wrapper (`getConnection`)**:
   - `beginTransaction()`: Issues PostgreSQL `BEGIN`.
   - `commit()`: Issues PostgreSQL `COMMIT`.
   - `rollback()`: Issues PostgreSQL `ROLLBACK`.
   - `release()`: Releases PostgreSQL client back to pool.
5. **Config Alias**: `config/db.js` simply re-exports the root `../db` module so all import paths remain consistent across the codebase.

> [!WARNING]
> **DEVELOPER GOTCHA:** While `execute()` and `query()` accept `?` placeholders, native raw queries passing `$1, $2` directly also work, but DO NOT mix both styles within the same query string.

---

## 🔐 Authentication, Session Lifecycle & RBAC

Authentication in Al-Quds ERP avoids stateless JWT pitfalls by using **stateful server-managed memory sessions** backed by HTTP-Only browser cookies.

### 1. In-Memory Session Architecture (`controllers/authController.js`)
* Sessions are held in `sessions = new Map()`.
* Session tokens are cryptographically generated 64-character hex strings:
  ```javascript
  const token = crypto.randomBytes(32).toString('hex');
  ```
* Session lifetime: **24 hours** by default, or **7 days** when "Remember Me" is toggled.
* Cookie specs:
  - Key: `session_token`
  - `httpOnly: true` (prevents XSS theft)
  - `sameSite: 'lax'`
  - `secure: true` in production environments.

### 2. Live Session Verification (`GET /api/auth/check`)
To guarantee that administrative permission revocations take immediate effect without forcing user logouts:
* On every `/api/auth/check` call, user permissions are queried **live** from `staff_permissions`.
* User role and branch assignments are re-verified directly against the database table `staff`.

### 3. Role Hierarchy & Allowed Roles
| Role Name | Authority Level | Primary Capabilities | Default Redirect |
|---|---|---|---|
| `ADMIN` / `SUPER ADMIN` | Global Enterprise Admin | Unrestricted access across all branches, admin dashboard, user creation, RBAC | `/dashboard` |
| `BRANCH_MANAGER` | Branch Executive | Full operational control of assigned branch | `/index.html` |
| `DEPUTY_MANAGER` | Second-in-Command | Operational approval, shifts, transfers | `/index.html` |
| `ASSISTANT_MANAGER` | Operational Supervisor | Daily sales, inventory checks, supplier imports | `/index.html` |
| `WAREHOUSE_MANAGER` | Storage & Inventory Lead | Stock transfers, batch adjustments, audit downloads | `/index.html` |
| `EMPLOYEE` | Front-Desk / Staff | Basic order processing, client lookups | `/index.html` |

### 4. Granular Permissions Catalog (`permissions` table)
* **Warehouses & Stock**: `MANAGE_WAREHOUSES_ADD`, `MANAGE_WAREHOUSES_EDIT`, `MANAGE_WAREHOUSES_DELETE`, `DOWNLOAD_INVENTORY_AUDIT`, `PRINT_OFFICIAL_DECLARATION`, `VIEW_STOCK_QUANTITY_AND_PRICES`, `inventory_edit`, `stock_transfer_approve`.
* **Sales & POS**: `pos_access`.
* **Clients**: `CREATE_DOCTOR`, `EDIT_DOCTOR`, `DELETE_DOCTOR`, `CREATE_PHARMACY`, `EDIT_PHARMACY`, `DELETE_PHARMACY`.
* **Financials**: `can_manage_collections`, `expenses_manage`.
* **BI & Analytics**: `can_manage_analytics`, `reports_view`.
* **Administration**: `system_settings`.

---

## 🛡 Multi-Branch Scoping & Strict Data Isolation Engine

Data security is enforced by a **Zero-Trust Branch Scoping Middleware** (`middleware/branchScope.js`).

```
                Incoming HTTP Request (Authenticated via requireAuth)
                                          │
                                          ▼
                            ┌───────────────────────────┐
                            │      branchScope.js       │
                            └───────────────────────────┘
                                          │
                     Is User role ADMIN or SUPER ADMIN?
                                    /           \
                                  YES            NO
                                  /                \
       ┌────────────────────────────────────┐    ┌────────────────────────────────────────┐
       │ Respects:                          │    │ FORCED STRICT ASSIGNMENT:              │
       │ 1. req.query.branch_id             │    │ req.branchId = user.assigned_branch_id │
       │ 2. req.headers['x-branch-id']      │    │ (Client query/body branch_id ignored)  │
       │ 3. req.user.active_branch_id       │    └────────────────────────────────────────┘
       │ 4. Default: 1                      │
       └────────────────────────────────────┘
                                          │
                                          ▼
                        req.branchId bound to Request Object
                                          │
                                          ▼
                       Next Middleware / Controller Route Handler
```

### Non-Admin Security Guarantee
* Non-admin users can **never** query or mutate records belonging to another branch.
* If a non-admin requests `/api/inventory?branch_id=2`, `branchScope` completely discards `branch_id=2` and replaces `req.branchId` with the user's authentic `assigned_branch_id`.
* Any request where `req.branchId` cannot be determined fails immediately with `HTTP 400 Bad Request`.

---

## 📊 Comprehensive Database Schema & Entity Relationships

```mermaid
erDiagram
    branches ||--o{ warehouses : "owns"
    branches ||--o{ staff : "employs"
    branches ||--o{ local_suppliers : "contracts"
    branches ||--o{ doctors : "registers"
    branches ||--o{ pharmacies : "registers"
    branches ||--o{ orders : "executes"
    branches ||--o{ retail_shifts : "runs"
    branches ||--o{ payments : "collects"
    branches ||--o{ returns : "processes"
    branches ||--o{ stock_transfers : "source/dest"

    warehouses ||--o{ warehouse_inventory : "stores"
    products ||--o{ warehouse_inventory : "mirrored in"
    uom ||--o{ products : "base/bulk unit"

    local_suppliers ||--o{ import_logs : "supplies"
    import_logs ||--o{ supplier_transactions : "generates ledger"
    
    doctors ||--o{ orders : "places"
    pharmacies ||--o{ orders : "places"
    orders ||--o{ order_items : "contains"
    products ||--o{ order_items : "sold item"

    retail_shifts ||--o{ retail_sales : "logs"
    retail_sales ||--o{ retail_sale_items : "contains"
    products ||--o{ retail_sale_items : "sold item"

    doctors ||--o{ client_transactions : "audited in"
    pharmacies ||--o{ client_transactions : "audited in"

    staff ||--o{ staff_permissions : "granted"
    permissions ||--o{ staff_permissions : "defines"
    staff ||--o{ employee_withdrawals : "withdraws"
```

### Table Definitions & Column Specifications

#### 1. `branches`
* `id` (SERIAL, PK): Branch identifier (1 = Downtown, 2 = El-Seil).
* `name` (VARCHAR 255): Display name.
* `address` (TEXT): Physical branch address.
* `phone` (VARCHAR 50): Contact telephone numbers.
* `is_active` (BOOLEAN): Branch operational status.
* `created_at` (TIMESTAMP).

#### 2. `staff`
* `id` (SERIAL, PK): Employee identifier.
* `name` (VARCHAR 255): Staff full name.
* `registration_number` (VARCHAR 50, UNIQUE): Login username / badge number.
* `password_hash` (VARCHAR 255): Bcrypt hashed password.
* `role` (VARCHAR 100): Assigned business role.
* `branch_id` (INT, FK -> `branches.id`): Assigned branch.
* `phone` (VARCHAR 50), `email` (VARCHAR 255).
* `status` (VARCHAR 50): `'active'` or `'leave'`.
* `base_salary` (DECIMAL 10,2): Fixed monthly base salary (for withdrawal threshold checking).

#### 3. `permissions` & `staff_permissions`
* `permissions`: `id`, `key` (UNIQUE VARCHAR 100), `description` (TEXT), `category` (VARCHAR 100), `branch_id` (INT).
* `staff_permissions`: `staff_id` (FK -> `staff.id`), `permission_key` (FK -> `permissions.key`), Composite PK (`staff_id`, `permission_key`).

#### 4. `products` (Master Catalog)
* `id` (SERIAL, PK): Master product ID.
* `name` (VARCHAR 255): Item trade name.
* `sku` (VARCHAR 50): Internal item barcode/code.
* `category` (VARCHAR 100): Pharmacological/medical category.
* `manufacturer` (VARCHAR 100): Drug manufacturer.
* `quantity` (INT): Global aggregated stock (cached sum of all warehouses).
* `price` (DECIMAL 10,2): Default wholesale/retail selling price.
* `purchase_price` (DECIMAL 10,2): Last-in purchase/cost price.
* `base_uom_id` (INT, FK -> `uom.id`): Base unit (e.g., Tablet, Piece).
* `bulk_uom_id` (INT, FK -> `uom.id`): Bulk packaging unit (e.g., Box, Carton).
* `conversion_factor` (DECIMAL 10,4): Ratio of base units per bulk unit (default: 1.0000).
* `is_active` (SMALLINT, default 1): Soft-delete flag (0 = deactivated).
* `is_deleted` (SMALLINT, default 0): Deletion audit flag (1 = deleted).

#### 5. `warehouse_inventory` (Batch Mirror)
* `id` (SERIAL, PK): Inventory batch row ID.
* `warehouse_id` (INT, FK -> `warehouses.id`).
* `product_id` (INT, FK -> `products.id`).
* `batch_number` (VARCHAR 100): Supplier lot/batch number.
* `expiry_date` (DATE): Lot expiration date.
* `current_stock` (INT): Current physical units on shelf.
* `qty_threshold` (INT, default 20): Low-stock warning trigger.
* `expiry_month_threshold` (INT, default 3): Months-before-expiration warning trigger.
* `unit_price` (DECIMAL 10,2): Ingestion cost price for this specific batch.
* `branch_id` (INT, FK -> `branches.id`).

#### 6. `warehouses`
* `id` (SERIAL, PK): Warehouse ID.
* `name` (VARCHAR 100): Storage facility name.
* `location` (VARCHAR 255): Facility zone / physical address.
* `capacity` (INT, default 10000): Maximum item capacity.
* `branch_id` (INT, FK -> `branches.id`).

#### 7. `local_suppliers` & `supplier_transactions`
* `local_suppliers`: `id`, `supplier_code` (e.g. `LOC-0201`), `company_name`, `contact_person`, `phone`, `city_area`, `notes`, `branch_id`.
* `supplier_transactions`: `id`, `supplier_id`, `import_log_id`, `total_amount` (positive for charges, negative for credits), `transaction_type` (`'IMPORT_CHARGE'`, `'RETURN_CREDIT'`, `'PAYMENT'`), `branch_id`.

#### 8. `import_logs`
* `id` (SERIAL, PK): Inbound shipment record.
* `product_id`, `warehouse_id`, `supplier_id`.
* `quantity` (INT), `unit_price` (DECIMAL 10,2).
* `returned_qty` (INT, default 0), `return_reason` (VARCHAR 255).
* `status` (VARCHAR 50, default `'Active'`).
* `shipment_id` (VARCHAR 100): Unique batch identifier grouping all items in a delivery (`SHP-...`).
* `invoice_image` (VARCHAR 255): Relative URL path to archived supplier invoice photo.
* `branch_id` (INT, FK -> `branches.id`).

#### 9. `doctors` & `pharmacies`
* `doctors`: `id`, `name`, `specialty`, `phone`, `email`, `license_number`, `status` (`'active'`, `'away'`), `location`, `credit_limit` (default 60000.00), `total_debt` (default 0.00), `branch_id`.
* `pharmacies`: `id`, `name`, `license_number`, `contact_person`, `area`, `phone`, `email`, `status` (`'active'`, `'pending'`, `'suspended'`), `credit_limit` (default 20000.00), `total_debt` (default 0.00), `branch_id`.

#### 10. `orders` & `order_items`
* `orders`: `id`, `order_number` (e.g. `#ORD-2026-1045`), `client_id` (FK -> `doctors.id`), `pharmacy_id` (FK -> `pharmacies.id`), `warehouse_id`, `expected_delivery`, `total_amount`, `status` (`'Pending'`, `'Dispatched'`, `'Returned'`, `'Cancelled'`), `created_by` (staff ID), `branch_id`.
* `order_items`: `id`, `order_id`, `product_id`, `warehouse_id`, `inventory_id` (optional explicit batch ID), `qty`, `returned_qty`, `return_reason`, `base_price` (cost price snapshot), `unit_price` (selling price snapshot), `profit_margin`, `subtotal`, `branch_id`.

#### 11. `client_transactions` & `payments`
* `client_transactions`: Unified ledger auditing all debits and credits for doctors/pharmacies: `id`, `client_id` (doctor), `pharmacy_id`, `type` (`'ORDER'`, `'PAYMENT'`, `'CANCEL'`, `'RETURN'`), `amount` (positive increases debt, negative decreases debt), `reference_id`, `branch_id`, `date`.
* `payments`: Cash collection records: `id`, `client_id`, `pharmacy_id`, `amount`, `payment_method` (`'Cash'`, `'Bank'`, etc.), `reference_no`, `notes`, `branch_id`, `created_at`.

#### 12. `retail_shifts`, `retail_sales`, `retail_sale_items`
* `retail_shifts`: Cash register shifts: `id`, `status` (`'OPEN'`, `'CLOSED'`), `closed_at`, `branch_id`, `created_at`.
* `retail_sales`: POS transactions: `id`, `shift_id`, `total_amount`, `profit_amount`, `branch_id`, `created_at`.
* `retail_sale_items`: `id`, `sale_id`, `product_id`, `qty`, `returned_qty`, `cost_price`, `selling_price`, `profit_amount`, `branch_id`.

#### 13. `stock_transfers`, `stock_transfer_items`, `stock_audit_logs`
* `stock_transfers`: `id`, `transfer_code` (e.g. `TR-2026-0012`), `source_branch_id`, `destination_branch_id`, `status` (`'PENDING'`, `'IN_TRANSIT'`, `'COMPLETED'`, `'CANCELLED'`), `notes`, `created_by_staff_id`, `processed_by_staff_id`.
* `stock_transfer_items`: `id`, `transfer_id`, `item_id` (product), `batch_id` (warehouse_inventory), `quantity`.
* `stock_audit_logs`: Detailed audit trail of all manual and automated stock variances: `id`, `branch_id`, `staff_id`, `action_type` (`'TRANSFER_OUT'`, `'TRANSFER_IN'`, `'MANUAL_ADJUST'`), `item_id`, `batch_id`, `quantity_changed`, `notes`.

#### 14. `returns` & `return_items`
* `returns`: Master return document: `id`, `return_number`, `order_id`, `retail_sale_id`, `branch_id`, `client_id`, `pharmacy_id`, `total_amount`, `total_profit`, `return_reason`, `created_by`, `created_at`.
* `return_items`: Individual returned line items: `id`, `return_id`, `order_item_id`, `retail_sale_item_id`, `product_id`, `batch_id`, `qty`, `unit_price`, `cost_price`, `total`, `profit_amount`, `branch_id`.

#### 15. `employee_withdrawals`
* `id`, `staff_id` (FK -> `staff.id`), `amount`, `reason`, `category` (`'Emergency'`, `'Salary Advance'`, `'Personal'`), `branch_id`, `created_at`.

---

## ⚙️ Core Business Domains & Operational Workflows

### 8.1 The "Master-Mirror" Catalog & Inventory Pattern

The system enforces a strict separation between **Product Definitions** (Master) and **Physical Stock Units** (Mirror).

```
   ┌────────────────────────────────────────────────────────┐
   │               Master Catalog (products)                │
   │  Shared product identity: Name, SKU, Category, UOMs,   │
   │  Conversion Factor, Global Price & Purchase Cost       │
   └────────────────────────────────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐
│     Branch 1 Inventory        │   │     Branch 2 Inventory        │
│   (warehouse_inventory)       │   │   (warehouse_inventory)       │
│  - Warehouse A, B, Cold-Chain │   │  - Warehouse Main, Retail Stk │
│  - Specific Batches & Expiry  │   │  - Specific Batches & Expiry  │
│  - Local Stock Levels         │   │  - Local Stock Levels         │
└───────────────────────────────┘   └───────────────────────────────┘
```

#### The Deletion Protocol (Master-Mirror Double Lock)
* **`DELETE /api/products/:id` is intentionally BLOCKED** with `HTTP 405 Method Not Allowed`.
* **Single Source of Truth**: All product deactivations must be submitted to `DELETE /api/inventory/:id` (`inventoryController.deleteInventoryRecord`):
  1. **Master Soft-Delete**: Sets `is_active = 0` and `is_deleted = 1` in `products`. Historical references (`order_items`, `import_logs`, `transfer_logs`) remain intact.
  2. **Mirror Forced Wipe**: Hard-deletes matching rows from `warehouse_inventory` for the active `branch_id`.
  3. **Double-Lock Join Defense**: Even if an inventory row survives, `WHERE p.is_active = 1 AND p.is_deleted = 0` in all warehouse joins guarantees it is completely invisible.
  4. **Cross-Tab Sync**: Frontend broadcasts an `inventory_sync` event over the browser `BroadcastChannel` to immediately refresh open tabs.

---

### 8.2 Wholesale Orders, FEFO Dispatch & Customer Debt Ledger

Wholesale orders follow a strict, auditable debt-accounting and stock-deduction lifecycle:

```
[Customer Select: doc-X / pharm-X]
               │
               ▼
   [Credit Limit Verification]
 (total_debt + orderTotal <= limit)
               │
               ▼
    [POST /api/orders (Create)]
   ┌─────────────────────────────────────────────────────────┐
   │ 1. Insert order with status 'Pending'                   │
   │ 2. Insert order_items with frozen price snapshots       │
   │ 3. IMMEDIATELY update client total_debt (+orderTotal)   │
   │ 4. Insert client_transactions record ('ORDER')          │
   └─────────────────────────────────────────────────────────┘
               │
               ▼
   [PUT /api/orders/:id/dispatch]
   ┌─────────────────────────────────────────────────────────┐
   │ 1. Validate status == 'Pending'                         │
   │ 2. Deduct physical stock:                               │
   │    • If inventory_id provided -> Strict batch deduction │
   │    • Else -> Auto FEFO (ORDER BY expiry_date ASC)       │
   │ 3. Set status = 'Dispatched'                            │
   │    (NOTE: Debt is NOT charged again — avoids double-dip)│
   └─────────────────────────────────────────────────────────┘
        /                     \
       ▼                       ▼
[PUT /api/orders/:id/cancel]   [POST /api/orders/:id/return]
 • Allowed ONLY if 'Pending'    • Allowed ONLY if 'Dispatched'
 • Full reversal of debt        • Restores returned inventory
 • client_transactions 'CANCEL' • Deducts debt by return amount
 • Status -> 'Cancelled'        • client_transactions 'RETURN'
```

#### Client Prefix Encoding Convention
To support heterogeneous client models cleanly:
* Doctors are identified with prefix `doc-` (e.g. `doc-12`).
* Pharmacies are identified with prefix `pharm-` (e.g. `pharm-5`).
* Controller functions (`resolveClient`, `updateClientDebt`) parse this prefix to update the correct target table (`doctors` vs `pharmacies`) and foreign key.

---

### 8.3 Point of Sale (POS) & Shift Management

The POS subsystem (`retail_sales.html` / `retailController.js`) handles counter sales:

1. **Shift Control**: Cashiers must open a shift (`POST /api/retail/shifts/open`) before recording sales. Only one shift per branch may be active at any time.
2. **Sale Recording (`POST /api/retail/sales`)**:
   - Operates inside an active database transaction.
   - Evaluates line items against selected warehouse inventory.
   - Executes **FEFO stock deduction** across available batches (`ORDER BY expiry_date ASC`).
   - Decrements global `products.quantity`.
   - Records `retail_sales` and `retail_sale_items`.
3. **Honest Accounting Shift Reporting**:
   - Computes Total Revenue, Cost of Goods Sold (COGS), and Net Profit.
   - **Zero-Hallucination Rule**: If a product has a missing or zero `purchase_price`, it does NOT assume 100% profit; the cost is flagged as `cost_missing = true` and contributes 0 profit until backfilled.
4. **Price Repair Tool**: Admins can query zero-cost items via `GET /api/retail/admin/zero-cost-products` and execute `POST /api/retail/admin/fix-price` to backfill `retail_sale_items.cost_price`.

---

### 8.4 Inbound Supply Shipments & Batch Ingestion

Shipment arrivals from local suppliers are captured via `importController.js`:

1. **Multipart Payload**: Accepts FormData containing an `items` JSON array and an optional scanned invoice picture (`invoiceImage`).
2. **Multer Ingestion**: Images are saved to `/uploads/invoices/` with unique filenames.
3. **Batch Generation**: A unique `shipment_id` (`SHP-<timestamp>-<hash>`) groups the consignment.
4. **Inventory Upsert**:
   - Updates `products.quantity`, `products.purchase_price` (Last-In cost), and `products.price`.
   - Finds existing matching batch (`batch_number` + `expiry_date` + `warehouse_id`) or creates a new `warehouse_inventory` batch row.
5. **Supplier Ledger Logging**: Inserts `import_logs` and writes an `'IMPORT_CHARGE'` entry into `supplier_transactions`.
6. **Supplier Returns (`POST /api/imports/:id/return`)**: Deducts inventory via FEFO, records `returned_qty` in `import_logs`, and logs a `'RETURN_CREDIT'` negative charge in `supplier_transactions`.

---

### 8.5 Comprehensive Returns Processing (Orders & POS)

The centralized Returns Engine (`returnsController.js`) provides an enterprise invoice tree and refund system:

* **Invoice Tree (`GET /api/returns/invoices-tree`)**: Hierarchical tree grouping completed wholesale and retail sales by `Month -> Day -> Invoices` for fast visual reconciliation.
* **Return Execution (`POST /api/returns/process`)**:
  - Handles wholesale orders and POS retail invoices uniformly.
  - Validates that returned quantities do not exceed `sold_qty - already_returned_qty`.
  - Re-injects stock into `warehouse_inventory` (locates originating batch or generates a return batch) and increments `products.quantity`.
  - Decrements customer debt on `doctors` / `pharmacies` and logs a `'RETURN'` transaction.
  - Inserts audit records into `returns` and `return_items`.

---

### 8.6 Inter-Branch Stock Transfers & Audit Trails

Moving inventory between Branch 1 and Branch 2 is governed by `transferController.js`:

```
   [Source Branch Staff]
             │
             ▼
[POST /api/transfers] ──> Status: 'PENDING'
             │            (Validates source stock; no deduction yet)
             ▼
[PATCH /api/transfers/:id/status ('IN_TRANSIT')]
             │
             ├─> 1. Verifies caller belongs to Source Branch
             ├─> 2. Deducts quantity from Source warehouse_inventory
             └─> 3. Records 'TRANSFER_OUT' in stock_audit_logs
             │
             ▼
[PATCH /api/transfers/:id/status ('COMPLETED')]
             │
             ├─> 1. Verifies caller belongs to Destination Branch
             ├─> 2. Matches/creates batch in Destination warehouse_inventory
             ├─> 3. Increments Destination physical stock
             └─> 4. Records 'TRANSFER_IN' in stock_audit_logs
```

* **Cancellation Safeguard**: If a transfer is marked `'CANCELLED'` while `'IN_TRANSIT'`, the stock is automatically restored back to the source batch.

---

### 8.7 Collections & Market Debt Settlement

Customer debt collection is managed via `collectionController.js`:

* **Permission Gate**: Requires `ADMIN` role or `can_manage_collections` permission.
* **Recording Payments (`POST /api/collections`)**:
  - Validates client existence within the user's active branch.
  - Decrements `total_debt` on `doctors` or `pharmacies`.
  - Writes an entry into `payments` (`amount`, `payment_method`, `reference_no`).
  - Writes a corresponding negative entry into `client_transactions` with type `'PAYMENT'`.
* **Debt Summaries**: `GET /api/collections/debts` aggregates all doctors and pharmacies with `total_debt > 0` for debt tracking and aging analysis.

---

### 8.8 Staff Salary Advances & Indebtedness Alerts

To protect the business and staff from over-indebtedness, `withdrawalController.js` tracks payroll advances:

* Staff members have a configured `base_salary` in `staff`.
* When a withdrawal is recorded (`POST /api/withdrawals`), the controller computes the running sum of withdrawals for that staff member in the current calendar month.
* **50% Threshold Warning**: If total monthly withdrawals exceed **50% of the employee's base salary**, the API response flags `is_high_ratio: true`, prompting immediate administrative review.

---

### 8.9 Executive Business Intelligence & Analytics Engine

The Analytics Engine (`analyticsController.js`) serves executive KPI summaries and interactive visual charts:

* **Time Filters**: Supports `today`, `this_week`, `this_month`, `last_month`, `this_quarter`, `this_year`, `all_time`.
* **Multi-Branch Aggregation**: Admins can analyze `branch_id=all` (consolidated enterprise) or isolate a single branch.
* **Top-Line KPIs**:
  1. **Total Sales**: Combines Dispatched Wholesale Orders + Retail POS Sales, minus Processed Returns.
  2. **Total Purchases**: Consolidates Inbound Supplier Ingestions from `import_logs`.
  3. **Net Profit**: Revenue minus Cost of Goods Sold minus Returns profit impact.
  4. **Outstanding Market Debt**: Live sum of receivables owed by doctors and pharmacies.
  5. **Supplier Payables**: Live balance of outstanding liabilities owed to local suppliers.
* **Interactive Endpoints**:
  - `GET /api/analytics/sales-purchases-timeline`: Multi-point trend line data.
  - `GET /api/analytics/branch-performance`: Head-to-head revenue/profit comparisons.
  - `GET /api/analytics/top-products`: Ranked highest-revenue medical supplies.
  - `GET /api/analytics/critical-alerts`: Low stock, expiring batches, and credit limit breaches.
  - `POST /api/analytics/suppliers/pay`: Settle supplier invoices directly from the dashboard.

---

## 📡 Exhaustive API Route Reference

### 🔐 Authentication & Session Routes (`/api/auth`)
| Method | Route | Protection | Description | Payload / Parameters |
|---|---|---|---|---|
| `POST` | `/api/auth/login` | Public | Authenticates credentials and sets HTTP-only cookie | `{ registration_number, password, remember }` |
| `GET` | `/api/auth/check` | Public | Validates session, returns user, role, active branch, and live permissions | None (Reads cookie) |
| `GET` | `/api/auth/me` | Public | Alias of `/check` | None |
| `POST` | `/api/auth/logout` | Auth Required | Destroys in-memory session and clears cookie | None |
| `POST` | `/api/auth/refresh-permissions` | Auth Required | Refreshes session permissions cache from database | None |
| `POST` | `/api/auth/switch-branch` | Admin Only | Switches active branch scope for admin session | `{ branch_id }` |

### 📦 Products Master Catalog (`/api/products`)
| Method | Route | Protection | Description | Payload / Parameters |
|---|---|---|---|---|
| `GET` | `/api/products` | Auth + Scope | Fetches active products with joined UOM names | None |
| `POST` | `/api/products` | Auth + Scope | Creates a master product with UOM conversion factor | `{ name, base_uom, has_bulk, bulk_uom, conversion_factor }` |
| `PUT` | `/api/products/:id` | Auth + Scope | Updates product details and master price | `{ name, base_uom, has_bulk, bulk_uom, conversion_factor, price }` |
| `DELETE` | `/api/products/:id` | Blocked | **HTTP 405 Method Not Allowed** (Direct delete blocked) | None |

### 🏢 Warehouse & Inventory (`/api/warehouse` & `/api/inventory`)
| Method | Route | Protection | Description | Payload / Parameters |
|---|---|---|---|---|
| `GET` | `/api/inventory` | Auth + Scope | Branch warehouse inventory joined with master products | None |
| `GET` | `/api/inventory/batches/:warehouseId/:productId` | Auth + Scope | Batches with stock > 0 ordered by expiry date | URL params |
| `PUT` | `/api/inventory/:id` | Auth + Scope | Updates stock, batch number, expiry date, or thresholds | `{ current_stock, batch_number, expiry_date, qty_threshold, expiry_month_threshold }` |
| `DELETE` | `/api/inventory/:id` | Auth + Scope | **Master-Mirror Deletion**: soft-deletes product, hard-wipes mirror stock | URL param (`:id` = product ID) |
| `GET` | `/api/warehouse/stats` | Auth + Scope | Warehouse counts, total inventory financial value | None |
| `GET` | `/api/warehouse/list` | Auth + Scope | All warehouses in branch with capacity & stock stats | None |
| `GET` | `/api/warehouse/:id/inventory` | Auth + Scope | Detailed inventory items in a specific warehouse | URL param |
| `GET` | `/api/warehouse/movements` | Auth + Scope | Recent stock movements from `import_logs` | None |
| `POST` | `/api/warehouse` | `MANAGE_WAREHOUSES_ADD` | Creates warehouse (branch forced from session) | `{ name, location, capacity }` |
| `PUT` | `/api/warehouse/:id` | `MANAGE_WAREHOUSES_EDIT` | Updates warehouse details | `{ name, location, capacity }` |
| `DELETE` | `/api/warehouse/:id` | `MANAGE_WAREHOUSES_DELETE`| Deletes a warehouse record | URL param |

### 📑 Wholesale Orders (`/api/orders`)
| Method | Route | Protection | Description | Payload / Parameters |
|---|---|---|---|---|
| `GET` | `/api/orders` | Auth + Scope | Paginated list of wholesale orders with client names | `?limit=50&offset=0` |
| `GET` | `/api/orders/:id/details` | Auth + Scope | Full order details with client info, items, branch info | URL param |
| `GET` | `/api/orders/:id/items` | Auth + Scope | Line items for a specific order | URL param |
| `GET` | `/api/orders/product/:id/cost-price` | Auth + Scope | Supplier cost & wholesale price lookup | URL param |
| `GET` | `/api/orders/clients` | Auth + Scope | List of clients (legacy) | None |
| `GET` | `/api/orders/history/:clientType/:clientId` | Auth + Scope | Monthly grouped order history for doctor/pharmacy | `:clientType` ('doctor'/'pharmacy'), `:clientId` |
| `POST` | `/api/orders` | Auth + Scope | Creates order, checks credit limit, charges customer debt | `{ client_id, warehouse_id, expected_delivery, items }` |
| `PUT` | `/api/orders/:id/dispatch` | Auth + Scope | Deducts inventory via FEFO or batch, marks Dispatched | URL param |
| `PUT` | `/api/orders/:id/cancel` | Auth + Scope | Reverses customer debt, cancels Pending order | URL param |
| `POST` | `/api/orders/:id/return` | Auth + Scope | Returns items from Dispatched order, credits debt | `{ items: [{ item_id, return_qty, return_reason }] }` |

### 🛒 Point of Sale & Retail (`/api/retail`)
| Method | Route | Protection | Description | Payload / Parameters |
|---|---|---|---|---|
| `GET` | `/api/retail/products/search` | Auth + Scope | Search items with warehouse stock & nearest expiry | `?q=search&warehouse_id=X` |
| `GET` | `/api/retail/shifts/current` | Auth + Scope | Retrieves currently open cashier shift | None |
| `POST` | `/api/retail/shifts/open` | Auth + Scope | Opens a new cashier shift | None |
| `POST` | `/api/retail/shifts/close` | Auth + Scope | Closes the active cashier shift | None |
| `GET` | `/api/retail/shifts/:id/report` | Auth + Scope | Comprehensive shift audit report with profit/COGS | URL param |
| `POST` | `/api/retail/sales` | Auth + Scope | Records POS sale, deducts stock via FEFO | `{ warehouse_id, items: [{ product_id, qty, unit_price, cost_price }] }` |
| `GET` | `/api/retail/sales/:id` | Auth + Scope | Fetches retail sale invoice details and items | URL param |
| `POST` | `/api/retail/returns` | Auth + Scope | Processes retail return, refunds cash, restores stock | `{ warehouse_id, original_sale_id, items }` |
| `GET` | `/api/retail/admin/zero-cost-products` | Admin Only | Lists active products missing purchase cost | None |
| `POST` | `/api/retail/admin/fix-price` | Admin Only | Updates cost price and backfills historical POS sales | `{ product_id, purchase_price }` |

### 🚚 Inbound Supplies & Shipments (`/api/imports` & `/api/suppliers`)
| Method | Route | Protection | Description | Payload / Parameters |
|---|---|---|---|---|
| `GET` | `/api/suppliers` | Auth + Scope | List suppliers with search and city filter | `?search=&city=` |
| `GET` | `/api/suppliers/:id` | Auth + Scope | Fetch single supplier record | URL param |
| `GET` | `/api/suppliers/:id/history` | Auth + Scope | Supplier shipment transactions grouped by month | URL param |
| `POST` | `/api/suppliers` | Auth + Scope | Create new local supplier | `{ company_name, contact_person, phone, city_area, notes }` |
| `PUT` | `/api/suppliers/:id` | Auth + Scope | Update supplier record | Payload fields |
| `DELETE` | `/api/suppliers/:id` | Auth + Scope | Delete supplier record | URL param |
| `GET` | `/api/imports/suppliers` | Auth + Scope | Active supplier list for import dropdown | None |
| `GET` | `/api/imports/warehouse-stock`| Auth + Scope | Products stock aggregated for specific warehouse | `?warehouse_id=X` |
| `GET` | `/api/imports` | Auth + Scope | Inbound import log history | None |
| `POST` | `/api/imports` | Auth + Scope | Multipart upload: creates batches, updates costs, saves invoice | Multipart: `items` (JSON string), `invoiceImage` (File) |
| `POST` | `/api/imports/:id/return` | Auth + Scope | Return stock to supplier, deducts inventory, credits ledger | `{ return_qty, return_reason }` |

### 🔄 Inter-Branch Transfers (`/api/transfers`)
| Method | Route | Protection | Description | Payload / Parameters |
|---|---|---|---|---|
| `GET` | `/api/transfers/warehouses` | Auth + Scope | Warehouses available for transfer operations | None |
| `GET` | `/api/transfers/products/:warehouseId` | Auth + Scope | Available products and stock in selected warehouse | URL param |
| `GET` | `/api/transfers` | Auth + Scope | List of inter-branch transfers | None |
| `POST` | `/api/transfers` | Auth + Scope | Initiates inter-branch transfer in `'PENDING'` status | `{ destination_branch_id, items: [{ item_id, batch_id, quantity }], notes }` |
| `PATCH` | `/api/transfers/:id/status` | Auth + Scope | Updates transfer state (`'IN_TRANSIT'`, `'COMPLETED'`, `'CANCELLED'`) | `{ status }` |
| `GET` | `/api/transfers/audit-logs` | Auth + Scope | Audit trail of inventory variance logs | None |

### 🔁 Unified Returns Engine (`/api/returns`)
| Method | Route | Protection | Description | Payload / Parameters |
|---|---|---|---|---|
| `GET` | `/api/returns/invoices-tree`| Auth + Scope | Hierarchical tree of completed invoices (`Month -> Day -> Invoices`) | `?branch_id=` (Admin only) |
| `GET` | `/api/returns/invoice/:id` | Auth + Scope | Direct lookup of invoice by number or ID | URL param |
| `POST` | `/api/returns/process` | Auth + Scope | Processes return, restores inventory, reverses customer debt | `{ invoice_type, invoice_id, items, return_reason }` |
| `GET` | `/api/returns/history` | Auth + Scope | Returns history log | None |

### 🩺 Doctors & Pharmacies CRM (`/api/doctors` & `/api/pharmacies`)
| Method | Route | Protection | Description | Payload / Parameters |
|---|---|---|---|---|
| `GET` | `/api/doctors` | Auth + Scope | Lists doctors in active branch | None |
| `GET` | `/api/doctors/:id` | Auth + Scope | Fetch single doctor record | URL param |
| `GET` | `/api/doctors/:id/transactions`| Auth + Scope | Full transaction ledger & grouped order history | URL param |
| `GET` | `/api/doctors/:id/orders` | Auth + Scope | Recent orders for doctor profile | URL param |
| `POST` | `/api/doctors` | `CREATE_DOCTOR` | Registers new doctor | `{ name, specialty, phone, location, credit_limit }` |
| `PUT` | `/api/doctors/:id` | `EDIT_DOCTOR` | Updates doctor details | Fields |
| `DELETE` | `/api/doctors/:id` | `DELETE_DOCTOR` | Deletes doctor record | URL param |
| `GET` | `/api/pharmacies` | Auth + Scope | Lists pharmacies in active branch | None |
| `GET` | `/api/pharmacies/:id` | Auth + Scope | Fetch single pharmacy record | URL param |
| `POST` | `/api/pharmacies` | `CREATE_PHARMACY` | Registers new pharmacy | `{ name, contact_person, area, phone, credit_limit }` |
| `PUT` | `/api/pharmacies/:id` | `EDIT_PHARMACY` | Updates pharmacy details | Fields |
| `DELETE` | `/api/pharmacies/:id` | `DELETE_PHARMACY` | Deletes pharmacy record | URL param |

### 💰 Collections & Debt Management (`/api/collections` & `/api/customers`)
| Method | Route | Protection | Description | Payload / Parameters |
|---|---|---|---|---|
| `POST` | `/api/collections` | `can_manage_collections` | Records payment against doctor/pharmacy debt | `{ client_id, amount, payment_method, reference_no, notes }` |
| `GET` | `/api/collections` | `can_manage_collections` | Recent payment history | `?limit=10&offset=0` |
| `GET` | `/api/collections/transactions`| `can_manage_collections` | Alias of `/api/collections` | None |
| `GET` | `/api/collections/debts` | `can_manage_collections` | Lists all doctors & pharmacies with debt > 0 | None |
| `GET` | `/api/customers/debt` | `can_manage_collections` | Global route alias for debt ledger | None |
| `GET` | `/api/collections/summary` | `can_manage_collections` | Monthly collected cash & total outstanding market debt | None |
| `GET` | `/api/collections/client/:id/monthly`| `can_manage_collections`| Current month payment sum for a client | URL param (`doc-X` or `pharm-X`) |

### 👥 Staff Directory & Payroll Advances (`/api/staff` & `/api/withdrawals`)
| Method | Route | Protection | Description | Payload / Parameters |
|---|---|---|---|---|
| `GET` | `/api/staff` | Auth + Scope | Lists all staff members | None |
| `GET` | `/api/staff/stats` | Auth + Scope | Total staff counts by active/leave status | None |
| `GET` | `/api/staff/:id` | Auth + Scope | Single staff record | URL param |
| `POST` | `/api/staff` | Admin Only | Creates staff member | `{ name, role, phone, email, base_salary }` |
| `PUT` | `/api/staff/:id` | Admin Only | Updates staff record | Fields |
| `DELETE` | `/api/staff/:id` | Admin Only | Deletes staff record | URL param |
| `GET` | `/api/withdrawals/stats` | Auth + Scope | Monthly withdrawal total, top withdrawer, alert list | None |
| `GET` | `/api/withdrawals` | Auth + Scope | Recent withdrawals with running monthly calculations | None |
| `POST` | `/api/withdrawals` | Auth + Scope | Records withdrawal, checks against 50% salary threshold | `{ staff_id, amount, reason, category }` |

### 📈 Executive BI & Analytics (`/api/analytics`)
| Method | Route | Protection | Description | Payload / Parameters |
|---|---|---|---|---|
| `GET` | `/api/analytics/summary` | `can_manage_analytics` | 5 Core KPIs (Sales, Cost, Profit, Debt, Payables) with growth % | `?period=this_month&branch_id=all` |
| `GET` | `/api/analytics/branches` | `can_manage_analytics` | List of branches for analytics filter | None |
| `GET` | `/api/analytics/branch-performance` | `can_manage_analytics` | Branch revenue & profit comparison dataset | `?period=this_month` |
| `GET` | `/api/analytics/sales-purchases-timeline` | `can_manage_analytics` | Time-series trend data for charting | `?period=this_month` |
| `GET` | `/api/analytics/top-products` | `can_manage_analytics` | Top performing medical supply items | `?period=this_month` |
| `GET` | `/api/analytics/category-distribution`| `can_manage_analytics`| Inventory distribution by category | `?period=this_month` |
| `GET` | `/api/analytics/critical-alerts` | `can_manage_analytics` | Low-stock, near-expiry, over-credit items | `?period=this_month` |
| `GET` | `/api/analytics/suppliers-payables` | `can_manage_analytics` | Outstanding supplier debt balances | None |
| `POST` | `/api/analytics/suppliers/pay` | `can_manage_analytics` | Settle supplier invoices directly | `{ supplier_id, amount, payment_method, notes }` |

### 🛠 System Administration & User Management (`/api/admin`)
| Method | Route | Protection | Description | Payload / Parameters |
|---|---|---|---|---|
| `GET` | `/api/admin/branches` | Admin Only | Complete branch list | None |
| `GET` | `/api/admin/permissions` | Admin Only | Complete system permissions catalog grouped by category | None |
| `GET` | `/api/admin/staff` | Admin Only | Staff user list with joined roles, branches & permissions array | None |
| `POST` | `/api/admin/staff` | Admin Only | Creates user account, hashes password, assigns permissions | `{ name, registration_number, password, role, branch_id, permissions: [] }` |
| `PUT` | `/api/admin/staff/:id` | Admin Only | Updates user, optional password reset, updates permissions | `{ name, registration_number, password, role, branch_id, status, permissions: [] }` |

---

## 🎨 Frontend Architecture & UI Systems

The frontend operates as a **High-Performance Multi-Page Application (MPA)** with asynchronous client-side controllers.

### Page Directory & Route Mapping

```
public/
├── index.html               # Operational Overview & Navigation Grid
├── login.html               # Authentication Portal
├── dashboard.html           # Admin & RBAC Management Portal
├── products.html            # Master Catalog Management (UOMs, Factor)
├── inventory.html           # Warehouse Inventory Batches & Master-Mirror Delete
├── warehouse.html           # Warehouse Facility Setup & Official Audit Printing
├── orders.html              # Wholesale Order Creation, FEFO Dispatch & Invoices
├── retail_sales.html        # POS Counter Terminal & Cash Shifts (aliased to /pos)
├── import.html              # Inbound Consignments & Supplier Invoice Archival
├── suppliers.html           # Local Supplier Directory & Shipment Ledgers
├── doctors.html             # Doctors CRM, Credit Limits & Ledgers
├── pharmacy_directory.html  # Pharmacies CRM, Credit Limits & Ledgers
├── collections.html         # Customer Debt Collection & Settlement
├── transfer.html            # Inter-Branch Stock Transfer Console
├── withdrawals.html         # Staff Salary Advances & Indebtedness Monitor
├── analytics.html           # Executive BI Dashboard & Chart Analytics
└── admin_fix.html           # Maintenance Screen for Zero-Cost Items
```

### Client-Side Security Guard (`public/js/authGuard.js`)
* Executes synchronously on `DOMContentLoaded`.
* Calls `GET /api/auth/check`.
* If unauthenticated, immediately redirects to `/login.html`.
* Attaches session metadata to `window.__alqudsUser` and `window.__activeBranchId`.
* Enforces client-side route protection:
  - If a user without `can_manage_collections` visits `collections.html` -> redirected to `index.html`.
  - If a user without `can_manage_analytics` visits `analytics.html` -> redirected to `index.html`.

### Inter-Tab State Synchronization (`BroadcastChannel`)
To prevent inventory discrepancies when operators work across multiple browser tabs:
* Whenever an inventory modification or soft-delete occurs in `inventory.js`, it posts a message:
  ```javascript
  const bc = new BroadcastChannel('inventory_sync');
  bc.postMessage({ type: 'INVENTORY_UPDATED' });
  ```
* Open tabs running `warehouse.js`, `main.js`, or `orders.js` listen for `inventory_sync` and automatically refresh their data tables in the background.

---

## 📄 Arabic PDF Generation Engine & Font Architecture

Standard browser-based PDF generation libraries (such as raw jsPDF) fail when rendering Arabic text because Arabic script requires **contextual glyph shaping** (isolated, initial, medial, and final character forms) and **Right-To-Left (RTL) bidirectional reordering**.

```
  Raw Arabic String: "مركز القدس للمستلزمات الطبية"
                         │
                         ▼
             ArabicReshaper.convertArabic(text)
          (Glues letters into cursive connected glyphs)
                         │
                         ▼
             bidi.getReorderedString(reshaped, 'rtl')
               (Reverses visual character sequence)
                         │
                         ▼
          window.fixArabic(text) Output
                         │
                         ▼
      jsPDF.text() with Embedded Amiri / Cairo Font
```

### Key PDF Subsystems:
1. **Font Encodings**: `public/js/amiri_font.js` and `public/js/cairo_font.js` contain base64-encoded Unicode TrueType fonts registered directly into jsPDF's Virtual File System (`VFS`).
2. **`arabic_pdf_helpers.js`**: Built via Browserify (`scripts/build_arabic_pdf.js`), exposing:
   ```javascript
   window.fixArabic = function(text) {
       if (!text) return text;
       const bidiEngine = bidi();
       const reshaped = ArabicReshaper.convertArabic(String(text));
       return bidiEngine.getReorderedString(reshaped, 'rtl');
   };
   ```
3. **Official Declarations & Audit Reports**: `public/js/warehouse.js` and `orders.js` use this pipeline to output Arabic sales invoices, warehouse declaration certificates, and stock balance sheets.

---

## 🗂 Repository File Map & Codebase Organization

```
alquods/
├── app.js                          # Express application entrypoint & middleware pipeline
├── db.js                           # Core PostgreSQL pool wrapper with MySQL2 compatibility
├── package.json                    # Dependencies and npm script definitions
├── .env                            # Environment variables (DATABASE_URL, credentials)
├── .gitignore                      # Git exclusion rules
├── config/
│   ├── db.js                       # Re-export of root db.js
│   └── multer.js                   # Multer storage configuration for invoice photo uploads
├── middleware/
│   └── branchScope.js              # Strict multi-branch scoping & isolation middleware
├── controllers/
│   ├── adminController.js          # User provisioning, roles, permissions management
│   ├── analyticsController.js      # Executive BI, KPIs, chart data & supplier payables
│   ├── authController.js           # Session auth, checkSession, live RBAC, cookies
│   ├── collectionController.js     # Debt collections, customer payments, debt aging
│   ├── dashboardController.js      # Quick card stats for operational index
│   ├── doctorController.js         # Doctors directory, credit limits, orders profile
│   ├── importController.js         # Supply shipments ingestion, invoice images, supplier returns
│   ├── inventoryController.js      # Batch inventory, FEFO inspection, Master-Mirror soft-delete
│   ├── orderController.js          # Wholesale orders, credit check, FEFO dispatch, returns
│   ├── pharmacyController.js       # Pharmacies directory, credit limits, debt records
│   ├── productController.js        # Master catalog definitions, UOM factors, blocked delete
│   ├── retailController.js         # POS retail terminal, cashier shifts, sales returns
│   ├── returnsController.js        # Enterprise returns tree & unified return processor
│   ├── staffController.js          # Staff directory & salary management
│   ├── supplierController.js       # Local supplier CRM & grouped transaction ledgers
│   ├── transferController.js       # Inter-branch stock transfers & audit log state machine
│   └── withdrawalController.js     # Staff payroll advances & 50% salary threshold alerts
├── routes/
│   ├── adminRoutes.js              # Mounted at /api/admin
│   ├── analyticsRoutes.js          # Mounted at /api/analytics
│   ├── authRoutes.js               # Mounted at /api/auth
│   ├── clientRoutes.js             # Mounted at /api/clients
│   ├── collectionRoutes.js         # Mounted at /api/collections
│   ├── dashboardRoutes.js          # Mounted at /api/dashboard
│   ├── doctorRoutes.js             # Mounted at /api/doctors
│   ├── importRoutes.js             # Mounted at /api/imports
│   ├── inventoryRoutes.js          # Mounted at /api/inventory
│   ├── orderRoutes.js              # Mounted at /api/orders
│   ├── pharmacyRoutes.js           # Mounted at /api/pharmacies
│   ├── productRoutes.js            # Mounted at /api/products
│   ├── retailRoutes.js             # Mounted at /api/retail
│   ├── returnsRoutes.js            # Mounted at /api/returns
│   ├── staffRoutes.js              # Mounted at /api/staff
│   ├── supplierRoutes.js           # Mounted at /api/suppliers
│   ├── transferRoutes.js           # Mounted at /api/transfers
│   └── withdrawalRoutes.js         # Mounted at /api/withdrawals
├── public/                         # Static web assets & client-side controllers
│   ├── *.html                      # 18 Modular web page views
│   ├── css/                        # Modular style sheets per domain
│   ├── js/                         # Client-side domain controllers & helpers
│   │   ├── authGuard.js            # Client-side route protection & session injection
│   │   ├── arabic_pdf_helpers.js   # RTL Arabic shaping engine for jsPDF
│   │   ├── amiri_font.js           # Embedded Amiri TrueType font
│   │   ├── cairo_font.js           # Embedded Cairo TrueType font
│   │   ├── chart.umd.min.js        # Chart.js library
│   │   └── main.js                 # Global navigation & index overview logic
│   └── uploads/                    # Uploaded assets
│       └── invoices/               # Archived supplier invoice scans
├── scripts/                        # Database seeders, migrations & diagnostic utilities
└── setup_pg.sql                    # Baseline PostgreSQL database schema & initial seed data
```

---

## 🛠 Migrations, Seeders & Maintenance Scripts

The repository contains automated migration and diagnostic scripts:

| Script Path | Purpose |
|---|---|
| `setup_pg.sql` / `setup_pg.js` | Drops, recreates, and seeds the baseline PostgreSQL schema |
| `migrate_rbac.js` | Creates `branches`, `permissions`, and `staff_permissions` tables |
| `migrate_branch_scoping.js` | Adds `branch_id` foreign keys and indices to all enterprise tables |
| `migrate_stock_transfers.js` | Creates `stock_transfers`, `stock_transfer_items`, and `stock_audit_logs` |
| `scripts/migrate_returns_tables.js` | Creates centralized `returns` and `return_items` tables |
| `migrate_warehouse_permissions.js` | Seeds warehouse management permissions into `permissions` |
| `migrate_doctor_pharmacy_permissions.js` | Seeds doctor & pharmacy CRUD permissions |
| `migrate_collections_permission.js` | Seeds `can_manage_collections` permission |
| `migrate_analytics_permission.js` | Seeds `can_manage_analytics` permission |
| `audit_complete_isolation.js` | **Automated Test Suite**: Executes end-to-end data isolation verification |
| `scripts/build_arabic_pdf.js` | Bundles `arabic-reshaper` and `bidi-js` into `arabic_pdf_helpers.js` |

---

## 💻 Local Setup, Configuration & Deployment

### 1. Prerequisites
* **Node.js**: v18.0.0 or higher
* **PostgreSQL**: v13.0 or higher
* **NPM**: v8.0.0 or higher

### 2. Environment Configuration (`.env`)
Create or verify the `.env` file in the root directory:
```env
# Server Port
PORT=3000

# PostgreSQL Connection String
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/alquods_db

# Admin Provisioning Credentials
ADMIN_EMAIL=alkodsaswan@gmail.com
ADMIN_PASSWORD=alkods2as2as
```

### 3. Database Initialization
```powershell
# 1. Create database in PostgreSQL
psql -U postgres -c "CREATE DATABASE alquods_db;"

# 2. Execute baseline setup
psql -U postgres -d alquods_db -f setup_pg.sql

# 3. Run migrations for RBAC, scoping, and returns
node migrate_rbac.js
node migrate_branch_scoping.js
node migrate_stock_transfers.js
node scripts/migrate_returns_tables.js
node migrate_warehouse_permissions.js
node migrate_doctor_pharmacy_permissions.js
node migrate_collections_permission.js
node migrate_analytics_permission.js
```

### 4. Running the Application
```powershell
# Install dependencies
npm install

# Run in development mode (with nodemon)
npm run dev

# Run in production mode
npm start
```
The server will bind to `http://localhost:3000`.

---

## ⚠️ Golden Rules for AI Agents & Developers

When authoring features, modifying routes, or writing migrations on this codebase, you **must adhere to these ten architectural laws**:

1. **NEVER Bypass `req.branchId`**:
   Never trust `req.body.branch_id` or `req.query.branch_id` unless the authenticated user is an `ADMIN` or `SUPER ADMIN`. Always query using `WHERE branch_id = ?` with `req.branchId` provided by `middleware/branchScope.js`.
2. **NEVER Execute `DELETE FROM products`**:
   The `products` table is the Master Catalog. Deleting a product directly will cause cascading foreign key failures across `order_items` and `import_logs`. Always execute deactivations through `DELETE /api/inventory/:id` which applies the safe soft-delete (`is_active = 0, is_deleted = 1`).
3. **NEVER Mix Raw MySQL Syntax with PostgreSQL**:
   Do not write MySQL constructs like `AUTO_INCREMENT`, `ENUM`, `IFNULL()`, or `NOW() + INTERVAL`. Use standard PostgreSQL constructs (`SERIAL`, `COALESCE`, `CURRENT_TIMESTAMP`, `EXTRACT(...)`).
4. **ALWAYS Respect the `db.js` Wrapper**:
   `db.execute` and `db.query` automatically translate `?` to `$1, $2`. Always pass parameterized arguments in the parameters array to prevent SQL injection.
5. **ALWAYS Wrap Multi-Table Mutations in Transactions**:
   Any operation affecting inventory AND ledgers (such as order creation, dispatch, returns, imports, and POS sales) must acquire a connection via `pool.getConnection()`, issue `beginTransaction()`, and handle `commit()` and `rollback()` cleanly in a `try...catch...finally` block releasing the client.
6. **PRESERVE the Client ID Prefix Convention**:
   Remember that doctors are formatted as `doc-<id>` and pharmacies as `pharm-<id>`. Any client ledger logic must split this prefix using `.split(/[-_]/)`.
7. **FEFO Inventory Order is Mandatory**:
   Whenever deducting inventory automatically without an explicit batch selection, you must sort by expiration date ascending: `ORDER BY expiry_date ASC`.
8. **DO NOT Double-Charge Customer Debt**:
   Customer debt is charged **at the moment the order is created in Pending status**. Dispatching an order deducts physical inventory only; it must **never** add debt again.
9. **MAINTAIN Arabic Text Shaping in PDFs**:
   Never feed raw Arabic strings directly into `jsPDF.text()`. Always pass strings through `window.fixArabic()` so character glyphs are properly shaped and reordered for Right-To-Left presentation.
10. **PRESERVE Cross-Tab Broadcasts**:
    When modifying inventory levels or deactivating catalog items, always broadcast an event over `new BroadcastChannel('inventory_sync')` so other open tabs stay in sync without requiring manual page reloads.

---

*Authored by Antigravity Engineering for the Al-Quds Medical Operations Team.*
