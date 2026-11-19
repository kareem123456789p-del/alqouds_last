# QA Worker B — Status Report

## Domain
Products, Inventory, Warehouses, Inter-Branch Transfers

## Test Suite Summary
- Directory: `tests/integration/inventory/`
- Files: 5 (`products.test.js`, `inventory.test.js`, `warehouses.test.js`, `transfers.test.js`, `routes.test.js`)
- Total Tests: 89 passed (including 15 `test.failing` cases verifying 14 known bugs)
- Total Routes Covered: 21 / 21 assigned routes (100%)

## Known Bugs Verified
- **B-BUG-1 (high)**: PUT /api/products/:id partial update wipes price to 0.
- **B-BUG-2 (medium)**: PUT /api/products/:id with nonexistent id returns 200 success.
- **B-BUG-3 (medium)**: GET /api/warehouse/stats calculation mismatch vs raw inventory SQL.
- **B-BUG-4 (high)**: Warehouse PUT/DELETE cross-branch id returns 200 silent success without mutating row.
- **B-BUG-5 (high)**: Deleting warehouse with active stock does not reject with 4xx.
- **B-BUG-6 (high)**: PUT /api/inventory/:id without current_stock crashes with 500.
- **B-BUG-7 (critical)**: PUT /api/inventory/:id accepts and persists negative stock.
- **B-BUG-8 (critical)**: POST /api/transfers accepts negative or zero quantity.
- **B-BUG-9 (medium)**: POST /api/transfers returns 500 on insufficient/missing batch instead of 400.
- **B-BUG-10 (high)**: POST /api/transfers does not validate item_id belongs to batch product.
- **B-BUG-11 (high)**: Completing transfer fails if matching destination batch does not exist.
- **B-BUG-12 (medium)**: SUPER ADMIN not recognized as admin in transfer status update.
- **B-BUG-13 (medium)**: transfer_code collision causes 500 on unique constraint.
- **B-BUG-14 (medium)**: Destination branch existence not validated before DB FK violation.

QA_WORKER_DONE:B
