'use strict';
/**
 * Worker D — POS / Retail domain tests: shift lifecycle + shift audit report.
 *
 * Assigned routes covered here:
 *   POST /api/retail/shifts/open
 *   GET  /api/retail/shifts/current
 *   POST /api/retail/shifts/close
 *   GET  /api/retail/shifts/:id/report
 *
 * Spec (readme.md §8.3): one open shift per branch; cashier must open a shift
 * before recording sales; shift report is the comprehensive audit document.
 */

const { resetDatabase, q, one, scalar, count, stockSum, warehouseStock, productRow, clientLedgerSum, clientDebt, supplierBalance } = require('../../helpers/db');
const { anon, loginAs, loginAsRole, clearSessions } = require('../../helpers/auth');

beforeEach(async () => {
  await resetDatabase();
});

afterAll(() => {
  clearSessions();
});

describe('GET /api/retail/shifts/current', () => {
  test('unauthenticated caller receives 401', async () => {
    const res = await anon().get('/api/retail/shifts/current');
    expect(res.status).toBe(401);
  });

  test('returns { shift: null } when the branch has no open shift', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/retail/shifts/current');
    expect(res.status).toBe(200);
    expect(res.body.shift).toBeNull();
  });
});

describe('POST /api/retail/shifts/open', () => {
  test('unauthenticated caller receives 401', async () => {
    const res = await anon().post('/api/retail/shifts/open');
    expect(res.status).toBe(401);
  });

  test('branch cashier opens a shift and current returns it', async () => {
    const pos = await loginAs('pos1');
    const opened = await pos.post('/api/retail/shifts/open');
    expect(opened.status).toBe(200);
    expect(opened.body.success).toBe(true);
    expect(opened.body.shift_id).toEqual(expect.any(Number));

    const cur = await pos.get('/api/retail/shifts/current');
    expect(cur.status).toBe(200);
    expect(cur.body.shift).not.toBeNull();
    expect(cur.body.shift.status).toBe('OPEN');
    expect(Number(cur.body.shift.branch_id)).toBe(1);
  });

  test('refuses a second open shift in the same branch', async () => {
    const pos = await loginAs('pos1');
    const first = await pos.post('/api/retail/shifts/open');
    expect(first.status).toBe(200);
    const second = await pos.post('/api/retail/shifts/open');
    expect(second.status).toBe(400);

    const cur = await pos.get('/api/retail/shifts/current');
    expect(Number(cur.body.shift.id)).toBe(Number(first.body.shift_id));
  });

  test('branch 2 cashier has its own open shift scope', async () => {
    const pos1 = await loginAs('pos1');
    const pos2 = await loginAs('pos2');
    const s1 = await pos1.post('/api/retail/shifts/open');
    const s2 = await pos2.post('/api/retail/shifts/open');
    expect(s1.status).toBe(200);
    expect(s2.status).toBe(200);

    const cur1 = await pos1.get('/api/retail/shifts/current');
    expect(Number(cur1.body.shift.id)).toBe(Number(s1.body.shift_id));

    const cur2 = await pos2.get('/api/retail/shifts/current');
    expect(Number(cur2.body.shift.id)).toBe(Number(s2.body.shift_id));
  });
});

describe('POST /api/retail/shifts/close', () => {
  test('unauthenticated caller receives 401', async () => {
    const res = await anon().post('/api/retail/shifts/close');
    expect(res.status).toBe(401);
  });

  test('closes the branch open shift', async () => {
    const pos = await loginAs('pos1');
    const opened = await pos.post('/api/retail/shifts/open');
    expect(opened.status).toBe(200);

    const closed = await pos.post('/api/retail/shifts/close');
    expect(closed.status).toBe(200);
    expect(closed.body.success).toBe(true);
    expect(closed.body.shift_id).toEqual(expect.any(Number));

    const cur = await pos.get('/api/retail/shifts/current');
    expect(cur.status).toBe(200);
    expect(cur.body.shift).toBeNull();
  });

  test('rejects closing when no shift is open', async () => {
    const pos = await loginAs('pos1');
    const res = await pos.post('/api/retail/shifts/close');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/retail/shifts/:id/report', () => {
  test('unauthenticated caller receives 401', async () => {
    const res = await anon().get('/api/retail/shifts/1/report');
    expect(res.status).toBe(401);
  });

  test('reports an open shift with zero sales', async () => {
    const pos = await loginAs('pos1');
    const opened = await pos.post('/api/retail/shifts/open');
    const res = await pos.get(`/api/retail/shifts/${opened.body.shift_id}/report`);
    expect(res.status).toBe(200);
    expect(res.body.shift).toBeDefined();
    expect(res.body.sales_count).toBe(0);
    expect(Number(res.body.total_revenue)).toBe(0);
    expect(Number(res.body.total_profit)).toBe(0);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items).toHaveLength(0);
  });

  test.failing('GET /api/retail/shifts/:id/report must 404 a shift from another branch @known-bug D-BUG-3', async () => {
    const pos1 = await loginAs('pos1');
    const pos2 = await loginAs('pos2');
    const s1 = await pos1.post('/api/retail/shifts/open');
    const s2 = await pos2.post('/api/retail/shifts/open');
    expect(s1.status).toBe(200);
    expect(s2.status).toBe(200);

    const emp1 = await loginAs('emp1');
    const res = await emp1.get(`/api/retail/shifts/${s2.body.shift_id}/report`);
    expect(res.status).toBe(404);
  });
});
