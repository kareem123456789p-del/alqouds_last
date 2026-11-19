'use strict';
/**
 * Worker E — Dashboard KPI Stats
 *
 * Covers:
 * - GET /api/dashboard/stats (all 6 metrics, branch scoping)
 * - registered_clients counting doctors only (E-BUG-6 / BUG-024)
 */

const { loginAs, anon } = require('../../helpers/auth');
const { resetDatabase, q, one, scalar } = require('../../helpers/db');

beforeEach(async () => {
  await resetDatabase();
});

describe('GET /api/dashboard/stats', () => {
  test('unauthenticated caller receives 401', async () => {
    const res = await anon().get('/api/dashboard/stats');
    expect(res.status).toBe(401);
  });

  test('returns branch-scoped stats that match raw database values', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/dashboard/stats');
    expect(res.status).toBe(200);

    const expectedPending = await scalar("SELECT COUNT(*) FROM orders WHERE status = 'Pending' AND branch_id = 1");
    const expectedWarehouses = await scalar("SELECT COUNT(*) FROM warehouses WHERE branch_id = 1");

    expect(Number(res.body.pending_orders)).toBe(Number(expectedPending));
    expect(Number(res.body.active_warehouses)).toBe(Number(expectedWarehouses));
    expect(res.body).toHaveProperty('dispatched_total');
    expect(res.body).toHaveProperty('inventory_total');
    expect(res.body).toHaveProperty('inventory_value');
    expect(res.body).toHaveProperty('registered_clients');
  });

  test('registered_clients includes all registered clients (both doctors and pharmacies) @known-bug E-BUG-6', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/dashboard/stats');
    expect(res.status).toBe(200);

    const docCount = Number(await scalar("SELECT COUNT(*) FROM doctors WHERE branch_id = 1"));
    const pharmCount = Number(await scalar("SELECT COUNT(*) FROM pharmacies WHERE branch_id = 1"));
    const totalClients = docCount + pharmCount;

    // The system should report the total client base (doctors + pharmacies)
    expect(Number(res.body.registered_clients)).toBe(totalClients);
  });
});
