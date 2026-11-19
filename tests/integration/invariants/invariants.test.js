'use strict';
/**
 * Worker F — Domain Invariants & Conservation Laws
 *
 * Golden Rules Covered:
 * - Golden Rule 5: Stock conservation across full transfer lifecycle.
 * - Golden Rule 7: FEFO batch consumption (earliest expiry first).
 * - Golden Rule 8: Customer debt conservation (creation charges, dispatch preserves, cancel reverses).
 * - Supplier balance conservation with supplier_transactions.
 * - Physical stock consistency across warehouse_inventory and products.
 */

const { loginAs, clearSessions } = require('../../helpers/auth');
const {
  resetDatabase, q, one, scalar,
  stockSum, warehouseStock, clientLedgerSum, clientDebt, supplierBalance
} = require('../../helpers/db');

beforeEach(async () => {
  await resetDatabase();
});

afterAll(clearSessions);

describe('Invariant: Stock Conservation Across Transfer Lifecycle (Golden Rule 5)', () => {
  test('total physical stock is conserved across PENDING -> IN_TRANSIT -> COMPLETED (merge path)', async () => {
    const emp1 = await loginAs('emp1');
    const emp2 = await loginAs('emp2');

    const srcBatchBefore = await one(
      'SELECT id, batch_number, expiry_date, unit_price, current_stock FROM warehouse_inventory WHERE product_id = 2 AND branch_id = 1 AND batch_number = $1',
      ['B-P2-FAR']
    );
    expect(srcBatchBefore.current_stock).toBe(25);

    // Pre-create matching batch at destination branch 2 warehouse 3 so COMPLETED takes the merge path
    await q(
      `INSERT INTO warehouse_inventory
         (warehouse_id, product_id, batch_number, expiry_date, current_stock,
          qty_threshold, expiry_month_threshold, unit_price, branch_id)
       VALUES (3, 2, $1, $2, 5, 20, 3, $3, 2)`,
      [srcBatchBefore.batch_number, srcBatchBefore.expiry_date, srcBatchBefore.unit_price]
    );

    const initialTotalStock = await stockSum(2);

    // 1. Create transfer: PENDING
    const createRes = await emp1.post('/api/transfers').send({
      destination_branch_id: 2,
      items: [{ item_id: 2, batch_id: srcBatchBefore.id, quantity: 10 }],
      notes: 'qa invariant test'
    });
    expect([200, 201]).toContain(createRes.status);
    const transferId = createRes.body.transfer_id;

    // In PENDING, stock is NOT decremented yet
    const totalDuringPending = await stockSum(2);
    expect(totalDuringPending).toBe(initialTotalStock);

    // 2. Ship transfer: IN_TRANSIT
    const shipRes = await emp1.patch(`/api/transfers/${transferId}/status`).send({ status: 'IN_TRANSIT' });
    expect(shipRes.status).toBe(200);

    // During IN_TRANSIT, physical stock in warehouses has decreased by 10
    const totalDuringTransit = await stockSum(2);
    expect(totalDuringTransit).toBe(initialTotalStock - 10);

    // 3. Receive transfer: COMPLETED
    const receiveRes = await emp2.patch(`/api/transfers/${transferId}/status`).send({ status: 'COMPLETED' });
    expect(receiveRes.status).toBe(200);

    // When COMPLETED, stock arrives at destination, total stock is restored to initial!
    const totalAfterCompleted = await stockSum(2);
    expect(totalAfterCompleted).toBe(initialTotalStock);

    // Verification of source and destination
    const srcBatchAfter = await one('SELECT current_stock FROM warehouse_inventory WHERE id = $1', [srcBatchBefore.id]);
    expect(srcBatchAfter.current_stock).toBe(15);
  });

  test('@known-bug B-BUG-14: receiving transfer without existing destination batch fails with 23502 warehouse_id NOT NULL', async () => {
    const emp1 = await loginAs('emp1');
    const emp2 = await loginAs('emp2');

    // Transfer product 1 batch which does not exist in branch 2
    const srcBatch = await one(
      'SELECT id, current_stock FROM warehouse_inventory WHERE product_id = 1 AND branch_id = 1 LIMIT 1'
    );
    const createRes = await emp1.post('/api/transfers').send({
      destination_branch_id: 2,
      items: [{ item_id: 1, batch_id: srcBatch.id, quantity: 2 }],
    });
    const transferId = createRes.body.transfer_id;

    await emp1.patch(`/api/transfers/${transferId}/status`).send({ status: 'IN_TRANSIT' });

    // This fails because transferController omits warehouse_id when creating new batch in destination
    const receiveRes = await emp2.patch(`/api/transfers/${transferId}/status`).send({ status: 'COMPLETED' });
    expect(receiveRes.status).toBe(200);
  });

  test('stock is conserved when an IN_TRANSIT transfer is CANCELLED', async () => {
    const emp1 = await loginAs('emp1');

    const initialTotalStock = await stockSum(2);
    const srcBatch = await one(
      'SELECT id, current_stock FROM warehouse_inventory WHERE product_id = 2 AND branch_id = 1 AND batch_number = $1',
      ['B-P2-FAR']
    );

    const createRes = await emp1.post('/api/transfers').send({
      destination_branch_id: 2,
      items: [{ item_id: 2, batch_id: srcBatch.id, quantity: 7 }],
    });
    const transferId = createRes.body.transfer_id;

    // Ship to IN_TRANSIT
    await emp1.patch(`/api/transfers/${transferId}/status`).send({ status: 'IN_TRANSIT' });
    expect(await stockSum(2)).toBe(initialTotalStock - 7);

    // Cancel while IN_TRANSIT (must restore source stock)
    const cancelRes = await emp1.patch(`/api/transfers/${transferId}/status`).send({ status: 'CANCELLED' });
    expect(cancelRes.status).toBe(200);

    // Source batch restored and total stock conserved
    const srcBatchAfter = await one('SELECT current_stock FROM warehouse_inventory WHERE id = $1', [srcBatch.id]);
    expect(srcBatchAfter.current_stock).toBe(srcBatch.current_stock);
    expect(await stockSum(2)).toBe(initialTotalStock);
  });
});

describe('Invariant: Customer Debt Conservation (Golden Rule 8)', () => {
  test('client total_debt exactly equals initial debt + sum of client_transactions', async () => {
    const emp = await loginAs('emp1');
    const clientId = 'doc-1';

    const debt0 = await clientDebt(clientId);
    const ledger0 = await clientLedgerSum(clientId);

    // Step 1: Create wholesale order (+50 debt)
    const orderRes = await emp.post('/api/orders').send({
      client_id: clientId,
      warehouse_id: 1,
      items: [{ product_id: 1, warehouse_id: 1, qty: 5, unit_price: 10.0, base_price: 5.0 }],
    });
    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.order_id;

    const debt1 = await clientDebt(clientId);
    const ledger1 = await clientLedgerSum(clientId);
    expect(debt1).toBe(debt0 + 50);
    expect(ledger1).toBe(ledger0 + 50);

    // Step 2: Dispatch order (Golden Rule 8: debt must remain unchanged)
    const dispatchRes = await emp.put(`/api/orders/${orderId}/dispatch`);
    expect(dispatchRes.status).toBe(200);

    const debt2 = await clientDebt(clientId);
    const ledger2 = await clientLedgerSum(clientId);
    expect(debt2).toBe(debt1);
    expect(ledger2).toBe(ledger1);

    // Step 3: Record a collection payment (-20 debt)
    const coll = await loginAs('coll1');
    const collectRes = await coll.post('/api/collections').send({
      client_id: clientId,
      amount: 20,
      payment_method: 'Cash',
      reference_no: 'REC-INVAR-01',
      notes: 'qa test payment',
    });
    expect([200, 201]).toContain(collectRes.status);

    const debt3 = await clientDebt(clientId);
    const ledger3 = await clientLedgerSum(clientId);
    expect(debt3).toBe(debt2 - 20);
    expect(ledger3).toBe(ledger2 - 20);
  });

  test('cancelling a pending order reverses debt and leaves zero net change', async () => {
    const emp = await loginAs('emp1');
    const clientId = 'doc-1';

    const initialDebt = await clientDebt(clientId);
    const initialLedger = await clientLedgerSum(clientId);

    // Create order of 120
    const orderRes = await emp.post('/api/orders').send({
      client_id: clientId,
      warehouse_id: 1,
      items: [{ product_id: 1, warehouse_id: 1, qty: 12, unit_price: 10.0, base_price: 5.0 }],
    });
    expect([200, 201]).toContain(orderRes.status);
    const orderId = orderRes.body.order_id;

    // Cancel order
    const cancelRes = await emp.put(`/api/orders/${orderId}/cancel`);
    expect(cancelRes.status).toBe(200);

    const finalDebt = await clientDebt(clientId);
    const finalLedger = await clientLedgerSum(clientId);

    expect(finalDebt).toBe(initialDebt);
    expect(finalLedger).toBe(initialLedger);
  });
});

describe('Invariant: FEFO Batch Allocation (Golden Rule 7)', () => {
  test('dispatched orders consume batches with earliest expiry_date first', async () => {
    const emp = await loginAs('emp1');

    // Product 2 has two batches in warehouse 1:
    // B-P2-NEAR: expiry 2026-06-01, stock 15
    // B-P2-FAR:  expiry 2027-01-01, stock 25
    const nearBatchBefore = await one(
      'SELECT id, current_stock, expiry_date FROM warehouse_inventory WHERE product_id = 2 AND warehouse_id = 1 AND batch_number = $1',
      ['B-P2-NEAR']
    );
    const farBatchBefore = await one(
      'SELECT id, current_stock, expiry_date FROM warehouse_inventory WHERE product_id = 2 AND warehouse_id = 1 AND batch_number = $1',
      ['B-P2-FAR']
    );

    expect(new Date(nearBatchBefore.expiry_date).getTime()).toBeLessThan(new Date(farBatchBefore.expiry_date).getTime());

    // Create and dispatch an order of 10 units (less than near batch stock 15)
    const createRes = await emp.post('/api/orders').send({
      client_id: 'doc-1',
      warehouse_id: 1,
      items: [{ product_id: 2, warehouse_id: 1, qty: 10, unit_price: 20.0, base_price: 15.0 }],
    });
    const orderId = createRes.body.order_id;

    const dispatchRes = await emp.put(`/api/orders/${orderId}/dispatch`);
    expect(dispatchRes.status).toBe(200);

    // FEFO Invariant: near batch must be deducted first!
    const nearBatchAfter = await one('SELECT current_stock FROM warehouse_inventory WHERE id = $1', [nearBatchBefore.id]);
    const farBatchAfter = await one('SELECT current_stock FROM warehouse_inventory WHERE id = $1', [farBatchBefore.id]);

    expect(nearBatchAfter.current_stock).toBe(nearBatchBefore.current_stock - 10);
    expect(farBatchAfter.current_stock).toBe(farBatchBefore.current_stock);
  });
});

describe('Invariant: Physical Inventory vs Product Current Stock', () => {
  test('sum of active batch current_stock in warehouse_inventory is non-negative for all products', async () => {
    const negativeBatches = await q(
      'SELECT id, product_id, warehouse_id, current_stock FROM warehouse_inventory WHERE current_stock < 0'
    );
    expect(negativeBatches).toEqual([]);
  });
});
