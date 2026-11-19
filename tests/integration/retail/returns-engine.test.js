'use strict';
/**
 * Worker D — Unified returns engine tests (readme §8.5).
 *
 * Assigned routes covered here:
 *   GET /api/returns/history
 *   GET /api/returns/invoices-tree
 *   GET /api/returns/invoice/:id
 *   POST /api/returns/process
 */

const { resetDatabase, q, one, scalar, count, stockSum, warehouseStock, productRow, clientLedgerSum, clientDebt, supplierBalance } = require('../../helpers/db');
const { anon, loginAs, loginAsRole, clearSessions } = require('../../helpers/auth');

beforeEach(async () => {
  await resetDatabase();
});

afterAll(() => {
  clearSessions();
});

describe('GET /api/returns/history', () => {
  test('unauthenticated caller receives 401', async () => {
    const res = await anon().get('/api/returns/history');
    expect(res.status).toBe(401);
  });

  test('empty history for a branch with no processed returns', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/returns/history');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.returns)).toBe(true);
    expect(res.body.returns).toHaveLength(0);
  });

  test('reflects processed returns for the branch', async () => {
    const pos = await loginAs('pos1');
    const opened = await pos.post('/api/retail/shifts/open');
    const saleRes = await pos.post('/api/retail/sales').send({ warehouse_id: 1, items: [{ product_id: 1, qty: 3, unit_price: 5 }] });
    const saleId = saleRes.body.sale_id;

    const proc = await pos.post('/api/returns/process').send({
      original_invoice_id: String(saleId),
      items: [{ product_id: 1, return_qty: 2 }],
    });
    expect(proc.status).toBe(200);

    const emp = await loginAs('emp1');
    const res = await emp.get('/api/returns/history');
    expect(res.status).toBe(200);
    expect(res.body.returns).toHaveLength(1);
    expect(res.body.returns[0].retail_sale_id).toBe(saleId);
    expect(Number(res.body.returns[0].items_count)).toBe(1);
    expect(res.body.returns[0].branch_id).toBe(1);
  });
});

describe('GET /api/returns/invoices-tree', () => {
  test('unauthenticated caller receives 401', async () => {
    const res = await anon().get('/api/returns/invoices-tree');
    expect(res.status).toBe(401);
  });

  test('groups completed retail invoices by month -> day -> invoice', async () => {
    const pos = await loginAs('pos1');
    const opened = await pos.post('/api/retail/shifts/open');
    const saleRes = await pos.post('/api/retail/sales').send({ warehouse_id: 1, items: [{ product_id: 1, qty: 3, unit_price: 5 }] });
    const saleId = saleRes.body.sale_id;

    const emp = await loginAs('emp1');
    const res = await emp.get('/api/returns/invoices-tree');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.branch_id).toBe(1);
    expect(res.body.total_invoices_count).toBe(1);

    expect(res.body.tree).toHaveLength(1);
    expect(res.body.tree[0].days).toHaveLength(1);
    expect(res.body.tree[0].days[0].invoices).toHaveLength(1);

    const inv = res.body.tree[0].days[0].invoices[0];
    expect(inv.invoice_type).toBe('retail');
    expect(inv.order_number).toBe(`#RET-${saleId}`);
    expect(inv.branch_id).toBe(1);
    expect(inv.items).toHaveLength(1);
    expect(inv.items[0].returnable_qty).toBe(3);
    expect(Number(inv.total_amount)).toBe(15);
  });

  test('branch-scoped tree does not leak other branches invoices', async () => {
    const pos2 = await loginAs('pos2');
    const opened2 = await pos2.post('/api/retail/shifts/open');
    const saleRes = await pos2.post('/api/retail/sales').send({ warehouse_id: 3, items: [{ product_id: 1, qty: 2, unit_price: 5 }] });
    const saleId = saleRes.body.sale_id;

    const emp1 = await loginAs('emp1');
    const res = await emp1.get('/api/returns/invoices-tree');
    expect(res.status).toBe(200);
    expect(res.body.branch_id).toBe(1);
    expect(res.body.total_invoices_count).toBe(0);
  });
});

describe('GET /api/returns/invoice/:id', () => {
  test('unauthenticated caller receives 401', async () => {
    const res = await anon().get('/api/returns/invoice/1');
    expect(res.status).toBe(401);
  });

  test('resolves a retail sale invoice with returnable qty', async () => {
    const pos = await loginAs('pos1');
    const opened = await pos.post('/api/retail/shifts/open');
    const saleRes = await pos.post('/api/retail/sales').send({ warehouse_id: 1, items: [{ product_id: 1, qty: 3, unit_price: 5 }] });
    const saleId = saleRes.body.sale_id;

    const emp = await loginAs('emp1');
    const res = await emp.get(`/api/returns/invoice/${saleId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.invoice_type).toBe('retail');
    expect(res.body.invoice.id).toBe(saleId);
    expect(res.body.invoice.items[0].returnable_qty).toBe(3);
  });

  test('rejects a branch-2 retail invoice for a branch-1 caller', async () => {
    const pos2 = await loginAs('pos2');
    const opened2 = await pos2.post('/api/retail/shifts/open');
    const saleRes = await pos2.post('/api/retail/sales').send({ warehouse_id: 3, items: [{ product_id: 1, qty: 2, unit_price: 5 }] });
    const saleId = saleRes.body.sale_id;

    const emp1 = await loginAs('emp1');
    const res = await emp1.get(`/api/returns/invoice/${saleId}`);
    expect(res.status).toBe(403);
  });

  test('returns 404 for an unknown invoice', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/returns/invoice/424242');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/returns/process (retail invoice)', () => {
  test('over-return is rejected and moves nothing', async () => {
    const pos = await loginAs('pos1');
    const opened = await pos.post('/api/retail/shifts/open');
    const saleRes = await pos.post('/api/retail/sales').send({ warehouse_id: 1, items: [{ product_id: 1, qty: 3, unit_price: 5 }] });
    const saleId = saleRes.body.sale_id;
    const stockAfterSale = await stockSum(1, 1);

    const res = await pos.post('/api/returns/process').send({
      original_invoice_id: String(saleId),
      items: [{ product_id: 1, return_qty: 4 }],
    });
    expect(res.status).toBe(400);
    expect(await stockSum(1, 1)).toBe(stockAfterSale);
  });

  test('valid partial retail return restores stock and marks the line returned', async () => {
    const pos = await loginAs('pos1');
    const opened = await pos.post('/api/retail/shifts/open');
    const saleRes = await pos.post('/api/retail/sales').send({ warehouse_id: 1, items: [{ product_id: 1, qty: 3, unit_price: 5 }] });
    const saleId = saleRes.body.sale_id;

    const proc = await pos.post('/api/returns/process').send({
      original_invoice_id: String(saleId),
      items: [{ product_id: 1, return_qty: 2 }],
    });
    expect(proc.status).toBe(200);
    expect(proc.body.success).toBe(true);

    const items = await q('SELECT * FROM retail_sale_items WHERE sale_id = $1', [saleId]);
    expect(Number(items[0].returned_qty)).toBe(2);

    const products = await productRow(1);
    expect(Number(products.quantity)).toBe(65 - 3 + 2);
  });
});

describe('POST /api/returns/process (wholesale order invoice)', () => {
  test('full wholesale return marks the order Returned and writes the RETURN ledger', async () => {
    const emp = await loginAs('admin');

    const orderRes = await emp.post('/api/orders').send({
      client_id: 'doc-1',
      warehouse_id: 1,
      expected_delivery: '2026-12-01',
      items: [{ product_id: 1, qty: 2, unit_price: 5, base_price: 2 }],
    });
    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.order_id;
    const orderNumber = orderRes.body.order_number;

    const dispatch = await emp.put(`/api/orders/${orderId}/dispatch`);
    expect(dispatch.status).toBe(200);

    const order = await one('SELECT * FROM orders WHERE id = $1', [orderId]);
    expect(order.status).toBe('Dispatched');

    const proc = await emp.post('/api/returns/process').send({
      original_invoice_id: orderNumber,
      items: [{ product_id: 1, return_qty: 2 }],
    });
    expect(proc.status).toBe(200);
    expect(proc.body.success).toBe(true);

    const orderAfter = await one('SELECT * FROM orders WHERE id = $1', [orderId]);
    expect(orderAfter.status).toBe('Returned');

    const items = await q('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
    expect(Number(items[0].returned_qty)).toBe(2);

    const debt = await one('SELECT total_debt FROM doctors WHERE id = 1');
    expect(Number(debt.total_debt)).toBe(0);
  });

  test('over-return on a wholesale order is rejected', async () => {
    const emp = await loginAs('admin');
    const orderRes = await emp.post('/api/orders').send({
      client_id: 'doc-1',
      warehouse_id: 1,
      expected_delivery: '2026-12-01',
      items: [{ product_id: 1, qty: 2, unit_price: 5, base_price: 2 }],
    });
    const orderId = orderRes.body.order_id;
    const dispatch = await emp.put(`/api/orders/${orderId}/dispatch`);
    expect(dispatch.status).toBe(200);

    const itemsBefore = await q('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
    const stockBefore = await stockSum(1, 1);

    const proc = await emp.post('/api/returns/process').send({
      original_invoice_id: orderRes.body.order_number,
      items: [{ product_id: 1, return_qty: 3 }],
    });
    expect(proc.status).toBe(400);

    const itemsAfter = await q('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
    expect(Number(itemsAfter[0].returned_qty)).toBe(0);
    expect(await stockSum(1, 1)).toBe(stockBefore);
  });
});
