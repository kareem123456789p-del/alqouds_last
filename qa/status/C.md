# QA Worker C — Status Report

## Domain
Wholesale Orders, Collections, Withdrawals (Money & Ledgers)

## Test Suite Summary
- Directory: `tests/integration/finance/`
- Files: 6 (`routes.test.js`, `orders-create.test.js`, `orders-lifecycle.test.js`, `orders-scope.test.js`, `collections.test.js`, `withdrawals.test.js`)
- Total Tests: 65 passed (including 11 `test.failing` cases verifying 9 known bugs)
- Total Routes Covered: 19 / 19 assigned routes (100%)

## Known Bugs Verified
- **C-BUG-1 (high)**: GET /api/orders/clients queries nonexistent clients table -> 500 (BUG-006).
- **C-BUG-2 (high)**: GET /api/orders/:id/details joins nonexistent orders.created_by -> 500 (BUG-003).
- **C-BUG-3 (critical)**: Orders endpoints are not branch-scoped (Golden Rule 1 violation, BUG-004).
- **C-BUG-4 (high)**: createOrder early returns inside open transaction leave connection idle in transaction (BUG-005).
- **C-BUG-6 (medium)**: Collections treats any non-doc prefix as pharmacy 1 instead of returning 400 (BUG-020).
- **C-BUG-7 (medium)**: Collections overpayment drives client total_debt negative.
- **C-BUG-8 (high)**: Withdrawals staff lookup is not branch-scoped (BUG-016).
- **C-BUG-9 (high)**: Withdrawals endpoint accepts negative amounts (BUG-016).
- **C-BUG-10 (medium)**: getClientHistory calculates outstanding balance from sum of orders instead of total_debt.

QA_WORKER_DONE:C
