'use strict';
/**
 * Worker F — ACID Atomicity & Connection Leak Tests
 *
 * Covers:
 * - Transaction rollback on failure (no partial orders, items, or debt).
 * - Transfer atomicity (partial item failures roll back whole transfer).
 * - Connection and transaction leak verification (openTransactionCount === 0).
 * - BUG-005 (early return in createOrder leaves connection idle in transaction).
 */

const { loginAs, clearSessions } = require('../../helpers/auth');
const {
  resetDatabase, q, one, scalar, count,
  openTransactionCount, clientDebt, clientLedgerSum
} = require('../../helpers/db');

beforeEach(async () => {
  await resetDatabase();
});

afterAll(clearSessions);

describe('ACID Atomicity: Rollback on Business Logic and DB Failure', () => {
  test('failed order creation midway rolls back all changes (no order, items, or debt change)', async () => {
    const emp = await loginAs('emp1');
    const clientId = 'doc-1';

    const ordersCountBefore = await count('orders');
    const itemsCountBefore = await count('order_items');
    const txCountBefore = await count('client_transactions');
    const debtBefore = await clientDebt(clientId);

    // Order with one valid item, but triggers credit limit failure
    // Doc 1 limit is 60,000. Try order of 70,000 (7000 qty * 10 unit_price)
    const res = await emp.post('/api/orders').send({
      client_id: clientId,
      warehouse_id: 1,
      items: [{ product_id: 1, warehouse_id: 1, qty: 7000, unit_price: 10.0, base_price: 5.0 }],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Credit Limit Exceeded/i);

    // Atomicity assertion: No rows inserted anywhere
    expect(await count('orders')).toBe(ordersCountBefore);
    expect(await count('order_items')).toBe(itemsCountBefore);
    expect(await count('client_transactions')).toBe(txCountBefore);
    expect(await clientDebt(clientId)).toBe(debtBefore);
  });

  test('failed stock transfer creation with invalid destination branch rolls back completely', async () => {
    const emp = await loginAs('emp1');

    const transfersCountBefore = await count('stock_transfers');
    const itemsCountBefore = await count('stock_transfer_items');

    const srcBatch = await one('SELECT id, current_stock FROM warehouse_inventory WHERE product_id = 1 AND branch_id = 1 LIMIT 1');

    // Attempt transfer with non-existent destination branch 999
    const res = await emp.post('/api/transfers').send({
      destination_branch_id: 999,
      items: [{ item_id: 1, batch_id: srcBatch.id, quantity: 2 }],
      notes: 'non-existent branch',
    });

    expect([400, 500]).toContain(res.status);

    // Neither transfer nor transfer items should be persisted
    expect(await count('stock_transfers')).toBe(transfersCountBefore);
    expect(await count('stock_transfer_items')).toBe(itemsCountBefore);
  });

  test('failed transfer status update rolls back without modifying inventory', async () => {
    const emp1 = await loginAs('emp1');
    const emp2 = await loginAs('emp2');

    const srcBatch = await one('SELECT id, current_stock FROM warehouse_inventory WHERE product_id = 2 AND branch_id = 1 AND batch_number = $1', ['B-P2-FAR']);

    const createRes = await emp1.post('/api/transfers').send({
      destination_branch_id: 2,
      items: [{ item_id: 2, batch_id: srcBatch.id, quantity: 5 }],
    });
    const transferId = createRes.body.transfer_id;

    // Transition to IN_TRANSIT
    await emp1.patch(`/api/transfers/${transferId}/status`).send({ status: 'IN_TRANSIT' });

    const stockBeforeBadCall = (await one('SELECT current_stock FROM warehouse_inventory WHERE id = $1', [srcBatch.id])).current_stock;

    // Bad status update from unpermitted branch or invalid status
    const badRes = await emp1.patch(`/api/transfers/${transferId}/status`).send({ status: 'INVALID_STATUS' });
    expect(badRes.status).toBe(400);

    const stockAfterBadCall = (await one('SELECT current_stock FROM warehouse_inventory WHERE id = $1', [srcBatch.id])).current_stock;
    expect(stockAfterBadCall).toBe(stockBeforeBadCall);
  });
});

describe('Connection Leak & Open Transaction Detection', () => {
  test('successful operations do not leave open transactions (idle in transaction = 0)', async () => {
    const emp = await loginAs('emp1');

    // Perform valid read and write
    await emp.get('/api/products');
    await emp.get('/api/warehouses');

    const openTx = await openTransactionCount();
    expect(openTx).toBe(0);
  });

  test('@known-bug BUG-005: early validation return in createOrder leaves transaction open', async () => {
    const emp = await loginAs('emp1');

    // Sending missing warehouse_id triggers early return on line 258 of orderController without rollback/release
    const res = await emp.post('/api/orders').send({
      client_id: 'doc-1',
      // missing warehouse_id and items
    });
    expect(res.status).toBe(400);

    // This should ideally be 0, but BUG-005 leaks an 'idle in transaction' connection
    const openTx = await openTransactionCount();
    expect(openTx).toBe(0);
  });
});
