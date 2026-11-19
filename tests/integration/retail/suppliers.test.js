'use strict';
/**
 * Worker D — Supplier management tests (CRUD + shipment history).
 *
 * Assigned routes covered here:
 *   GET    /api/suppliers
 *   POST   /api/suppliers
 *   DELETE /api/suppliers/:id
 *   GET    /api/suppliers/:id
 *   PUT    /api/suppliers/:id
 *   GET    /api/suppliers/:id/history
 */

const { resetDatabase, q, one, scalar, count, stockSum, warehouseStock, productRow, clientLedgerSum, clientDebt, supplierBalance } = require('../../helpers/db');
const { anon, loginAs, loginAsRole, clearSessions } = require('../../helpers/auth');

beforeEach(async () => {
  await resetDatabase();
});

afterAll(() => {
  clearSessions();
});

describe('GET /api/suppliers', () => {
  test('unauthenticated caller receives 401', async () => {
    const res = await anon().get('/api/suppliers');
    expect(res.status).toBe(401);
  });

  test('returns only the caller branch suppliers', async () => {
    const emp1 = await loginAs('emp1');
    const r1 = await emp1.get('/api/suppliers');
    expect(r1.status).toBe(200);
    expect(Array.isArray(r1.body)).toBe(true);
    expect(r1.body).toHaveLength(2);
    for (const s of r1.body) {
      expect(Number(s.branch_id)).toBe(1);
    }

    const emp2 = await loginAs('emp2');
    const r2 = await emp2.get('/api/suppliers');
    expect(r2.status).toBe(200);
    expect(r2.body).toHaveLength(1);
    expect(Number(r2.body[0].id)).toBe(3);
    expect(Number(r2.body[0].branch_id)).toBe(2);
  });

  test('supports the search filter within the branch', async () => {
    const emp1 = await loginAs('emp1');
    const res = await emp1.get('/api/suppliers?search=EgyptPharma');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(1);
  });
});

describe('GET /api/suppliers/:id', () => {
  test('unauthenticated caller receives 401', async () => {
    const res = await anon().get('/api/suppliers/1');
    expect(res.status).toBe(401);
  });

  test('returns a supplier of the caller branch', async () => {
    const emp1 = await loginAs('emp1');
    const res = await emp1.get('/api/suppliers/1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(1);
    expect(res.body.company_name).toBe('EgyptPharma Dist.');
  });

  test('branch-2 caller cannot read a branch-1 supplier', async () => {
    const emp2 = await loginAs('emp2');
    const res = await emp2.get('/api/suppliers/1');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/suppliers', () => {
  test('unauthenticated caller receives 401', async () => {
    const res = await anon().post('/api/suppliers').send({
      company_name: 'New Supplier Co.',
      contact_person: 'Test Person',
      phone: '02-5555-5555',
      city_area: 'Cairo - Nasr City',
    });
    expect(res.status).toBe(401);
  });

  test('requires the mandatory company fields', async () => {
    const emp1 = await loginAs('emp1');
    const res = await emp1.post('/api/suppliers').send({
      contact_person: 'Test Person',
      phone: '02-5555-5555',
      city_area: 'Cairo - Nasr City',
    });
    expect(res.status).toBe(400);
  });

  test('creates a branch-scoped supplier', async () => {
    const emp1 = await loginAs('emp1');
    const res = await emp1.post('/api/suppliers').send({
      company_name: 'New Supplier Co.',
      contact_person: 'Test Person',
      phone: '02-5555-5555',
      city_area: 'Cairo - Nasr City',
      notes: 'QA created',
    });
    expect(res.status).toBe(201);
    expect(res.body.company_name).toBe('New Supplier Co.');
    expect(Number(res.body.branch_id)).toBe(1);

    const emp2 = await loginAs('emp2');
    const res2 = await emp2.post('/api/suppliers').send({
      company_name: 'Branch Two Supplier',
      contact_person: 'Other Person',
      phone: '02-6666-6666',
      city_area: 'Giza - Dokki',
    });
    expect(res2.status).toBe(201);
    expect(Number(res2.body.branch_id)).toBe(2);
  });
});

describe('PUT /api/suppliers/:id', () => {
  test('unauthenticated caller receives 401', async () => {
    const res = await anon().put('/api/suppliers/1').send({ company_name: 'X', contact_person: 'Y', phone: 'Z', city_area: 'Cairo' });
    expect(res.status).toBe(401);
  });

  test('round-trips the update', async () => {
    const emp1 = await loginAs('emp1');
    const update = await emp1.put('/api/suppliers/1').send({
      company_name: 'EgyptPharma Dist. (Updated)',
      contact_person: 'Khaled Nour',
      phone: '02-2345-6789',
      city_area: 'Cairo - Nasr City',
    });
    expect(update.status).toBe(200);
    expect(update.body.success).toBe(true);

    const after = await emp1.get('/api/suppliers/1');
    expect(after.body.company_name).toBe('EgyptPharma Dist. (Updated)');

    const missing = await emp1.put('/api/suppliers/1').send({ company_name: 'Only Company' });
    expect(missing.status).toBe(400);
  });
});

describe('DELETE /api/suppliers/:id', () => {
  test('unauthenticated caller receives 401', async () => {
    const res = await anon().delete('/api/suppliers/1');
    expect(res.status).toBe(401);
  });

  test.failing('supplier delete with existing transactions must be rejected cleanly @known-bug D-BUG-9', async () => {
    const emp1 = await loginAs('emp1');
    const res = await emp1.delete('/api/suppliers/1');
    expect([400, 401, 403, 404, 409]).toContain(res.status);
  });
});

describe('GET /api/suppliers/:id/history', () => {
  test('unauthenticated caller receives 401', async () => {
    const res = await anon().get('/api/suppliers/1/history');
    expect(res.status).toBe(401);
  });

  test.failing('GET /api/suppliers/:id/history must equal the supplier ledger sum @known-bug D-BUG-13', async () => {
    const emp1 = await loginAs('emp1');
    const res = await emp1.get('/api/suppliers/1/history');
    expect(res.status).toBe(200);
    expect(Number(res.body.total_outstanding_balance)).toBe(5000);

    const ledger = await one(
      'SELECT COALESCE(SUM(total_amount), 0) AS s FROM supplier_transactions WHERE supplier_id = 1'
    );
    expect(Number(ledger.s)).toBe(5000);
  });
});
