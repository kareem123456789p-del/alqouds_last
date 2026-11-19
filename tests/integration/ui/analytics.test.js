'use strict';
/**
 * Worker E — Analytics & Performance Reporting
 *
 * Covers:
 * - Permission gates (can_manage_analytics, 403 for regular employee)
 * - GET /api/analytics/summary (KPI values, date periods, admin all branches)
 * - GET /api/analytics/branches
 * - GET /api/analytics/branch-performance
 * - GET /api/analytics/sales-purchases-timeline
 * - GET /api/analytics/top-products
 * - GET /api/analytics/category-distribution
 * - GET /api/analytics/critical-alerts
 * - GET /api/analytics/suppliers-payables
 * - POST /api/analytics/suppliers/pay
 * - Golden Rule 1: Non-admin branch override via ?branch_id=2 (E-BUG-1)
 * - processSupplierPayment trusting body.branch_id (E-BUG-2)
 */

const { loginAs } = require('../../helpers/auth');
const { resetDatabase, q, one, scalar } = require('../../helpers/db');

beforeEach(async () => {
  await resetDatabase();
  // Insert deterministic analytics fixtures directly via SQL:
  // Dispatched orders in branch 1 and branch 2
  await q(
    `INSERT INTO orders (order_number, client_id, warehouse_id, total_amount, status, branch_id)
     VALUES ('#ORD-2026-9001', 1, 1, 1000.00, 'Dispatched', 1)`
  );
  await q(
    `INSERT INTO orders (order_number, client_id, warehouse_id, total_amount, status, branch_id)
     VALUES ('#ORD-2026-9002', 4, 3, 2000.00, 'Dispatched', 2)`
  );

  // Retail shifts and sales in branch 1 and branch 2
  const s1 = await q("INSERT INTO retail_shifts (status, branch_id) VALUES ('CLOSED', 1) RETURNING id");
  const s2 = await q("INSERT INTO retail_shifts (status, branch_id) VALUES ('CLOSED', 2) RETURNING id");

  await q(
    `INSERT INTO retail_sales (shift_id, total_amount, profit_amount, branch_id)
     VALUES ($1, 200.00, 50.00, 1)`,
    [s1[0].id]
  );
  await q(
    `INSERT INTO retail_sales (shift_id, total_amount, profit_amount, branch_id)
     VALUES ($1, 400.00, 100.00, 2)`,
    [s2[0].id]
  );
});

describe('Analytics Permission Gate', () => {
  test('rejects employee without can_manage_analytics with 403', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/analytics/summary');
    expect(res.status).toBe(403);
  });

  test('allows analyst with can_manage_analytics permission', async () => {
    const ana = await loginAs('ana1');
    const res = await ana.get('/api/analytics/summary');
    expect(res.status).toBe(200);
  });
});

describe('GET /api/analytics/summary', () => {
  test('returns 5 KPI values for branch 1 when called by branch 1 analyst', async () => {
    const ana = await loginAs('ana1');
    const res = await ana.get('/api/analytics/summary?period=all_time');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total_sales');
    expect(res.body).toHaveProperty('total_net_profit');
    expect(res.body).toHaveProperty('total_purchases');
    expect(res.body).toHaveProperty('total_payables');
    expect(res.body).toHaveProperty('inventory_value');

    // Sales in branch 1 = 1000 (order) + 200 (retail) = 1200
    expect(Number(res.body.total_sales.value)).toBe(1200);
  });

  test('admin with ?branch_id=all includes totals from both branches', async () => {
    const admin = await loginAs('admin');
    const res = await admin.get('/api/analytics/summary?period=all_time&branch_id=all');
    expect(res.status).toBe(200);

    // Total sales across both branches = (1000 + 200) + (2000 + 400) = 3600
    expect(Number(res.body.total_sales.value)).toBe(3600);
  });

  test.failing('non-admin analyst cannot override branch filter with ?branch_id=2 (Golden Rule 1) @known-bug E-BUG-1', async () => {
    const ana = await loginAs('ana1'); // branch 1 analyst
    const res = await ana.get('/api/analytics/summary?period=all_time&branch_id=2');
    expect(res.status).toBe(200);

    // Must NOT return branch 2 sales (2400) when requested by a branch 1 employee
    expect(Number(res.body.total_sales.value)).not.toBe(2400);
  });
});

describe('GET /api/analytics/branches', () => {
  test('admin sees all branches with is_admin true', async () => {
    const admin = await loginAs('admin');
    const res = await admin.get('/api/analytics/branches');
    expect(res.status).toBe(200);
    expect(res.body.is_admin).toBe(true);
    expect(res.body.branches.length).toBeGreaterThanOrEqual(2);
  });

  test('non-admin analyst sees only caller branch with is_admin false', async () => {
    const ana = await loginAs('ana1');
    const res = await ana.get('/api/analytics/branches');
    expect(res.status).toBe(200);
    expect(res.body.is_admin).toBe(false);
    expect(res.body.branches).toHaveLength(1);
    expect(res.body.branches[0].id).toBe(1);
  });
});

describe('GET /api/analytics/branch-performance', () => {
  test('returns performance metrics per branch for admin', async () => {
    const admin = await loginAs('admin');
    const res = await admin.get('/api/analytics/branch-performance?period=all_time&branch_id=all');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.branches)).toBe(true);
    expect(res.body.branches.length).toBeGreaterThanOrEqual(2);
  });

  test('returns single branch performance for branch 1 analyst', async () => {
    const ana = await loginAs('ana1');
    const res = await ana.get('/api/analytics/branch-performance?period=all_time');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.branches)).toBe(true);
    expect(res.body.branches).toHaveLength(1);
    expect(res.body.branches[0].branch_id).toBe(1);
  });
});

describe('GET /api/analytics charts & breakdowns', () => {
  test('GET /api/analytics/sales-purchases-timeline returns timeline object', async () => {
    const ana = await loginAs('ana1');
    const res = await ana.get('/api/analytics/sales-purchases-timeline?period=all_time');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.sales)).toBe(true);
    expect(Array.isArray(res.body.purchases)).toBe(true);
  });

  test('GET /api/analytics/top-products returns products array', async () => {
    const ana = await loginAs('ana1');
    const res = await ana.get('/api/analytics/top-products?period=all_time');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.products)).toBe(true);
  });

  test('GET /api/analytics/category-distribution returns categories array', async () => {
    const ana = await loginAs('ana1');
    const res = await ana.get('/api/analytics/category-distribution?period=all_time');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.categories)).toBe(true);
  });

  test('GET /api/analytics/critical-alerts returns inventory and credit alerts', async () => {
    const ana = await loginAs('ana1');
    const res = await ana.get('/api/analytics/critical-alerts');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('dead_stock');
    expect(res.body).toHaveProperty('expiry_risks');
  });

  test.failing('GET /api/analytics/suppliers-payables queries existing payables table without 500 @known-bug E-BUG-7', async () => {
    const ana = await loginAs('ana1');
    const res = await ana.get('/api/analytics/suppliers-payables');
    // Fails with 500 because supplier_payments relation does not exist
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('suppliers');
  });
});

describe('POST /api/analytics/suppliers/pay', () => {
  test.failing('processes supplier payment and writes supplier_payments row @known-bug E-BUG-7', async () => {
    const ana = await loginAs('ana1');
    const res = await ana.post('/api/analytics/suppliers/pay').send({
      supplier_id: 1,
      amount: 500,
      payment_method: 'bank_transfer',
      notes: 'Partial settlement',
    });
    // Fails with 500 because supplier_payments relation does not exist
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('rejects payment with missing or non-positive amount', async () => {
    const ana = await loginAs('ana1');
    const resMissing = await ana.post('/api/analytics/suppliers/pay').send({ supplier_id: 1 });
    expect(resMissing.status).toBe(400);

    const resZero = await ana.post('/api/analytics/suppliers/pay').send({ supplier_id: 1, amount: 0 });
    expect(resZero.status).toBe(400);

    const resNeg = await ana.post('/api/analytics/suppliers/pay').send({ supplier_id: 1, amount: -100 });
    expect(resNeg.status).toBe(400);
  });

  test.failing('non-admin cannot redirect supplier payment to another branch via body.branch_id @known-bug E-BUG-2', async () => {
    const ana = await loginAs('ana1'); // branch 1 analyst
    const res = await ana.post('/api/analytics/suppliers/pay').send({
      supplier_id: 1,
      amount: 100,
      branch_id: 2, // attempting cross-branch injection
    });
    expect(res.status).toBe(200);

    // Payment must NOT be recorded under branch 2 by a branch 1 employee
    const pay = await one('SELECT branch_id FROM supplier_payments WHERE id = $1', [res.body.payment.id]);
    expect(pay.branch_id).toBe(1);
  });
});
