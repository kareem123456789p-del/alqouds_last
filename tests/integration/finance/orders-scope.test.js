'use strict';
/**
 * Worker C — Wholesale Orders Branch Isolation (Golden Rule 1)
 *
 * Covers:
 * - Branch isolation on GET /api/orders (C-BUG-3)
 * - Cross-branch access on /:id/items (C-BUG-3)
 * - Cross-branch mutation on dispatch/cancel/return (C-BUG-3)
 */

const { loginAs } = require('../../helpers/auth');
const { resetDatabase, q, one } = require('../../helpers/db');

beforeEach(async () => {
  await resetDatabase();
});

describe('Orders Branch Isolation (Golden Rule 1)', () => {
  let branch2OrderId;

  beforeEach(async () => {
    // Create an order in branch 2
    const emp2 = await loginAs('emp2');
    const res = await emp2.post('/api/orders').send({
      client_id: 'doc-4', // doctor 4 belongs to branch 2
      warehouse_id: 3,    // warehouse 3 belongs to branch 2
      items: [{ product_id: 1, warehouse_id: 3, qty: 1, unit_price: 20.0, base_price: 10.0 }],
    });
    branch2OrderId = res.body.order_id;
  });

  test.failing('GET /api/orders is strictly scoped to the caller branch @known-bug C-BUG-3', async () => {
    const emp1 = await loginAs('emp1');
    const res = await emp1.get('/api/orders');
    expect(res.status).toBe(200);

    // Branch 1 employee must NOT see the branch 2 order
    const orderIds = res.body.orders.map((o) => o.id);
    expect(orderIds).not.toContain(branch2OrderId);
  });

  test.failing('GET /api/orders/:id/items rejects accessing order from another branch with 404 @known-bug C-BUG-3', async () => {
    const emp1 = await loginAs('emp1');
    const res = await emp1.get(`/api/orders/${branch2OrderId}/items`);
    expect(res.status).toBe(404);
  });

  test.failing('PUT /api/orders/:id/cancel rejects cancelling an order from another branch @known-bug C-BUG-3', async () => {
    const emp1 = await loginAs('emp1');
    const res = await emp1.put(`/api/orders/${branch2OrderId}/cancel`);
    expect([403, 404]).toContain(res.status);

    // Verify order in branch 2 remained Pending
    const order = await one('SELECT status FROM orders WHERE id = $1', [branch2OrderId]);
    expect(order.status).toBe('Pending');
  });

  test.failing('PUT /api/orders/:id/dispatch rejects dispatching an order from another branch @known-bug C-BUG-3', async () => {
    const emp1 = await loginAs('emp1');
    const res = await emp1.put(`/api/orders/${branch2OrderId}/dispatch`);
    expect([403, 404]).toContain(res.status);

    const order = await one('SELECT status FROM orders WHERE id = $1', [branch2OrderId]);
    expect(order.status).toBe('Pending');
  });
});
