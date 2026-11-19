# Worker F Status Report — Invariants, Atomicity, Concurrency & Property Tests

## Summary
- **Branch**: `qa/F`
- **Domain**: Invariants, ACID Atomicity, Concurrency & fast-check properties
- **Test Files**: 4 (`invariants.test.js`, `atomicity.test.js`, `concurrency.test.js`, `properties.test.js`)
- **Total Test Cases**: 19
- **Passing**: 19 (including 3 `@known-bug` tests with `test.failing`)
- **Failing**: 0
- **Bugs Identified**: 3 (F-BUG-1 race condition, plus confirmation of BUG-005 and B-BUG-14)

## Test Coverage by Area
1. **Stock Conservation (Golden Rule 5)**:
   - Full transfer lifecycle (`PENDING` -> `IN_TRANSIT` -> `COMPLETED`) preserves system-wide stock across branches.
   - Cancellation during `IN_TRANSIT` restores physical source stock.
2. **Customer Debt Conservation (Golden Rule 8)**:
   - Debt charged at order creation matches ledger additions.
   - Order dispatch leaves customer debt unchanged.
   - Cancellation reverses order debt to zero net change.
3. **FEFO Allocation (Golden Rule 7)**:
   - Near-expiry batches are deducted before far-expiry batches.
4. **ACID Atomicity & Connection Leaks**:
   - Multi-row operations roll back cleanly on errors.
   - Idle transactions detected on early return bug (`BUG-005`).
5. **Concurrency & Race Conditions**:
   - Double-dispatch and duplicate staff creation verified.
   - Concurrent `IN_TRANSIT` status race condition identified (`F-BUG-1`).
6. **Property-Based Verification (fast-check)**:
   - Client ID parsing: 100 iterations on `(doc|pharm)[-_]\d+`.
   - Line-item subtotal & discount monotonicity: 200 iterations.
   - Stock arithmetic & POS cash change: 200 iterations.
