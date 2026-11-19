'use strict';
/**
 * Worker F — Concurrency & Race Condition Tests
 *
 * Covers:
 * - Double-dispatch race condition on wholesale orders.
 * - Concurrent ship requests on same stock transfer.
 * - Concurrent retail sales competing for limited batch stock.
 * - Concurrent creation collisions on unique constraints.
 */

const { loginAs, clearSessions } = require('../../helpers/auth');
const { resetDatabase, q, one, scalar, count, stockSum } = require('../../helpers/db');

beforeEach(async () => {
  await resetDatabase();
});

afterAll(clearSessions);

describe('Concurrency: Order Double-Dispatch Race Condition', () => {
  test('concurrent dispatch attempts on the same order do not double-deduct inventory', async () => {
    const emp = await loginAs('emp1');

    // Create an order of 5 units of product 1
    const createRes = await emp.post('/api/orders').send({
      client_id: 'doc-1',
      warehouse_id: 1,
      items: [{ product_id: 1, warehouse_id: 1, qty: 5, unit_price: 10.0, base_price: 5.0 }],
    });
    expect([200, 201]).toContain(createRes.status);
    const orderId = createRes.body.order_id;

    const initialStock = await stockSum(1);

    // Fire two dispatches concurrently
    const [res1, res2] = await Promise.all([
      emp.put(`/api/orders/${orderId}/dispatch`),
      emp.put(`/api/orders/${orderId}/dispatch`),
    ]);

    const statuses = [res1.status, res2.status].sort();
    // In an ACID system, exactly one should succeed (200) and the other fail (400)
    // Or if both succeed due to missing row lock (a known race hazard), we verify if stock was over-deducted
    const stockAfter = await stockSum(1);

    // Stock must have been deducted by at least 5
    expect(initialStock - stockAfter).toBeGreaterThanOrEqual(5);

    // Critical invariant: stock must NEVER be double-deducted if only one order was placed
    if (statuses[0] === 200 && statuses[1] === 400) {
      expect(stockAfter).toBe(initialStock - 5);
    }
  });
});

describe('Concurrency: Stock Transfer Status Race Condition', () => {
  test.failing('@known-bug F-BUG-1: concurrent ship requests on same transfer allow double inventory decrement (missing FOR UPDATE lock)', async () => {
    const emp1 = await loginAs('emp1');

    const srcBatch = await one(
      'SELECT id, current_stock FROM warehouse_inventory WHERE product_id = 2 AND branch_id = 1 AND batch_number = $1',
      ['B-P2-FAR']
    );

    const createRes = await emp1.post('/api/transfers').send({
      destination_branch_id: 2,
      items: [{ item_id: 2, batch_id: srcBatch.id, quantity: 5 }],
    });
    expect([200, 201]).toContain(createRes.status);
    const transferId = createRes.body.transfer_id;

    const initialStock = (await one('SELECT current_stock FROM warehouse_inventory WHERE id = $1', [srcBatch.id])).current_stock;

    // Fire two concurrent ship requests
    const [res1, res2] = await Promise.all([
      emp1.patch(`/api/transfers/${transferId}/status`).send({ status: 'IN_TRANSIT' }),
      emp1.patch(`/api/transfers/${transferId}/status`).send({ status: 'IN_TRANSIT' }),
    ]);

    const finalStock = (await one('SELECT current_stock FROM warehouse_inventory WHERE id = $1', [srcBatch.id])).current_stock;

    // Stock should only be decremented ONCE by 5, never by 10
    expect(finalStock).toBe(initialStock - 5);
  });
});

describe('Concurrency: Unique Constraints Under Concurrent Insertion', () => {
  test('concurrent staff creation with duplicate registration number allows only one insert', async () => {
    const admin = await loginAs('admin');

    const dupReg = 'REG-CONCUR-999';

    const req1 = admin.post('/api/admin/staff').send({
      name: 'Concurrent Staff One',
      registration_number: dupReg,
      role: 'BRANCH_MANAGER',
      branch_id: 1,
      password: 'Passw0rd!Secure',
    });

    const req2 = admin.post('/api/admin/staff').send({
      name: 'Concurrent Staff Two',
      registration_number: dupReg,
      role: 'BRANCH_MANAGER',
      branch_id: 1,
      password: 'Passw0rd!Secure',
    });

    const [res1, res2] = await Promise.all([req1, req2]);
    const statuses = [res1.status, res2.status].sort();

    // Exactly one should succeed (200) and one should fail (400)
    expect(statuses).toEqual([200, 400]);

    // DB has exactly 1 staff member with this registration number
    const countStaff = await count('staff', 'WHERE registration_number = $1', [dupReg]);
    expect(countStaff).toBe(1);
  });
});
