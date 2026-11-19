# Business Logic & Comprehensive Test Plan — Al-Quds Medical ERP

> **Purpose for AI Agents**: This file stores the initial planning mode, the critical business logic questions, and (once answered by the user) the exact architectural decisions to be implemented across production code and test suites.
> **Current Status**: **Phase 1: Planning & Clarification** (Awaiting User Review).
> **Instructions for Subsequent Agent**:
> 1. Read the user's answers in Section 3 below.
> 2. Implement the designated routes and business rules according to the selected options.
> 3. Verify that all 32 test suites (405+ tests) remain 100% green without regressions.
> 4. Update the test assertions if business logic requirements changed expected behavior (e.g., allowing credit overpayments instead of 400).

---

## 1. Executive Summary & Objective

The Al-Quds Medical ERP has achieved 100% test passage (32 suites, 405 tests passing) on branch `qa/full-coverage` with all 28 foundational bugs (BUG-001..BUG-028) fixed.
However, several core business workflows involve subjective domain choices (e.g., overpayment handling, receipt-less returns, manager vs admin staff privileges, supplier archiving).

This document establishes the roadmap to:
1. Clarify each ambiguous business logic decision with the project owner.
2. Lock in the authoritative route behavior for the ERP.
3. Implement any necessary adjustments or enhancements once approved.
4. Preserve a permanent decision log for any AI agent continuing the task.

---

## 2. Business Logic Decision Matrix & Open Questions

The following 7 core domain decisions require user selection before final implementation:

### Question 1: Customer Identity Architecture (`doctors` vs `pharmacies`)
- **Context**: The system separates clients into `doctors` (using `doc-<id>`) and `pharmacies` (using `pharm-<id>`). `GET /api/orders/clients` originally queried a nonexistent `clients` table. We fixed this by executing a `UNION ALL` across both tables.
- **Option 1A (Current)**: Keep dual tables (`doctors` and `pharmacies`) with `doc-` / `pharm-` prefix parsing and unified API views.
- **Option 1B**: Create a database SQL View named `clients` that normalizes `(id, client_code, name, type, phone, address, total_debt, branch_id)` for cleaner reporting.
- **User Decision**: *(Pending)*

---

### Question 2: Client Collections & Overpayment Policy
- **Context**: When a doctor or pharmacy pays more than their outstanding debt (`POST /api/collections`):
- **Option 2A (Current Strict)**: Reject the payment with `400 Bad Request` ("Payment exceeds total outstanding debt of X").
- **Option 2B (Customer Credit)**: Accept overpayment, record the full amount in `client_transactions`, and allow `total_debt` to become negative (representing a credit balance in favor of the client for future orders).
- **User Decision**: *(Pending)*

---

### Question 3: Retail POS Returns & Receipt Validation Policy
- **Context**: `POST /api/retail/returns` allows processing returns for retail sales.
- **Option 3A (Current Strict Audit)**: Strict receipt required. Every return must reference a valid `original_sale_id` from the caller's branch, the item must have been on that sale, and `return_qty <= sold_qty - already_returned_qty`.
- **Option 3B (Flexible Store Credit / Manager Override)**: Allow standard receipt returns, but also allow an authorized manager to approve receipt-less returns (restocking at product base cost or generating store credit).
- **User Decision**: *(Pending)*

---

### Question 4: Inter-Branch Stock Transfers — In-Transit Cancellation Handling
- **Context**: A stock transfer is `IN_TRANSIT` (stock already decremented from source warehouse). If the transfer is cancelled before reaching destination:
- **Option 4A (Current Automatic Restock)**: Automatically restore the in-transit quantity back into the original source batch in the source warehouse.
- **Option 4B (Quarantine / Goods Damaged Workflow)**: Instead of direct restock, mark the transfer items as `DAMAGED_IN_TRANSIT` or redirect to a quarantine warehouse if goods were damaged/lost during courier transport.
- **User Decision**: *(Pending)*

---

### Question 5: Staff Management Role Privileges
- **Context**: `POST /api/staff`, `PUT /api/staff/:id`, `DELETE /api/staff/:id`.
- **Option 5A (Current Strict Admin Only)**: Only `ADMIN` and `SUPER ADMIN` roles can create, update, or delete staff records across the system.
- **Option 5B (Branch Manager Delegation)**: Allow `BRANCH_MANAGER` to create/edit regular `EMPLOYEE` staff strictly within their own branch (`req.branchId`), but reserve admin role assignment and cross-branch editing to `ADMIN`.
- **User Decision**: *(Pending)*

---

### Question 6: Analytics Visibility for Branch Managers
- **Context**: `GET /api/analytics/*` endpoints. Currently, non-admins are strictly locked to their session branch even if `?branch_id=2` is passed.
- **Option 6A (Current Strict Branch Isolation)**: Non-admin employees and branch managers can ONLY see their assigned branch data. `?branch_id` overrides are strictly ignored for non-admins.
- **Option 6B (Multi-Branch Analytical Role)**: Grant `BRANCH_MANAGER` read-only visibility into aggregated regional performance if an explicit permission flag (`can_view_all_analytics`) is enabled.
- **User Decision**: *(Pending)*

---

### Question 7: Supplier Deletion vs Archiving Policy
- **Context**: `DELETE /api/suppliers/:id`. Currently, deleting a supplier with linked transactions fails with 400 to protect accounting history.
- **Option 7A (Current Integrity Guard)**: Hard delete only allowed if zero transactions exist. Return `400 Bad Request` if transactions exist.
- **Option 7B (Soft-Delete / Archiving)**: Add an `is_active BOOLEAN DEFAULT TRUE` column. When a supplier with transaction history is deleted, set `is_active = FALSE` instead of deleting, hiding them from active selection while preserving ledger integrity.
- **User Decision**: *(Pending)*

---

## 3. User Answers & Concrete Directives

*(This section will be populated once the user confirms their choices for Questions 1–7. Incoming agents should read the entries below to execute the implementation).*

- **Decision 1 (Client Architecture)**: `[To be updated upon user answer]`
- **Decision 2 (Overpayment Handling)**: `[To be updated upon user answer]`
- **Decision 3 (Retail Returns)**: `[To be updated upon user answer]`
- **Decision 4 (Transfer Cancellation)**: `[To be updated upon user answer]`
- **Decision 5 (Staff Management Privileges)**: `[To be updated upon user answer]`
- **Decision 6 (Analytics Scoping)**: `[To be updated upon user answer]`
- **Decision 7 (Supplier Archiving)**: `[To be updated upon user answer]`

---

## 4. Implementation & Verification Plan (Once Directed)

1. **Production Code Updates**:
   - Update affected controllers based on user choices.
   - Run database schema migration if Soft Delete or SQL Views are selected.
2. **Test Suite Alignment**:
   - Update or add dedicated integration tests in `tests/integration/` mirroring the user's chosen options.
3. **Automated Verification**:
   - Execute `npm test` to confirm all 32 suites pass.
   - Run regression check on all 10 Golden Rules.
4. **Git Checkpoint & GitHub Remote Push**:
   - Commit changes with clear, descriptive semantic commit messages.
   - Push to `origin/qa/full-coverage`.
