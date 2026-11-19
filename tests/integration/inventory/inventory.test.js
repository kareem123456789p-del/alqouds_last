'use strict';
/**
 * Inventory mirror — GET /api/inventory, PUT/DELETE /api/inventory/:id,
 * GET /api/inventory/batches/:warehouseId/:productId.
 *
 * Golden Rule 1: every read/write is forced to the caller's branch.
 */

const { resetDatabase, q, one, count } = require('../../helpers/db');
const { loginAs, clearSessions } = require('../../helpers/auth');

beforeEach(resetDatabase);
afterAll(clearSessions);

/** Raw branch inventory ids, mirroring the controller's JOIN + active filter. */
async function rawInventoryIds(branchId) {
  const rows = await q(
    `SELECT wi.id
       FROM warehouse_inventory wi
       JOIN products p ON p.id = wi.product_id
      WHERE wi.branch_id = $1 AND p.is_active = 1 AND p.is_deleted = 0
      ORDER BY wi.expiry_date ASC, wi.id`,
    [branchId],
  );
  return rows.map(r => Number(r.id));
}

describe('GET /api/inventory', () => {
  test('is branch-scoped: branch 1 sees only branch-1 warehouse rows', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/inventory');
    expect(res.status).toBe(200);

    const expected = await rawInventoryIds(1);
    expect(res.body.map(r => Number(r.inventory_id))).toEqual(expected);
    expect(res.body.length).toBeGreaterThan(0);

    // Branch 1 has the cold-storage product; its warehouse is branch 1 only.
    const names = new Set(res.body.map(r => r.item_name));
    expect(names.has('Insulin Glargine')).toBe(true);
    expect(names.has('Face Mask')).toBe(true);
    // No row may point at a branch-2 warehouse.
    const warehouses = new Set(res.body.map(r => r.warehouse_name));
    expect([...warehouses].some(n => String(n).includes('فرع 2'))).toBe(false);
  });

  test('branch 2 sees only branch-2 rows', async () => {
    const emp = await loginAs('emp2');
    const res = await emp.get('/api/inventory');
    expect(res.status).toBe(200);

    const expected = await rawInventoryIds(2);
    expect(res.body.map(r => Number(r.inventory_id))).toEqual(expected);
    const names = new Set(res.body.map(r => r.item_name));
    expect(names.has('Insulin Glargine')).toBe(false);
    expect(names.has('Normal Saline 0.9%')).toBe(true);
  });

  test('?branch_id=2 is ignored for a branch-1 employee', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/inventory?branch_id=2');
    expect(res.status).toBe(200);
    expect(res.body.map(r => Number(r.inventory_id))).toEqual(await rawInventoryIds(1));
  });

  test('x-branch-id header is ignored for a branch-1 employee', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/inventory').set('x-branch-id', '2');
    expect(res.status).toBe(200);
    expect(res.body.map(r => Number(r.inventory_id))).toEqual(await rawInventoryIds(1));
  });

  test('excludes products that were soft-deleted through DELETE /api/inventory/:id', async () => {
    const emp = await loginAs('emp1');
    await emp.delete('/api/inventory/2');
    const res = await emp.get('/api/inventory');
    expect(res.status).toBe(200);
    expect(res.body.find(r => Number(r.product_id) === 2)).toBeUndefined();
  });
});

describe('GET /api/inventory/batches/:warehouseId/:productId', () => {
  test('returns only stock > 0 batches for the caller branch, ordered by expiry_date ASC', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/inventory/batches/1/1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body.map(r => r.batch_number)).toEqual(['B-P1-EXPIRED', 'B-P1-NEAR', 'B-P1-FAR']);
    expect(res.body.map(r => Number(r.current_stock))).toEqual([10, 20, 30]);
    // Ordered by expiry ascending.
    const expiries = res.body.map(r => new Date(r.expiry_date).getTime());
    expect(expiries).toEqual([...expiries].sort((a, b) => a - b));
  });

  test('omits batches whose stock dropped to zero', async () => {
    const emp = await loginAs('emp1');
    await q('UPDATE warehouse_inventory SET current_stock = 0 WHERE id = 1');
    const res = await emp.get('/api/inventory/batches/1/1');
    expect(res.status).toBe(200);
    expect(res.body.map(r => r.batch_number)).toEqual(['B-P1-NEAR', 'B-P1-FAR']);
  });

  test('a foreign warehouse id returns empty and never leaks branch-2 rows', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/inventory/batches/3/1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);

    const emp2 = await loginAs('emp2');
    const theirs = await emp2.get('/api/inventory/batches/3/1');
    expect(theirs.status).toBe(200);
    expect(theirs.body).toHaveLength(1);
    expect(theirs.body[0].batch_number).toBe('B2-P1');
  });

  test('an unknown warehouse/product combination returns an empty list, not a 500', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/inventory/batches/999999/1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('PUT /api/inventory/:id', () => {
  test('updates stock, batch, expiry and thresholds for a row in the caller branch', async () => {
    const emp = await loginAs('emp1');
    const before = await one('SELECT * FROM warehouse_inventory WHERE id = 1');
    const res = await emp.put('/api/inventory/1').send({
      current_stock: 44,
      batch_number: 'B-QA-CHANGED',
      expiry_date: '2031-05-06',
      qty_threshold: 5,
      expiry_month_threshold: 9,
    });
    expect(res.status).toBe(200);

    const after = await one('SELECT * FROM warehouse_inventory WHERE id = 1');
    expect(Number(after.current_stock)).toBe(44);
    expect(after.batch_number).toBe('B-QA-CHANGED');
    const d = new Date(after.expiry_date);
    const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(localDate).toBe('2031-05-06');
    expect(Number(after.qty_threshold)).toBe(5);
    expect(Number(after.expiry_month_threshold)).toBe(9);
    expect(before.id).toBe(after.id);
  });

  test('a branch-2 row id returns 404 and is not modified', async () => {
    const emp = await loginAs('emp1');
    const foreign = await one('SELECT * FROM warehouse_inventory WHERE branch_id = 2 LIMIT 1');
    const res = await emp.put(`/api/inventory/${foreign.id}`).send({ current_stock: 999 });
    expect(res.status).toBe(404);

    const unchanged = await one('SELECT * FROM warehouse_inventory WHERE id = $1', [foreign.id]);
    expect(Number(unchanged.current_stock)).toBe(Number(foreign.current_stock));
  });

  test(
    'missing current_stock must be rejected with 400, not 500 @known-bug B-BUG-6',
    async () => {
      const emp = await loginAs('emp1');
      for (const body of [{ batch_number: 'X' }, { current_stock: null }]) {
        const res = await emp.put('/api/inventory/1').send(body);
        // actual: 500 "null value in column \"current_stock\" ... violates not-null constraint"
        expect(res.status).toBe(400);
      }
    },
  );

  test(
    'a negative current_stock must be rejected, never persisted @known-bug B-BUG-7',
    async () => {
      const emp = await loginAs('emp1');
      const res = await emp.put('/api/inventory/1').send({ current_stock: -7 });
      // actual: 200 and the row is persisted with current_stock = -7
      expect(res.status).toBe(400);
      const row = await one('SELECT current_stock FROM warehouse_inventory WHERE id = 1');
      expect(Number(row.current_stock)).toBeGreaterThanOrEqual(0);
    },
  );
});

describe('DELETE /api/inventory/:id (master-mirror deletion)', () => {
  test('soft-deletes the master row, keeps it for history, and wipes only the caller branch mirror', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.delete('/api/inventory/1');
    expect(res.status).toBe(200);
    expect(res.body.warehouse_rows_deleted).toBe(3);

    // Master row survives (Golden Rule 2: never DELETE FROM products).
    const master = await one('SELECT * FROM products WHERE id = 1');
    expect(master).not.toBeNull();
    expect(Number(master.is_active)).toBe(0);
    expect(Number(master.is_deleted)).toBe(1);
    expect(await count('products')).toBe(12);

    // Mirror wipe is branch-scoped.
    expect(await count('warehouse_inventory', 'WHERE product_id = 1 AND branch_id = 1')).toBe(0);
    expect(await count('warehouse_inventory', 'WHERE product_id = 1 AND branch_id = 2')).toBe(1);
  });

  test('admin ?branch_id=2 wipes the branch-2 mirror while branch 1 keeps its rows', async () => {
    const admin = await loginAs('admin');
    const res = await admin.delete('/api/inventory/2?branch_id=2');
    expect(res.status).toBe(200);
    expect(res.body.warehouse_rows_deleted).toBe(1);

    expect(Number((await one('SELECT is_active FROM products WHERE id = 2')).is_active)).toBe(0);
    expect(await count('warehouse_inventory', 'WHERE product_id = 2 AND branch_id = 1')).toBe(2);
    expect(await count('warehouse_inventory', 'WHERE product_id = 2 AND branch_id = 2')).toBe(0);
  });

  test('an unknown product id returns 404', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.delete('/api/inventory/999999');
    expect(res.status).toBe(404);
  });
});
