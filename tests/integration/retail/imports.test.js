'use strict';
/**
 * Worker D — Inbound supply shipment (import) tests: listing, creation,
 * supplier return against an import log.
 *
 * Assigned routes covered here:
 *   GET  /api/imports
 *   POST /api/imports
 *   POST /api/imports/:id/return
 *   GET  /api/imports/suppliers
 *   GET  /api/imports/warehouse-stock
 */

const { resetDatabase, q, one, scalar, count, stockSum, warehouseStock, productRow, clientLedgerSum, clientDebt, supplierBalance } = require('../../helpers/db');
const { anon, loginAs, loginAsRole, clearSessions } = require('../../helpers/auth');
const { isoDate } = require('../../helpers/seed');

beforeEach(async () => {
  await resetDatabase();
});

afterAll(() => {
  clearSessions();
});

describe('GET /api/imports', () => {
  test('unauthenticated caller receives 401', async () => {
    const res = await anon().get('/api/imports');
    expect(res.status).toBe(401);
  });

  test('returns an empty branch-scoped import log for a clean database', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/imports');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });
});

describe('GET /api/imports/suppliers', () => {
  test('unauthenticated caller receives 401', async () => {
    const res = await anon().get('/api/imports/suppliers');
    expect(res.status).toBe(401);
  });

  test('returns only the caller branch suppliers', async () => {
    const emp1 = await loginAs('emp1');
    const r1 = await emp1.get('/api/imports/suppliers');
    expect(r1.status).toBe(200);
    expect(r1.body).toHaveLength(2);

    const emp2 = await loginAs('emp2');
    const r2 = await emp2.get('/api/imports/suppliers');
    expect(r2.status).toBe(200);
    expect(r2.body).toHaveLength(1);
    expect(Number(r2.body[0].id)).toBe(3);
  });
});

describe('GET /api/imports/warehouse-stock', () => {
  test('unauthenticated caller receives 401', async () => {
    const res = await anon().get('/api/imports/warehouse-stock?warehouse_id=1');
    expect(res.status).toBe(401);
  });

  test('requires warehouse_id', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/imports/warehouse-stock');
    expect(res.status).toBe(400);
  });

  test('returns products stock for the branch warehouse', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/imports/warehouse-stock?warehouse_id=1');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

describe('POST /api/imports', () => {
  test('unauthenticated caller receives 401', async () => {
    const res = await anon().post('/api/imports').field('items', JSON.stringify([{ product_id: 1, warehouse_id: 1, supplier_id: 1, quantity: 5, unit_price: 2.5 }]));
    expect(res.status).toBe(401);
  });

  test('empty items are rejected', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.post('/api/imports').field('items', JSON.stringify([]));
    expect(res.status).toBe(400);
  });

  test('creates a shipment, updates stock and charges the supplier', async () => {
    const emp = await loginAs('emp1');
    const items = [{ product_id: 1, warehouse_id: 1, supplier_id: 1, quantity: 5, unit_price: 2.5, batch_number: 'B-P1-NEW', expiry_date: isoDate(30) }];
    const res = await emp.post('/api/imports').field('items', JSON.stringify(items));
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const log = await one('SELECT * FROM import_logs ORDER BY id DESC LIMIT 1');
    expect(log.shipment_id).toMatch(/^SHP-/);
    expect(Number(log.quantity)).toBe(5);
    expect(Number(log.unit_price)).toBe(2.5);
    expect(log.status).toBe('Active');
    expect(Number(log.branch_id)).toBe(1);

    const prod = await productRow(1);
    expect(Number(prod.quantity)).toBe(70);
    expect(Number(prod.purchase_price)).toBe(2.5);
    expect(Number(prod.price)).toBe(2.5);

    const batch = await one(
      'SELECT * FROM warehouse_inventory WHERE product_id = 1 AND warehouse_id = 1 AND batch_number = $1',
      ['B-P1-NEW']
    );
    expect(Number(batch.current_stock)).toBe(5);
    expect(Number(batch.unit_price)).toBe(2.5);

    const tx = await one(
      "SELECT * FROM supplier_transactions WHERE supplier_id = 1 AND transaction_type = 'IMPORT_CHARGE' ORDER BY id DESC LIMIT 1"
    );
    expect(Number(tx.total_amount)).toBe(12.5);
  });

  test('re-import of the same batch merges instead of duplicating', async () => {
    const emp = await loginAs('emp1');
    const mk = (quantity) => emp.post('/api/imports').field('items', JSON.stringify([
      { product_id: 1, warehouse_id: 1, supplier_id: 1, quantity, unit_price: 2.5, batch_number: 'B-P1-NEW', expiry_date: isoDate(30) },
    ]));

    const r1 = await mk(5);
    expect(r1.status).toBe(201);
    const r2 = await mk(3);
    expect(r2.status).toBe(201);

    const batch = await one(
      'SELECT * FROM warehouse_inventory WHERE product_id = 1 AND warehouse_id = 1 AND batch_number = $1',
      ['B-P1-NEW']
    );
    expect(Number(batch.current_stock)).toBe(8);

    const logs = await q('SELECT * FROM import_logs WHERE product_id = 1');
    expect(logs).toHaveLength(2);

    const prod = await productRow(1);
    expect(Number(prod.quantity)).toBe(73);
  });
});

describe('POST /api/imports/:id/return', () => {
  test('unauthenticated caller receives 401', async () => {
    const res = await anon().post('/api/imports/1/return').send({ return_qty: 1 });
    expect(res.status).toBe(401);
  });

  test.failing('full return marks the import log Returned @known-bug D-BUG-7', async () => {
    const emp = await loginAs('emp1');
    const items = [{ product_id: 1, warehouse_id: 1, supplier_id: 1, quantity: 5, unit_price: 2.5, batch_number: 'B-P1-NEW', expiry_date: isoDate(30) }];
    const created = await emp.post('/api/imports').field('items', JSON.stringify(items));
    expect(created.status).toBe(201);
    const importLogId = (await q('SELECT id FROM import_logs ORDER BY id DESC LIMIT 1'))[0].id;

    const res = await emp.post(`/api/imports/${importLogId}/return`).send({ return_qty: 5 });
    expect(res.status).toBe(200);

    const log = await one('SELECT * FROM import_logs WHERE id = $1', [importLogId]);
    expect(log.status).toBe('Returned');
    expect(Number(log.returned_qty)).toBe(5);
  });

  test.failing('import create must reject a warehouse from another branch @known-bug D-BUG-8', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.post('/api/imports').field('items', JSON.stringify([
      { product_id: 1, warehouse_id: 3, supplier_id: 1, quantity: 2, unit_price: 2, batch_number: 'B-P1-FOREIGN', expiry_date: isoDate(20) },
    ]));
    expect(res.status).toBe(400);
  });

  test('partial return writes RETURN_CREDIT and updates returned_qty', async () => {
    const emp = await loginAs('emp1');
    const items = [{ product_id: 1, warehouse_id: 1, supplier_id: 1, quantity: 5, unit_price: 2.5, batch_number: 'B-P1-NEW', expiry_date: isoDate(30) }];
    const created = await emp.post('/api/imports').field('items', JSON.stringify(items));
    expect(created.status).toBe(201);
    const importLogId = (await q('SELECT id FROM import_logs ORDER BY id DESC LIMIT 1'))[0].id;

    const res = await emp.post(`/api/imports/${importLogId}/return`).send({ return_qty: 2 });
    expect(res.status).toBe(200);

    const log = await one('SELECT * FROM import_logs WHERE id = $1', [importLogId]);
    expect(Number(log.returned_qty)).toBe(2);
    expect(log.status).toBe('Active');

    const tx = await one(
      "SELECT * FROM supplier_transactions WHERE supplier_id = 1 AND transaction_type = 'RETURN_CREDIT' ORDER BY id DESC LIMIT 1"
    );
    expect(Number(tx.total_amount)).toBe(-5);
  });

  test('over-return is rejected', async () => {
    const emp = await loginAs('emp1');
    const items = [{ product_id: 1, warehouse_id: 1, supplier_id: 1, quantity: 5, unit_price: 2.5, batch_number: 'B-P1-NEW', expiry_date: isoDate(30) }];
    const created = await emp.post('/api/imports').field('items', JSON.stringify(items));
    expect(created.status).toBe(201);
    const importLogId = (await q('SELECT id FROM import_logs ORDER BY id DESC LIMIT 1'))[0].id;

    const stockBefore = await stockSum(1, 1);
    const res = await emp.post(`/api/imports/${importLogId}/return`).send({ return_qty: 6 });
    expect(res.status).toBe(400);
    expect(await stockSum(1, 1)).toBe(stockBefore);
  });

  test.failing('import return must scope the import log to the caller branch @known-bug D-BUG-6', async () => {
    const emp2 = await loginAs('emp2');
    const items = [{ product_id: 1, warehouse_id: 3, supplier_id: 3, quantity: 2, unit_price: 2, batch_number: 'B2-P1-RET', expiry_date: isoDate(15) }];
    const created = await emp2.post('/api/imports').field('items', JSON.stringify(items));
    expect(created.status).toBe(201);
    const importLogId = (await q('SELECT id FROM import_logs ORDER BY id DESC LIMIT 1'))[0].id;

    const emp1 = await loginAs('emp1');
    const res = await emp1.post(`/api/imports/${importLogId}/return`).send({ return_qty: 1 });
    expect(res.status).toBe(404);
  });
});
