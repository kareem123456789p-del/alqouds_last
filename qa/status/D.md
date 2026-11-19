# QA Worker D — Status Report

## Domain
POS/Retail, Returns Engine, Imports & Suppliers

## Test Suite Summary
- Directory: `tests/integration/retail/`
- Files: 6 (`shifts.test.js`, `retail-sales.test.js`, `retail-returns.test.js`, `returns-engine.test.js`, `imports.test.js`, `suppliers.test.js`)
- Total Tests: 82 passed (including 16 `test.failing` cases verifying 13 known bugs)
- Total Routes Covered: 25 / 25 assigned routes (100%)

## Known Bugs Verified
- **D-BUG-1 (critical)**: POST /api/retail/returns ignores original invoice and allows arbitrary refunds.
- **D-BUG-2 (high)**: POS sale attaches to another branch's open shift.
- **D-BUG-3 (high)**: GET /api/retail/sales/:id and /shifts/:id/report lack branch scope checks.
- **D-BUG-4 (high)**: POS sales trust client-supplied cost_price.
- **D-BUG-5 (high)**: Retail admin pricing endpoints lack permission check.
- **D-BUG-6 (high)**: POST /api/imports/:id/return deducts stock cross-branch.
- **D-BUG-7 (high)**: Full supplier return syntax error with double-quoted status 'Returned'.
- **D-BUG-8 (medium)**: POST /api/imports accepts warehouse from another branch.
- **D-BUG-9 (medium)**: DELETE /api/suppliers/:id hard deletes and crashes with FK 500.
- **D-BUG-10 (medium)**: POST /api/retail/sales returns 500 instead of 400 when shift is closed.
- **D-BUG-11 (medium)**: POST /api/retail/sales returns 500 on insufficient stock instead of 400.
- **D-BUG-12 (low)**: Zero-cost POS sale profit calculation does not handle missing cost correctly.
- **D-BUG-13 (medium)**: GET /api/suppliers/:id/history INNER JOIN excludes opening balance transactions.

QA_WORKER_DONE:D
