'use strict';
/**
 * Products master catalog — GET / POST / PUT / DELETE /api/products.
 *
 * The catalog is global (no branch scoping). DELETE is intentionally blocked
 * (readme §8.1); deactivation belongs to DELETE /api/inventory/:id.
 */

const { resetDatabase, q, one, count } = require('../../helpers/db');
const { loginAs, anon, clearSessions } = require('../../helpers/auth');

beforeEach(resetDatabase);
afterAll(clearSessions);

describe('GET /api/products', () => {
  test('returns active products with joined UOM names', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/products');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(12);

    const p1 = res.body.find(p => p.id === 1);
    expect(p1.base_uom_name).toBe('Tablet');
    expect(p1.bulk_uom_name).toBe('Box');
    expect(Number(p1.conversion_factor)).toBe(100);

    // Product 3 has no bulk UOM seeded.
    const p3 = res.body.find(p => p.id === 3);
    expect(p3.bulk_uom_id).toBeNull();
    expect(p3.bulk_uom_name).toBeNull();
  });

  test('hides a product after it is soft-deleted through the inventory endpoint', async () => {
    const emp = await loginAs('emp1');
    const del = await emp.delete('/api/inventory/5');
    expect(del.status).toBe(200);

    const res = await emp.get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.find(p => p.id === 5)).toBeUndefined();
    expect(res.body).toHaveLength(11);
  });
});

describe('POST /api/products', () => {
  test('rejects a missing name with 400', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.post('/api/products').send({ base_uom: 'Tablet' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name is required/i);
  });

  test('creates a product with quantity 0, price 0 and the requested UOM conversion', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.post('/api/products').send({
      name: 'QA Created Product',
      base_uom: 'Tablet',
      has_bulk: true,
      bulk_uom: 'Box',
      conversion_factor: 100,
    });
    expect(res.status).toBe(201);
    expect(res.body.product.id).toEqual(expect.any(Number));

    const row = await one('SELECT * FROM products WHERE id = $1', [res.body.product.id]);
    expect(row.name).toBe('QA Created Product');
    expect(Number(row.quantity)).toBe(0);
    expect(Number(row.price)).toBe(0);
    expect(Number(row.base_uom_id)).toBe(1);   // Tablet
    expect(Number(row.bulk_uom_id)).toBe(2);   // Box
    expect(Number(row.conversion_factor)).toBe(100);
    expect(Number(row.is_active)).toBe(1);
    expect(Number(row.is_deleted)).toBe(0);
  });

  test('creates an unknown UOM once and reuses it (no duplicate)', async () => {
    const emp = await loginAs('emp1');
    const unit = 'QA Unique Unit';
    const first = await emp.post('/api/products').send({ name: 'QA UOM A', base_uom: unit });
    const second = await emp.post('/api/products').send({ name: 'QA UOM B', base_uom: unit });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const uoms = await q('SELECT * FROM uom WHERE name = $1', [unit]);
    expect(uoms).toHaveLength(1);
    const a = await one('SELECT base_uom_id FROM products WHERE id = $1', [first.body.product.id]);
    const b = await one('SELECT base_uom_id FROM products WHERE id = $1', [second.body.product.id]);
    expect(Number(a.base_uom_id)).toBe(Number(uoms[0].id));
    expect(Number(b.base_uom_id)).toBe(Number(uoms[0].id));
  });
});

describe('PUT /api/products/:id', () => {
  test(
    'a partial update that omits price must not silently reset the price @known-bug B-BUG-1',
    async () => {
      const emp = await loginAs('emp1');
      const created = await emp.post('/api/products').send({ name: 'QA Price Product', base_uom: 'Tablet' });
      const id = created.body.product.id;

      const full = await emp.put(`/api/products/${id}`).send({
        name: 'QA Price Product', base_uom: 'Tablet', has_bulk: false, price: 12.5,
      });
      expect(full.status).toBe(200);

      const partial = await emp.put(`/api/products/${id}`).send({ name: 'QA Renamed' });
      expect(partial.status).toBe(200);

      const row = await one('SELECT * FROM products WHERE id = $1', [id]);
      expect(row.name).toBe('QA Renamed');
      // actual: parseFloat(undefined) || 0 → 0.00 (base_uom_id is cleared too)
      expect(Number(row.price)).toBe(12.5);
    },
  );

  test(
    'updating a nonexistent product id must not return success @known-bug B-BUG-2',
    async () => {
      const emp = await loginAs('emp1');
      const res = await emp.put('/api/products/999999').send({ name: 'Ghost', price: 5 });
      // actual: 200 {"message":"Product updated successfully"} (UPDATE affects 0 rows)
      expect(res.status).toBe(404);
    },
  );
});

describe('DELETE /api/products/:id', () => {
  test('is blocked with 405 and leaves the master row untouched', async () => {
    const emp = await loginAs('emp1');
    const before = await one('SELECT * FROM products WHERE id = 1');
    const res = await emp.delete('/api/products/1');
    expect(res.status).toBe(405);
    expect(res.body.error).toBe('Method Not Allowed');

    const after = await one('SELECT * FROM products WHERE id = 1');
    expect(after.is_active).toBe(before.is_active);
    expect(after.is_deleted).toBe(before.is_deleted);
    expect(await count('products')).toBe(12);
  });

  test('an anonymous caller never reaches the handler', async () => {
    const res = await anon().delete('/api/products/1');
    expect(res.status).toBe(401);
  });
});
