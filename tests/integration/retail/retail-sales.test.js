'use strict';
/**
 * Worker D — POS / Retail domain tests: product search, sale recording,
 * sale invoice lookup, shift report, admin price repair.
 *
 * Assigned routes covered here:
 *   GET  /api/retail/products/search
 *   POST /api/retail/sales
 *   GET  /api/retail/sales/:id
 *   GET  /api/retail/shifts/:id/report
 *   GET  /api/retail/admin/zero-cost-products
 *   POST /api/retail/admin/fix-price
 */

const { resetDatabase, q, one, scalar, count, stockSum, warehouseStock, productRow, clientLedgerSum, clientDebt, supplierBalance } = require('../../helpers/db');
const { anon, loginAs, loginAsRole, clearSessions } = require('../../helpers/auth');

beforeEach(async () => {
  await resetDatabase();
});

afterAll(() => {
  clearSessions();
});

describe('GET /api/retail/products/search', () => {
  test('unauthenticated caller receives 401', async () => {
    const res = await anon().get('/api/retail/products/search?q=para');
    expect(res.status).toBe(401);
  });

  test('returns branch stock with nearest expiry for a known query', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/retail/products/search?q=Para&warehouse_id=1');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toContain('Paracetamol');
    expect(Number(res.body[0].total_stock)).toBe(60);
    expect(typeof res.body[0].nearest_expiry).toBe('string');
    expect(res.body[0].purchase_price).toBeDefined();
  });

  test('branch-2 warehouse id is not leaked to branch-1 staff', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/retail/products/search?q=Para&warehouse_id=3');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(Number(res.body[0].total_stock)).toBe(0);
    expect(res.body[0].nearest_expiry).toBeNull();
  });

  test('branch-2 staff cannot see branch-1 stock either', async () => {
    const emp = await loginAs('emp2');
    const res = await emp.get('/api/retail/products/search?q=Para&warehouse_id=1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(Number(res.body[0].total_stock)).toBe(0);
    expect(res.body[0].nearest_expiry).toBeNull();
  });
});

describe('POST /api/retail/sales', () => {
  test('unauthenticated caller receives 401', async () => {
    const res = await anon().post('/api/retail/sales').send({ warehouse_id: 1, items: [{ product_id: 1, qty: 3, unit_price: 5 }] });
    expect(res.status).toBe(401);
  });

  test('POST /api/retail/sales requires an open shift, no shift -> 400, no stock movement @known-bug D-BUG-10', async () => {
    const pos = await loginAs('pos1');
    const res = await pos.post('/api/retail/sales').send({ warehouse_id: 1, items: [{ product_id: 1, qty: 3, unit_price: 5 }] });
    expect(res.status).toBe(400);
    expect(await count('retail_sales')).toBe(0);
    expect(await stockSum(1, 1)).toBe(60);
  });

  test('records a valid sale with FEFO deduction and honest accounting', async () => {
    const pos = await loginAs('pos1');
    const opened = await pos.post('/api/retail/shifts/open');
    const shiftId = opened.body.shift_id;

    const res = await pos.post('/api/retail/sales').send({ warehouse_id: 1, items: [{ product_id: 1, qty: 3, unit_price: 5 }] });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const saleId = res.body.sale_id;

    const prod = await productRow(1);
    expect(Number(prod.quantity)).toBe(62);

    const batches = await q(
      'SELECT batch_number, current_stock FROM warehouse_inventory WHERE product_id = 1 AND warehouse_id = 1 ORDER BY expiry_date ASC'
    );
    expect(batches).toHaveLength(3);
    // FEFO: expired batch is consumed first (expiry_date ASC).
    expect(batches[0].batch_number).toBe('B-P1-EXPIRED');
    expect(Number(batches[0].current_stock)).toBe(7);
    expect(Number(batches[1].current_stock)).toBe(20);
    expect(Number(batches[2].current_stock)).toBe(30);

    const sale = await one('SELECT * FROM retail_sales WHERE id = $1', [saleId]);
    expect(Number(sale.total_amount)).toBe(15);
    expect(Number(sale.profit_amount)).toBe(9);
    expect(Number(sale.branch_id)).toBe(1);
    expect(Number(sale.shift_id)).toBe(Number(shiftId));

    const items = await q('SELECT * FROM retail_sale_items WHERE sale_id = $1', [saleId]);
    expect(items).toHaveLength(1);
    expect(Number(items[0].product_id)).toBe(1);
    expect(Number(items[0].qty)).toBe(3);
    expect(Number(items[0].cost_price)).toBe(2);
    expect(Number(items[0].selling_price)).toBe(5);
    expect(Number(items[0].profit_amount)).toBe(9);
    expect(Number(items[0].branch_id)).toBe(1);
    expect(Number(items[0].returned_qty || 0)).toBe(0);
  });

  test('POS sale must use the caller branch open shift, not a global one @known-bug D-BUG-2', async () => {
    const pos1 = await loginAs('pos1');
    const pos2 = await loginAs('pos2');
    const s1 = await pos1.post('/api/retail/shifts/open');
    const s2 = await pos2.post('/api/retail/shifts/open');
    expect(s1.status).toBe(200);
    expect(s2.status).toBe(200);

    const saleRes = await pos1.post('/api/retail/sales').send({ warehouse_id: 1, items: [{ product_id: 1, qty: 1, unit_price: 5 }] });
    expect(saleRes.status).toBe(201);

    const sale = await one('SELECT * FROM retail_sales WHERE id = $1', [saleRes.body.sale_id]);
    expect(Number(sale.shift_id)).toBe(Number(s1.body.shift_id));
  });

  test('POS sale must use the database cost instead of client-supplied cost_price @known-bug D-BUG-4', async () => {
    const pos = await loginAs('pos1');
    const opened = await pos.post('/api/retail/shifts/open');
    const res = await pos.post('/api/retail/sales').send({
      warehouse_id: 1,
      items: [{ product_id: 1, qty: 3, unit_price: 5, cost_price: 99 }],
    });
    expect(res.status).toBe(201);

    const items = await q('SELECT * FROM retail_sale_items WHERE sale_id = $1', [res.body.sale_id]);
    expect(Number(items[0].cost_price)).toBe(2);
    expect(Number(items[0].profit_amount)).toBe(9);
    expect(Number(items[0].selling_price)).toBe(5);
  });

  test('zero-cost POS sale must contribute 0 profit until admin backfills the cost @known-bug D-BUG-12', async () => {
    const pos = await loginAs('pos1');
    const opened = await pos.post('/api/retail/shifts/open');

    const res = await pos.post('/api/retail/sales').send({ warehouse_id: 1, items: [{ product_id: 5, qty: 2, unit_price: 3 }] });
    expect(res.status).toBe(201);

    const items = await q('SELECT * FROM retail_sale_items WHERE sale_id = $1', [res.body.sale_id]);
    expect(Number(items[0].cost_price)).toBe(0);
    expect(Number(items[0].profit_amount)).toBe(0);
  });

  test('POS sale with insufficient stock must return 400 and roll back cleanly @known-bug D-BUG-11', async () => {
    const pos = await loginAs('pos1');
    const opened = await pos.post('/api/retail/shifts/open');

    const res = await pos.post('/api/retail/sales').send({
      warehouse_id: 1,
      items: [{ product_id: 3, qty: 99, unit_price: 150 }],
    });
    expect(res.status).toBe(400);
    expect(await count('retail_sales')).toBe(0);
    expect(await stockSum(3)).toBe(8);
  });
});

describe('GET /api/retail/sales/:id', () => {
  test('unauthenticated caller receives 401', async () => {
    const res = await anon().get('/api/retail/sales/1');
    expect(res.status).toBe(401);
  });

  test('returns the sale with its line items', async () => {
    const pos = await loginAs('pos1');
    const opened = await pos.post('/api/retail/shifts/open');
    const saleRes = await pos.post('/api/retail/sales').send({ warehouse_id: 1, items: [{ product_id: 1, qty: 3, unit_price: 5 }] });
    const res = await pos.get(`/api/retail/sales/${saleRes.body.sale_id}`);
    expect(res.status).toBe(200);
    expect(Number(res.body.sale.total_amount)).toBe(15);
    expect(res.body.items).toHaveLength(1);
    expect(Number(res.body.items[0].qty)).toBe(3);
    expect(Number(res.body.items[0].cost_price)).toBe(2);
  });

  test('GET /api/retail/sales/:id must 404 a sale from another branch @known-bug D-BUG-3', async () => {
    const pos2 = await loginAs('pos2');
    const opened2 = await pos2.post('/api/retail/shifts/open');
    const saleRes = await pos2.post('/api/retail/sales').send({ warehouse_id: 3, items: [{ product_id: 1, qty: 2, unit_price: 5 }] });
    expect(saleRes.status).toBe(201);

    const emp1 = await loginAs('emp1');
    const res = await emp1.get(`/api/retail/sales/${saleRes.body.sale_id}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/retail/shifts/:id/report', () => {
  test('shift report totals match the recorded sale rows', async () => {
    const pos = await loginAs('pos1');
    const opened = await pos.post('/api/retail/shifts/open');
    const saleRes = await pos.post('/api/retail/sales').send({ warehouse_id: 1, items: [{ product_id: 1, qty: 3, unit_price: 5 }] });

    const res = await pos.get(`/api/retail/shifts/${opened.body.shift_id}/report`);
    expect(res.status).toBe(200);
    expect(res.body.sales_count).toBe(1);
    expect(Number(res.body.total_revenue)).toBe(15);
    expect(Number(res.body.total_profit)).toBe(9);
    expect(res.body.items).toHaveLength(1);
    expect(Number(res.body.items[0].cost_price)).toBe(2);
    expect(res.body.items[0].cost_missing).toBe(false);
    expect(Number(res.body.items[0].line_total)).toBe(15);
  });
});

describe('admin price repair', () => {
  test('admin lists zero-cost products', async () => {
    const admin = await loginAs('admin');
    const res = await admin.get('/api/retail/admin/zero-cost-products');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].id).toBe(5);
  });

  test('admin fix-price updates product cost and backfills historical sales', async () => {
    const pos = await loginAs('pos1');
    const opened = await pos.post('/api/retail/shifts/open');
    const saleRes = await pos.post('/api/retail/sales').send({ warehouse_id: 1, items: [{ product_id: 5, qty: 2, unit_price: 3 }] });

    const admin = await loginAs('admin');
    const fix = await admin.post('/api/retail/admin/fix-price').send({ product_id: 5, purchase_price: 2 });
    expect(fix.status).toBe(200);
    expect(fix.body.success).toBe(true);
    expect(fix.body.message).toContain('Backfilled 1');

    const prod = await productRow(5);
    expect(Number(prod.purchase_price)).toBe(2);

    const items = await q('SELECT * FROM retail_sale_items WHERE sale_id = $1', [saleRes.body.sale_id]);
    expect(Number(items[0].cost_price)).toBe(2);
  });

  test('admin fix-price validates input', async () => {
    const admin = await loginAs('admin');
    const res = await admin.post('/api/retail/admin/fix-price').send({ product_id: 5, purchase_price: 0 });
    expect(res.status).toBe(400);
    const res2 = await admin.post('/api/retail/admin/fix-price').send({ product_id: 5 });
    expect(res2.status).toBe(400);
  });

  test('admin zero-cost routes must reject non-admin callers @known-bug D-BUG-5', async () => {
    const emp = await loginAs('pos1');
    const list = await emp.get('/api/retail/admin/zero-cost-products');
    expect(list.status).toBe(403);

    const fix = await emp.post('/api/retail/admin/fix-price').send({ product_id: 5, purchase_price: 2 });
    expect(fix.status).toBe(403);
  });
});
