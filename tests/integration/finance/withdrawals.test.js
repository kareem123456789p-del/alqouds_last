'use strict';
/**
 * Worker C — Staff Salary Withdrawals & Advances
 *
 * Covers:
 * - POST /api/withdrawals (50% salary threshold alert, monthly totals)
 * - Input validation & Negative amount bug (C-BUG-9)
 * - Branch isolation & Cross-branch staff lookup bug (C-BUG-8)
 * - GET /api/withdrawals (running totals, high-ratio flag)
 * - GET /api/withdrawals/stats (monthly totals, alerts)
 */

const { loginAs } = require('../../helpers/auth');
const { resetDatabase, q, one, scalar } = require('../../helpers/db');

beforeEach(async () => {
  await resetDatabase();
});

describe('POST /api/withdrawals', () => {
  test('creates withdrawal, tracks monthly sum, flags when exceeding 50% salary threshold', async () => {
    const emp = await loginAs('emp1');

    // Salary1 (id 20) has base_salary 10000
    // Withdrawal 1: 4000 (40% <= 50% -> is_high_ratio: false)
    const res1 = await emp.post('/api/withdrawals').send({
      staff_id: 20,
      amount: 4000,
      reason: 'Personal advance',
      category: 'Advance',
    });
    expect(res1.status).toBe(201);
    expect(res1.body.success).toBe(true);
    expect(res1.body.is_high_ratio).toBe(false);
    expect(Number(res1.body.new_monthly_total)).toBe(4000);

    // Withdrawal 2: 1500 (total 5500 > 5000 -> is_high_ratio: true)
    const res2 = await emp.post('/api/withdrawals').send({
      staff_id: 20,
      amount: 1500,
      reason: 'Emergency advance',
      category: 'Medical',
    });
    expect(res2.status).toBe(201);
    expect(res2.body.is_high_ratio).toBe(true);
    expect(Number(res2.body.new_monthly_total)).toBe(5500);

    // Verify database entries
    const rows = await q('SELECT * FROM employee_withdrawals WHERE staff_id = 20 ORDER BY id ASC');
    expect(rows).toHaveLength(2);
    expect(Number(rows[0].amount)).toBe(4000);
    expect(Number(rows[1].amount)).toBe(1500);
  });

  test('rejects request with missing required fields', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.post('/api/withdrawals').send({ staff_id: 20 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  test('rejects request for nonexistent staff member with 404', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.post('/api/withdrawals').send({
      staff_id: 9999,
      amount: 500,
      reason: 'Advance',
    });
    expect(res.status).toBe(404);
  });

  test('rejects negative withdrawal amount with 400 @known-bug C-BUG-9', async () => {
    const emp = await loginAs('emp1');
    // Negative withdrawal should be rejected with 400, but code only checks !amount
    const res = await emp.post('/api/withdrawals').send({
      staff_id: 20,
      amount: -1000,
      reason: 'Negative test',
    });
    expect(res.status).toBe(400);
  });

  test('rejects creating a withdrawal for staff belonging to another branch @known-bug C-BUG-8', async () => {
    const emp = await loginAs('emp1'); // branch 1
    // Staff id 12 (Branch Two Manager) belongs to branch 2
    const res = await emp.post('/api/withdrawals').send({
      staff_id: 12,
      amount: 500,
      reason: 'Cross branch advance',
    });
    expect([400, 403, 404]).toContain(res.status);
  });
});

describe('GET /api/withdrawals & /stats', () => {
  beforeEach(async () => {
    const emp1 = await loginAs('emp1');
    await emp1.post('/api/withdrawals').send({
      staff_id: 20,
      amount: 6000,
      reason: 'High advance',
    });
  });

  test('GET /api/withdrawals returns running totals and high ratio flag', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/withdrawals');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);

    const w = res.body.find((item) => item.staff_id === 20);
    expect(w).toBeDefined();
    expect(Number(w.running_total)).toBe(6000);
    expect(w.is_high_ratio).toBe(true);
  });

  test('GET /api/withdrawals/stats returns monthly totals and alerts list', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/withdrawals/stats');
    expect(res.status).toBe(200);
    expect(Number(res.body.monthly_total)).toBeGreaterThanOrEqual(6000);
    expect(res.body.alerts).toBeDefined();
    expect(Array.isArray(res.body.alerts)).toBe(true);
  });
});
