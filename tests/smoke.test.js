'use strict';
/**
 * Smoke test — proves the harness works end to end.
 * If this file fails, no other suite result can be trusted.
 */

const { resetDatabase, stockSum, count, productRow } = require('./helpers/db');
const { loginAs, loginAsRole, anon } = require('./helpers/auth');
const { expectUnauthorized } = require('./helpers/assertions');

beforeAll(async () => {
  await resetDatabase();
});

describe('harness smoke', () => {
  test('seeded fixtures are present and internally consistent', async () => {
    expect(await count('branches')).toBe(2);
    expect(await count('products')).toBe(12);
    expect(await count('staff')).toBe(20);

    // products.quantity mirrors the sum of physical batches.
    const p1 = await productRow(1);
    expect(Number(p1.quantity)).toBe(await stockSum(1));
    expect(await stockSum(1)).toBe(65);
    expect(await stockSum(1, 1)).toBe(60);
    expect(await stockSum(1, 2)).toBe(5);
  });

  test('unauthenticated API access is rejected', async () => {
    const res = await anon().get('/api/products');
    expectUnauthorized(res);
  });

  test('admin can log in and read the catalog', async () => {
    const admin = await loginAs('admin');
    const res = await admin.get('/api/products');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(12);
    expect(res.body[0]).not.toHaveProperty('password_hash');
  });

  test('branch users only see their own branch inventory', async () => {
    const b1 = await loginAsRole('EMPLOYEE', 1);
    const r1 = await b1.get('/api/inventory');
    expect(r1.status).toBe(200);
    const names1 = new Set(r1.body.map(r => r.item_name));
    expect(names1.has('Insulin Glargine')).toBe(true);

    const b2 = await loginAsRole('EMPLOYEE', 2);
    const r2 = await b2.get('/api/inventory');
    expect(r2.status).toBe(200);
    const names2 = new Set(r2.body.map(r => r.item_name));
    expect(names2.has('Insulin Glargine')).toBe(false);
    expect(names2.has('Normal Saline 0.9%')).toBe(true);
  });

  test('login response never leaks password material', async () => {
    const agent = await loginAs('emp1');
    const res = await agent.get('/api/auth/check');
    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(true);
    expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/);
  });
});
