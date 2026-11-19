'use strict';
/**
 * Worker C — Collections & Debt Settlement
 *
 * Covers:
 * - Permission gates (can_manage_collections, 403 for employee)
 * - POST /api/collections (recording payments, reducing debt, payments and ledger rows)
 * - Branch isolation (paying foreign branch client rejected)
 * - Malformed prefix defect (C-BUG-6)
 * - Overpayment driving negative debt (C-BUG-7)
 * - GET /api/collections, /transactions, /debts, /summary, /client/:id/monthly
 */

const { loginAs } = require('../../helpers/auth');
const { resetDatabase, q, one, scalar } = require('../../helpers/db');

beforeEach(async () => {
  await resetDatabase();
});

describe('Collections Permission Gate', () => {
  test('rejects employee without can_manage_collections with 403', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/collections');
    expect(res.status).toBe(403);
  });

  test('allows user with can_manage_collections permission', async () => {
    const coll = await loginAs('coll1');
    const res = await coll.get('/api/collections');
    expect(res.status).toBe(200);
  });
});

describe('POST /api/collections', () => {
  test('records payment for doctor, reduces total_debt, writes payments and negative ledger row', async () => {
    const coll = await loginAs('coll1');
    const docBefore = await one('SELECT total_debt FROM doctors WHERE id = 2');

    const res = await coll.post('/api/collections').send({
      client_id: 'doc-2',
      amount: 1000,
      payment_method: 'Cash',
      reference_no: 'REC-001',
      notes: 'Weekly collection',
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    // Verify doctor total_debt decreased by 1000
    const docAfter = await one('SELECT total_debt FROM doctors WHERE id = 2');
    expect(Number(docAfter.total_debt)).toBe(Number(docBefore.total_debt) - 1000);

    // Verify payments table entry
    const payment = await one('SELECT * FROM payments WHERE client_id = 2 ORDER BY id DESC LIMIT 1');
    expect(payment).toBeDefined();
    expect(Number(payment.amount)).toBe(1000);
    expect(payment.branch_id).toBe(1);

    // Verify negative PAYMENT ledger entry in client_transactions
    const tx = await one(
      'SELECT * FROM client_transactions WHERE reference_id = $1 AND type = $2',
      [payment.id, 'PAYMENT']
    );
    expect(tx.client_id).toBe(2);
    expect(Number(tx.amount)).toBe(-1000);
    expect(tx.branch_id).toBe(1);
  });

  test('records payment for pharmacy', async () => {
    const coll = await loginAs('coll1');
    const pharmBefore = await one('SELECT total_debt FROM pharmacies WHERE id = 2');

    const res = await coll.post('/api/collections').send({
      client_id: 'pharm-2',
      amount: 500,
      payment_method: 'Bank Transfer',
    });
    expect(res.status).toBe(201);

    const pharmAfter = await one('SELECT total_debt FROM pharmacies WHERE id = 2');
    expect(Number(pharmAfter.total_debt)).toBe(Number(pharmBefore.total_debt) - 500);
  });

  test('rejects payment with missing or invalid client_id', async () => {
    const coll = await loginAs('coll1');
    const res = await coll.post('/api/collections').send({ amount: 100 });
    expect(res.status).toBe(400);
  });

  test('rejects non-positive payment amount (0 or negative)', async () => {
    const coll = await loginAs('coll1');
    const resZero = await coll.post('/api/collections').send({ client_id: 'doc-2', amount: 0 });
    expect(resZero.status).toBe(400);

    const resNeg = await coll.post('/api/collections').send({ client_id: 'doc-2', amount: -100 });
    expect(resNeg.status).toBe(400);
  });

  test('rejects recording payment for a client belonging to another branch', async () => {
    const coll = await loginAs('coll1'); // branch 1
    // Doctor 4 belongs to branch 2
    const res = await coll.post('/api/collections').send({
      client_id: 'doc-4',
      amount: 100,
    });
    expect([400, 404]).toContain(res.status);
  });

  test.failing('rejects malformed client prefix with 400 instead of defaulting to pharmacy @known-bug C-BUG-6', async () => {
    const coll = await loginAs('coll1');
    // Prefix 'xyz' should be rejected with 400, not silently processed as pharmacy 1
    const res = await coll.post('/api/collections').send({
      client_id: 'xyz-1',
      amount: 10,
    });
    expect(res.status).toBe(400);
  });

  test.failing('overpayment exceeding client total_debt is rejected or capped @known-bug C-BUG-7', async () => {
    const coll = await loginAs('coll1');
    const doc = await one('SELECT total_debt FROM doctors WHERE id = 2');
    const excessiveAmount = Number(doc.total_debt) + 50000;

    const res = await coll.post('/api/collections').send({
      client_id: 'doc-2',
      amount: excessiveAmount,
    });
    // System should not permit negative total_debt
    const docAfter = await one('SELECT total_debt FROM doctors WHERE id = 2');
    expect(Number(docAfter.total_debt)).toBeGreaterThanOrEqual(0);
  });
});

describe('Collections Queries (GET routes)', () => {
  test('GET /api/collections returns recent payments for caller branch', async () => {
    const coll = await loginAs('coll1');
    const res = await coll.get('/api/collections');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.payments)).toBe(true);
  });

  test('GET /api/collections/transactions returns unified transaction list', async () => {
    const coll = await loginAs('coll1');
    const res = await coll.get('/api/collections/transactions');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.payments)).toBe(true);
  });

  test('GET /api/collections/debts lists clients with positive debt in caller branch', async () => {
    const coll = await loginAs('coll1');
    const res = await coll.get('/api/collections/debts');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.debts)).toBe(true);
    for (const client of res.body.debts) {
      expect(Number(client.total_debt)).toBeGreaterThan(0);
    }
  });

  test('GET /api/collections/summary returns aggregate financial metrics', async () => {
    const coll = await loginAs('coll1');
    const res = await coll.get('/api/collections/summary');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('monthly_collections');
    expect(res.body).toHaveProperty('total_market_debt');
  });

  test('GET /api/collections/client/:id/monthly returns monthly sum for client', async () => {
    const coll = await loginAs('coll1');
    const res = await coll.get('/api/collections/client/doc-2/monthly');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('monthly_sum');
  });
});
