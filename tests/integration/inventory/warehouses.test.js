'use strict';
/**
 * Warehouses — GET /list, /stats, /:id/inventory, /movements and
 * POST / PUT / DELETE /api/warehouse.
 *
 * Read routes are branch-scoped; write routes carry MANAGE_WAREHOUSES_* gates
 * and always force the caller's branch.
 */

const { resetDatabase, q, one, scalar, count } = require('../../helpers/db');
const { loginAs, clearSessions } = require('../../helpers/auth');

beforeEach(resetDatabase);
afterAll(clearSessions);

async function rawWarehouseStats(branchId) {
  return q(
    `SELECT w.id,
            COALESCE(SUM(CASE WHEN p.is_active = 1 AND p.is_deleted = 0 THEN wi.current_stock ELSE 0 END), 0)::int AS total_stock,
            COUNT(DISTINCT CASE WHEN p.is_active = 1 AND p.is_deleted = 0 THEN wi.product_id END)::int AS product_count
       FROM warehouses w
       LEFT JOIN warehouse_inventory wi ON wi.warehouse_id = w.id AND wi.branch_id = $1
       LEFT JOIN products p ON wi.product_id = p.id
      WHERE w.branch_id = $1
      GROUP BY w.id
      ORDER BY w.id`,
    [branchId],
  );
}

describe('GET /api/warehouse/list', () => {
  test('is branch-scoped and its totals match raw SQL', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/warehouse/list');
    expect(res.status).toBe(200);
    expect(res.body.map(w => Number(w.id))).toEqual([1, 2]);

    const expected = await rawWarehouseStats(1);
    for (let i = 0; i < expected.length; i += 1) {
      expect(Number(res.body[i].total_stock)).toBe(Number(expected[i].total_stock));
      expect(Number(res.body[i].product_count)).toBe(Number(expected[i].product_count));
    }
    expect(Number(res.body[0].total_stock)).toBeGreaterThan(0);
  });

  test('branch 2 only sees its own warehouse', async () => {
    const emp = await loginAs('emp2');
    const res = await emp.get('/api/warehouse/list');
    expect(res.status).toBe(200);
    expect(res.body.map(w => Number(w.id))).toEqual([3]);
    const expected = await rawWarehouseStats(2);
    expect(Number(res.body[0].total_stock)).toBe(Number(expected[0].total_stock));
    expect(Number(res.body[0].product_count)).toBe(Number(expected[0].product_count));
  });
});

describe('GET /api/warehouse/stats', () => {
  test.failing(
    'returns counts and value that match raw SQL @known-bug B-BUG-3',
    async () => {
      const emp = await loginAs('emp1');
      const res = await emp.get('/api/warehouse/stats');
      expect(res.status).toBe(200);

      // Postgres lowercases unquoted aliases, so the camelCase destructuring in
      // the controller yields undefined → fields omitted and value NaN.
      const expectedWarehouses = Number(await scalar('SELECT COUNT(*) FROM warehouses WHERE branch_id = 1'));
      expect(Number(res.body.active_warehouses)).toBe(expectedWarehouses);

      const expectedLines = Number(await scalar(
        `SELECT COUNT(DISTINCT wi.product_id)
           FROM warehouse_inventory wi
           JOIN products p ON p.id = wi.product_id
          WHERE wi.branch_id = 1 AND p.is_active = 1 AND p.is_deleted = 0`,
      ));
      expect(Number(res.body.product_lines)).toBe(expectedLines);

      const expectedValue = Number(await scalar(
        `SELECT COALESCE(SUM(wi.current_stock * p.price), 0)
           FROM warehouse_inventory wi
           JOIN products p ON p.id = wi.product_id
          WHERE wi.branch_id = 1 AND p.is_active = 1 AND p.is_deleted = 0`,
      ));
      expect(Number(res.body.total_inventory_value)).toBeCloseTo(expectedValue, 2);
    },
  );
});

describe('GET /api/warehouse/:id/inventory', () => {
  test('returns stock for a warehouse in the caller branch', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/warehouse/1/inventory');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    for (const row of res.body) {
      expect(row.quantity).toBeGreaterThan(0);
      expect(row.name).toEqual(expect.any(String));
    }
  });

  test('a foreign or unknown warehouse id returns an empty list without leaking data', async () => {
    const emp = await loginAs('emp1');
    const foreign = await emp.get('/api/warehouse/3/inventory');
    expect(foreign.status).toBe(200);
    expect(foreign.body).toEqual([]);

    const unknown = await emp.get('/api/warehouse/999999/inventory');
    expect(unknown.status).toBe(200);
    expect(unknown.body).toEqual([]);
  });
});

describe('GET /api/warehouse/movements', () => {
  test('is branch-scoped to import movements', async () => {
    await q(
      `INSERT INTO import_logs (product_id, warehouse_id, supplier_id, quantity, unit_price, returned_qty, status, branch_id)
       VALUES (1, 1, 1, 5, 2.00, 0, 'Active', 1)`,
    );
    await q(
      `INSERT INTO import_logs (product_id, warehouse_id, supplier_id, quantity, unit_price, returned_qty, status, branch_id)
       VALUES (1, 3, 3, 7, 2.00, 0, 'Active', 2)`,
    );

    const emp1 = await loginAs('emp1');
    const r1 = await emp1.get('/api/warehouse/movements');
    expect(r1.status).toBe(200);
    expect(r1.body).toHaveLength(1);
    expect(Number(r1.body[0].warehouse_id)).toBe(1);
    expect(r1.body[0].movement_type).toBe('import');

    const emp2 = await loginAs('emp2');
    const r2 = await emp2.get('/api/warehouse/movements');
    expect(r2.status).toBe(200);
    expect(r2.body).toHaveLength(1);
    expect(Number(r2.body[0].warehouse_id)).toBe(3);
  });
});

describe('POST /api/warehouse', () => {
  test('requires MANAGE_WAREHOUSES_ADD', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.post('/api/warehouse').send({ name: 'Nope', location: 'x' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/MANAGE_WAREHOUSES_ADD/);
  });

  test('requires a name', async () => {
    const wh = await loginAs('wh1');
    const res = await wh.post('/api/warehouse').send({ location: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name is required/i);
  });

  test('always lands in the caller branch even when the body says otherwise', async () => {
    const wh = await loginAs('wh1');
    const res = await wh.post('/api/warehouse').send({
      name: 'QA Branch WH', location: 'loc', capacity: 123, branch_id: 2,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.branch).toBeUndefined();

    const row = await one('SELECT * FROM warehouses WHERE name = $1', ['QA Branch WH']);
    expect(Number(row.branch_id)).toBe(1);
    expect(Number(row.capacity)).toBe(123);
  });

  test('defaults capacity when omitted', async () => {
    const wh = await loginAs('wh1');
    const res = await wh.post('/api/warehouse').send({ name: 'QA Default Capacity' });
    expect(res.status).toBe(201);
    const row = await one('SELECT * FROM warehouses WHERE name = $1', ['QA Default Capacity']);
    expect(Number(row.capacity)).toBe(10000);
  });
});

describe('PUT /api/warehouse/:id', () => {
  test('requires MANAGE_WAREHOUSES_EDIT', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.put('/api/warehouse/1').send({ name: 'Nope', location: 'x' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/MANAGE_WAREHOUSES_EDIT/);
  });

  test('updates a warehouse in the caller branch', async () => {
    const wh = await loginAs('wh1');
    const res = await wh.put('/api/warehouse/1').send({
      name: 'QA Updated WH', location: 'New loc', capacity: 777,
    });
    expect(res.status).toBe(200);
    const row = await one('SELECT * FROM warehouses WHERE id = 1');
    expect(row.name).toBe('QA Updated WH');
    expect(row.location).toBe('New loc');
    expect(Number(row.capacity)).toBe(777);
  });

  test.failing(
    'a branch-2 warehouse id must return 404, not silent success @known-bug B-BUG-4',
    async () => {
      const wh = await loginAs('wh1');
      const res = await wh.put('/api/warehouse/3').send({ name: 'Hacked', location: 'x', capacity: 1 });
      // actual: 200 {"success":true}; warehouse 3 is untouched.
      expect(res.status).toBe(404);
    },
  );
});

describe('DELETE /api/warehouse/:id', () => {
  test('requires MANAGE_WAREHOUSES_DELETE', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.delete('/api/warehouse/1');
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/MANAGE_WAREHOUSES_DELETE/);
  });

  test('deletes an empty warehouse in the caller branch', async () => {
    const wh = await loginAs('wh1');
    const created = await wh.post('/api/warehouse').send({ name: 'QA Delete Me' });
    const id = created.body.data.id;

    const res = await wh.delete(`/api/warehouse/${id}`);
    expect(res.status).toBe(200);
    expect(await one('SELECT * FROM warehouses WHERE id = $1', [id])).toBeNull();
  });

  test.failing(
    'a branch-2 warehouse id must return 404, not silent success @known-bug B-BUG-4',
    async () => {
      const wh = await loginAs('wh1');
      const res = await wh.delete('/api/warehouse/3');
      // actual: 200 {"success":true}; warehouse 3 still exists.
      expect(res.status).toBe(404);
    },
  );

  test.failing(
    'deleting a warehouse that still holds stock must be rejected with a 4xx, not cascade-delete inventory @known-bug B-BUG-5',
    async () => {
      const wh = await loginAs('wh1');
      const stockBefore = await count('warehouse_inventory', 'WHERE warehouse_id = 1 AND branch_id = 1');
      expect(stockBefore).toBeGreaterThan(0);

      const res = await wh.delete('/api/warehouse/1');
      // actual: 200 and every warehouse_inventory row for warehouse 1 is gone
      // (warehouse_id FK is ON DELETE CASCADE).
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(await count('warehouse_inventory', 'WHERE warehouse_id = 1')).toBe(stockBefore);
    },
  );
});
