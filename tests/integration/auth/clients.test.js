'use strict';
/**
 * Worker A — Client summary and market-debt ledgers.
 *
 * Oracle: readme.md §Client Prefix Encoding (456-462), route tables at 709-719.
 * Client ids are `doc-<id>` / `pharm-<id>` (Golden Rule 6) and must be branch-scoped.
 */
const { resetDatabase, q } = require('../../helpers/db');
const { loginAs, clearSessions } = require('../../helpers/auth');

beforeEach(async () => {
  clearSessions();
  await resetDatabase();
});
afterAll(() => clearSessions());

describe('GET /api/clients/:id/summary', () => {
  test('doc-1 returns 200 with client and transactions array', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/clients/doc-1/summary');
    expect(res.status).toBe(200);
    expect(res.body.client).toMatchObject({ id: 1, name: 'Dr. Ahmed Nour' });
    expect(Number(res.body.client.credit_limit)).toBe(60000);
    expect(res.body.client).toHaveProperty('address');
    expect(Array.isArray(res.body.transactions)).toBe(true);
  });

  test('pharm-1 returns 200 with the pharmacy client shape', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/clients/pharm-1/summary');
    expect(res.status).toBe(200);
    expect(res.body.client).toMatchObject({ id: 1, name: 'Al-Shifa Pharmacy' });
    expect(Number(res.body.client.credit_limit)).toBe(20000);
    expect(Array.isArray(res.body.transactions)).toBe(true);
  });

  test('a client with debt exposes the last ledger rows', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/clients/doc-2/summary');
    expect(res.status).toBe(200);
    expect(Number(res.body.client.total_debt)).toBeCloseTo(59999.99, 2);
    expect(res.body.transactions.length).toBeGreaterThan(0);
    expect(res.body.transactions[0]).toHaveProperty('type');
    expect(res.body.transactions[0]).toHaveProperty('amount');
    expect(res.body.transactions[0]).toHaveProperty('date');

    const ledger = await q('SELECT amount FROM client_transactions WHERE client_id = 2');
    expect(res.body.transactions.length).toBe(ledger.length);
  });

  test('an invalid client prefix returns 400, not 500', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/clients/doctor-1/summary');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/prefix/i);
  });

  test('an unknown client id returns 404, not 500', async () => {
    const emp = await loginAs('emp1');
    expect((await emp.get('/api/clients/doc-9999/summary')).status).toBe(404);
    expect((await emp.get('/api/clients/pharm-9999/summary')).status).toBe(404);
  });

  test('branch-1 user cannot read a branch-2 client, even with a spoofed branch', async () => {
    const emp = await loginAs('emp1');
    expect((await emp.get('/api/clients/doc-4/summary')).status).toBe(404);
    expect((await emp.get('/api/clients/pharm-4/summary')).status).toBe(404);
    expect((await emp.get('/api/clients/doc-4/summary?branch_id=2')).status).toBe(404);
    expect((await emp.get('/api/clients/doc-4/summary').set('x-branch-id', '2')).status).toBe(404);
    expect((await emp.get('/api/clients/doc-1/summary?branch_id=2')).body.client.id).toBe(1);
  });

  test('admin may target branch 2 with ?branch_id=2', async () => {
    const admin = await loginAs('admin');
    const res = await admin.get('/api/clients/doc-4/summary?branch_id=2');
    expect(res.status).toBe(200);
    expect(res.body.client).toMatchObject({ id: 4, name: 'Dr. Hana Youssef' });
    const pharm = await admin.get('/api/clients/pharm-4/summary?branch_id=2');
    expect(pharm.status).toBe(200);
    expect(pharm.body.client.id).toBe(4);
  });
});

describe('GET /api/customers/debt and /api/customers/debts', () => {
  test('collector gets 200 with a frontend-consumable, branch-scoped shape', async () => {
    const coll = await loginAs('coll1');
    for (const path of ['/api/customers/debt', '/api/customers/debts']) {
      const res = await coll.get(path);
      expect(res.status).toBe(200);
      expect(res.body.branch_id).toBe(1);
      expect(Array.isArray(res.body.debts)).toBe(true);
      expect(res.body.debts.length).toBeGreaterThan(0);

      const ids = res.body.debts.map(d => `${d.type}-${d.id}`).sort();
      expect(ids).toEqual(['doc-2', 'doc-3', 'pharm-2', 'pharm-3']);
      for (const debt of res.body.debts) {
        expect(debt.branch_id).toBe(1);
        expect(Number(debt.total_debt)).toBeGreaterThan(0);
        expect(debt).toHaveProperty('name');
        expect(debt).toHaveProperty('credit_limit');
      }
      expect(ids).not.toContain('doc-4');
      expect(ids).not.toContain('pharm-4');
    }
  });

  test('employee without can_manage_collections gets 403 on both aliases', async () => {
    const emp = await loginAs('emp1');
    expect((await emp.get('/api/customers/debt')).status).toBe(403);
    expect((await emp.get('/api/customers/debts')).status).toBe(403);
  });

  test('admin can target branch 2 and sees only branch-2 debtors', async () => {
    const admin = await loginAs('admin');
    const res = await admin.get('/api/customers/debt?branch_id=2');
    expect(res.status).toBe(200);
    expect(res.body.branch_id).toBe(2);
    expect(res.body.debts.map(d => `${d.type}-${d.id}`).sort()).toEqual(['doc-4', 'pharm-4']);
  });

  test('branch-2 collector only sees branch-2 debtors (no cross-branch override)', async () => {
    const coll2 = await loginAs('coll2');
    const res = await coll2.get('/api/customers/debt?branch_id=1');
    expect(res.status).toBe(200);
    expect(res.body.branch_id).toBe(2);
    expect(res.body.debts.map(d => `${d.type}-${d.id}`).sort()).toEqual(['doc-4', 'pharm-4']);
  });
});
