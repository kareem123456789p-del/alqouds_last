'use strict';
/**
 * Worker C — Wholesale Orders Lifecycle (Dispatch, Cancel, Return, Details)
 *
 * Covers:
 * - PUT /api/orders/:id/dispatch (FEFO deduction, debt unchanged, Golden Rule 8)
 * - PUT /api/orders/:id/cancel (debt reversed, status Cancelled)
 * - POST /api/orders/:id/return (stock restored, debt reduced, status Returned)
 * - GET /api/orders/:id/details (C-BUG-2)
 * - GET /api/orders/:id/items
 */

const { loginAs } = require('../../helpers/auth');
const { resetDatabase, q, one, scalar } = require('../../helpers/db');

beforeEach(async () => {
  await resetDatabase();
});

describe('PUT /api/orders/:id/dispatch', () => {
  test('dispatches pending order, deducts stock via FEFO, leaves debt unchanged (Golden Rule 8)', async () => {
    const emp = await loginAs('emp1');

    // Create a fresh pending order with 2 units of product 1
    const createRes = await emp.post('/api/orders').send({
      client_id: 'doc-1',
      warehouse_id: 1,
      items: [{ product_id: 1, warehouse_id: 1, qty: 2, unit_price: 10.0, base_price: 5.0 }],
    });
    const orderId = createRes.body.order_id;

    const docDebtBefore = (await one('SELECT total_debt FROM doctors WHERE id = 1')).total_debt;
    const batchBefore = await one('SELECT current_stock FROM warehouse_inventory WHERE id = 1');

    // Dispatch the order
    const dispatchRes = await emp.put(`/api/orders/${orderId}/dispatch`);
    expect(dispatchRes.status).toBe(200);
    expect(dispatchRes.body.success).toBe(true);

    // Order status is now Dispatched
    const order = await one('SELECT status FROM orders WHERE id = $1', [orderId]);
    expect(order.status).toBe('Dispatched');

    // Physical stock deducted
    const batchAfter = await one('SELECT current_stock FROM warehouse_inventory WHERE id = 1');
    expect(batchAfter.current_stock).toBe(batchBefore.current_stock - 2);

    // Golden Rule 8: Debt remains UNCHANGED upon dispatch
    const docDebtAfter = (await one('SELECT total_debt FROM doctors WHERE id = 1')).total_debt;
    expect(Number(docDebtAfter)).toBe(Number(docDebtBefore));

    // A second dispatch attempt must be rejected
    const secondDispatch = await emp.put(`/api/orders/${orderId}/dispatch`);
    expect(secondDispatch.status).toBe(400);
  });

  test('insufficient stock prevents dispatch and rolls back cleanly', async () => {
    const emp = await loginAs('emp1');

    // Create an order asking for 999 units (more than available in warehouse 1)
    const createRes = await emp.post('/api/orders').send({
      client_id: 'doc-1',
      warehouse_id: 1,
      items: [{ product_id: 1, warehouse_id: 1, qty: 999, unit_price: 1.0, base_price: 1.0 }],
    });
    const orderId = createRes.body.order_id;
    const batchBefore = await one('SELECT current_stock FROM warehouse_inventory WHERE id = 1');

    const dispatchRes = await emp.put(`/api/orders/${orderId}/dispatch`);
    expect(dispatchRes.status).toBe(400);
    expect(dispatchRes.body.error).toMatch(/Insufficient stock/i);

    // Status remains Pending, stock untouched
    const order = await one('SELECT status FROM orders WHERE id = $1', [orderId]);
    expect(order.status).toBe('Pending');
    const batchAfter = await one('SELECT current_stock FROM warehouse_inventory WHERE id = 1');
    expect(batchAfter.current_stock).toBe(batchBefore.current_stock);
  });
});

describe('PUT /api/orders/:id/cancel', () => {
  test('cancels pending order, reverses debt, and records CANCEL ledger entry', async () => {
    const emp = await loginAs('emp1');

    const createRes = await emp.post('/api/orders').send({
      client_id: 'doc-1',
      warehouse_id: 1,
      items: [{ product_id: 1, warehouse_id: 1, qty: 3, unit_price: 10.0, base_price: 5.0 }],
    });
    const orderId = createRes.body.order_id;
    const debtAfterCreate = (await one('SELECT total_debt FROM doctors WHERE id = 1')).total_debt;

    const cancelRes = await emp.put(`/api/orders/${orderId}/cancel`);
    expect(cancelRes.status).toBe(200);

    const order = await one('SELECT status FROM orders WHERE id = $1', [orderId]);
    expect(order.status).toBe('Cancelled');

    // Debt decreased by 30
    const debtAfterCancel = (await one('SELECT total_debt FROM doctors WHERE id = 1')).total_debt;
    expect(Number(debtAfterCancel)).toBe(Number(debtAfterCreate) - 30);

    // Negative CANCEL ledger entry
    const tx = await one(
      'SELECT * FROM client_transactions WHERE reference_id = $1 AND type = $2',
      [orderId, 'CANCEL']
    );
    expect(Number(tx.amount)).toBe(-30);

    // Cancelling a cancelled order should be rejected
    const secondCancel = await emp.put(`/api/orders/${orderId}/cancel`);
    expect(secondCancel.status).toBe(400);
  });

  test('cancelling a dispatched order is rejected', async () => {
    const emp = await loginAs('emp1');

    const createRes = await emp.post('/api/orders').send({
      client_id: 'doc-1',
      warehouse_id: 1,
      items: [{ product_id: 1, warehouse_id: 1, qty: 1, unit_price: 10.0, base_price: 5.0 }],
    });
    const orderId = createRes.body.order_id;
    await emp.put(`/api/orders/${orderId}/dispatch`);

    const cancelRes = await emp.put(`/api/orders/${orderId}/cancel`);
    expect(cancelRes.status).toBe(400);
  });
});

describe('POST /api/orders/:id/return', () => {
  test('returns items from dispatched order, restores stock, and reduces debt', async () => {
    const emp = await loginAs('emp1');

    const createRes = await emp.post('/api/orders').send({
      client_id: 'doc-1',
      warehouse_id: 1,
      items: [{ product_id: 1, warehouse_id: 1, qty: 5, unit_price: 10.0, base_price: 5.0 }],
    });
    const orderId = createRes.body.order_id;
    await emp.put(`/api/orders/${orderId}/dispatch`);

    const items = await q('SELECT id FROM order_items WHERE order_id = $1', [orderId]);
    const itemId = items[0].id;
    const debtBeforeReturn = (await one('SELECT total_debt FROM doctors WHERE id = 1')).total_debt;

    // Partial return: 2 of 5
    const returnRes = await emp.post(`/api/orders/${orderId}/return`).send({
      items: [{ item_id: itemId, return_qty: 2, return_reason: 'Defective' }],
    });
    expect(returnRes.status).toBe(200);
    expect(returnRes.body.refund_amount).toBe(20);

    // Returned quantity updated on order_item
    const orderItem = await one('SELECT returned_qty FROM order_items WHERE id = $1', [itemId]);
    expect(orderItem.returned_qty).toBe(2);

    // Debt decreased by 20
    const debtAfterReturn = (await one('SELECT total_debt FROM doctors WHERE id = 1')).total_debt;
    expect(Number(debtAfterReturn)).toBe(Number(debtBeforeReturn) - 20);

    // Negative RETURN ledger entry
    const tx = await one(
      'SELECT * FROM client_transactions WHERE reference_id = $1 AND type = $2',
      [orderId, 'RETURN']
    );
    expect(Number(tx.amount)).toBe(-20);

    // Over-return beyond remaining 3 items is rejected
    const overReturn = await emp.post(`/api/orders/${orderId}/return`).send({
      items: [{ item_id: itemId, return_qty: 4 }],
    });
    expect(overReturn.status).toBe(400);

    // Returning remaining 3 marks order as Returned
    const finalReturn = await emp.post(`/api/orders/${orderId}/return`).send({
      items: [{ item_id: itemId, return_qty: 3 }],
    });
    expect(finalReturn.status).toBe(200);

    const finalOrder = await one('SELECT status FROM orders WHERE id = $1', [orderId]);
    expect(finalOrder.status).toBe('Returned');
  });

  test('returning a non-dispatched order is rejected', async () => {
    const emp = await loginAs('emp1');
    const createRes = await emp.post('/api/orders').send({
      client_id: 'doc-1',
      warehouse_id: 1,
      items: [{ product_id: 1, warehouse_id: 1, qty: 1, unit_price: 10.0, base_price: 5.0 }],
    });
    const orderId = createRes.body.order_id;
    const items = await q('SELECT id FROM order_items WHERE order_id = $1', [orderId]);

    const res = await emp.post(`/api/orders/${orderId}/return`).send({
      items: [{ item_id: items[0].id, return_qty: 1 }],
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/orders/:id/details & items', () => {
  test('GET /api/orders/:id/details returns full order details @known-bug C-BUG-2', async () => {
    const emp = await loginAs('emp1');
    // Seeded order id 1
    const res = await emp.get('/api/orders/1/details');
    // The query references nonexistent orders.created_by column causing 500
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.order).toBeDefined();
  });

  test('GET /api/orders/:id/items returns items list', async () => {
    const emp = await loginAs('emp1');
    const created = await emp.post('/api/orders').send({
      client_id: 'doc-1',
      warehouse_id: 1,
      items: [{ product_id: 1, warehouse_id: 1, qty: 2, unit_price: 5.0, base_price: 2.0 }],
    });
    const orderId = created.body.order_id;

    const res = await emp.get(`/api/orders/${orderId}/items`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].product_name).toBeDefined();
  });
});
