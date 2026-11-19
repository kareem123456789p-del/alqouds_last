'use strict';
/**
 * Worker C — Wholesale Orders Creation & Pricing
 *
 * Covers:
 * - POST /api/orders (creation, immediate debt recording, Golden Rule 8)
 * - Credit limit enforcement and boundary conditions
 * - GET /api/orders/clients (C-BUG-1)
 * - GET /api/orders/product/:id/cost-price
 * - GET /api/orders/history/:clientType/:clientId (C-BUG-10)
 * - Connection leak on early return (C-BUG-4)
 */

const { loginAs } = require('../../helpers/auth');
const { resetDatabase, q, one, scalar, openTransactionCount } = require('../../helpers/db');

beforeEach(async () => {
  await resetDatabase();
});

describe('POST /api/orders — Order Creation & Customer Debt', () => {
  test('creates an order for a doctor, updates debt immediately, and leaves stock unchanged', async () => {
    const emp = await loginAs('emp1');
    const docBefore = await one('SELECT total_debt FROM doctors WHERE id = 1');
    const stockBefore = await scalar(
      'SELECT current_stock FROM warehouse_inventory WHERE warehouse_id = 1 AND product_id = 1 AND id = 1'
    );

    const payload = {
      client_id: 'doc-1',
      warehouse_id: 1,
      expected_delivery: '2026-12-01',
      items: [
        { product_id: 1, warehouse_id: 1, qty: 2, unit_price: 5.0, base_price: 2.0, profit_margin: 3.0 },
      ],
    };

    const res = await emp.post('/api/orders').send(payload);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.order_id).toBeDefined();
    expect(Number(res.body.total_amount)).toBe(10);

    // Verify order in database
    const order = await one('SELECT * FROM orders WHERE id = $1', [res.body.order_id]);
    expect(order.status).toBe('Pending');
    expect(order.branch_id).toBe(1);
    expect(Number(order.total_amount)).toBe(10);
    expect(order.client_id).toBe(1);

    // Verify order_items
    const items = await q('SELECT * FROM order_items WHERE order_id = $1', [res.body.order_id]);
    expect(items).toHaveLength(1);
    expect(items[0].product_id).toBe(1);
    expect(items[0].qty).toBe(2);
    expect(Number(items[0].subtotal)).toBe(10);

    // Golden Rule 8: Debt charged ONCE immediately upon creation
    const docAfter = await one('SELECT total_debt FROM doctors WHERE id = 1');
    expect(Number(docAfter.total_debt)).toBe(Number(docBefore.total_debt) + 10);

    // client_transactions ledger entry
    const tx = await one(
      'SELECT * FROM client_transactions WHERE reference_id = $1 AND type = $2',
      [res.body.order_id, 'ORDER']
    );
    expect(tx.client_id).toBe(1);
    expect(Number(tx.amount)).toBe(10);
    expect(tx.branch_id).toBe(1);

    // Physical stock is UNCHANGED until dispatch
    const stockAfter = await scalar(
      'SELECT current_stock FROM warehouse_inventory WHERE warehouse_id = 1 AND product_id = 1 AND id = 1'
    );
    expect(stockAfter).toBe(stockBefore);
  });

  test('creates an order for a pharmacy and records debt in pharmacy ledger', async () => {
    const emp = await loginAs('emp1');
    const pharmBefore = await one('SELECT total_debt FROM pharmacies WHERE id = 1');

    const payload = {
      client_id: 'pharm-1',
      warehouse_id: 1,
      items: [
        { product_id: 1, warehouse_id: 1, qty: 1, unit_price: 15.0, base_price: 10.0, profit_margin: 5.0 },
      ],
    };

    const res = await emp.post('/api/orders').send(payload);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const pharmAfter = await one('SELECT total_debt FROM pharmacies WHERE id = 1');
    expect(Number(pharmAfter.total_debt)).toBe(Number(pharmBefore.total_debt) + 15);

    const tx = await one(
      'SELECT * FROM client_transactions WHERE reference_id = $1 AND type = $2',
      [res.body.order_id, 'ORDER']
    );
    expect(tx.pharmacy_id).toBe(1);
    expect(Number(tx.amount)).toBe(15);
  });

  test('rejects order when client exceeds credit limit', async () => {
    const emp = await loginAs('emp1');
    // Doctor 3 is seeded with credit_limit: 60000 and total_debt: 60000
    const payload = {
      client_id: 'doc-3',
      warehouse_id: 1,
      items: [
        { product_id: 1, warehouse_id: 1, qty: 1, unit_price: 5.0, base_price: 2.0 },
      ],
    };

    const res = await emp.post('/api/orders').send(payload);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Credit Limit Exceeded/i);

    // Verify no order created and debt untouched
    const count = await scalar('SELECT COUNT(*) FROM orders WHERE client_id = 3');
    expect(Number(count)).toBe(0);
  });

  test('rejects request with missing required fields', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.post('/api/orders').send({ client_id: 'doc-1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  test('rejects request for nonexistent client with 404', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.post('/api/orders').send({
      client_id: 'doc-9999',
      warehouse_id: 1,
      items: [{ product_id: 1, qty: 1, unit_price: 10 }],
    });
    expect(res.status).toBe(404);
  });

  test.failing('createOrder releases DB connection cleanly on validation early-return @known-bug C-BUG-4', async () => {
    const emp = await loginAs('emp1');
    const initialIdle = await openTransactionCount();

    // Trigger early return before beginTransaction is rolled back/released
    await emp.post('/api/orders').send({});

    const afterIdle = await openTransactionCount();
    // A clean controller must have 0 leaked open transactions
    expect(afterIdle).toBe(initialIdle);
  });
});

describe('GET /api/orders/clients', () => {
  test.failing('returns combined list of clients (doctors and pharmacies) @known-bug C-BUG-1', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/orders/clients');
    // Code queries nonexistent `clients` table causing 500
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/orders/product/:id/cost-price', () => {
  test('returns product cost and selling price', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/orders/product/1/cost-price');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      product_id: 1,
      name: 'Paracetamol 500mg',
      cost_price: 2.0,
      selling_price: 5.0,
    });
  });

  test('returns 404 for unknown product id', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/orders/product/9999/cost-price');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/orders/history/:clientType/:clientId', () => {
  test('returns order history for a doctor', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/orders/history/doctor/1');
    expect(res.status).toBe(200);
    expect(res.body.total_transactions_count).toBeDefined();
    expect(Array.isArray(res.body.monthGroups)).toBe(true);
  });

  test('returns order history for a pharmacy', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/orders/history/pharmacy/1');
    expect(res.status).toBe(200);
    expect(res.body.total_transactions_count).toBeDefined();
    expect(Array.isArray(res.body.monthGroups)).toBe(true);
  });

  test('rejects invalid clientType with 400', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/orders/history/hospital/1');
    expect(res.status).toBe(400);
  });

  test.failing('getClientHistory calculates outstanding balance from client total_debt @known-bug C-BUG-10', async () => {
    const emp = await loginAs('emp1');
    // Simulate a debt payment having reduced doctor total_debt
    await q('UPDATE doctors SET total_debt = total_debt - 500 WHERE id = 1');

    const res = await emp.get('/api/orders/history/doctor/1');
    expect(res.status).toBe(200);

    const doc = await one('SELECT total_debt FROM doctors WHERE id = 1');
    // Outstanding balance in history should match client's actual total_debt, not sum of all orders
    expect(Number(res.body.total_outstanding_balance)).toBe(Number(doc.total_debt));
  });
});
