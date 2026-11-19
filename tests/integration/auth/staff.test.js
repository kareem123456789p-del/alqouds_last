'use strict';
/**
 * Worker A — Staff directory (/api/staff).
 *
 * Oracle: readme.md line 721-730. GETs are "Auth + Scope"; writes are "Admin Only".
 * Golden Rule 1 (readme.md:1003) forbids trusting client-supplied branch ids.
 *
 * staffController.js has neither a permission gate nor a branch filter. The
 * spec-conformant expectations are kept as test.failing regressions (A-BUG-1..3)
 * instead of weakening the assertions to match the broken implementation.
 */
const { resetDatabase, one, q, count } = require('../../helpers/db');
const { loginAs, clearSessions } = require('../../helpers/auth');

beforeEach(async () => {
  clearSessions();
  await resetDatabase();
});
afterAll(() => clearSessions());

const BRANCH2_NAMES = /Branch Two/;

describe('GET /api/staff (documented: Auth + Scope)', () => {
  test('authenticated read returns 200 with the documented directory shape', async () => {
    const admin = await loginAs('admin');
    const res = await admin.get('/api/staff');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    for (const key of ['id', 'name', 'role', 'phone', 'email', 'status', 'base_salary']) {
      expect(res.body[0]).toHaveProperty(key);
    }
  });

  test('branch-1 employee listing never includes branch-2 staff @known-bug A-BUG-2', async () => {
    const emp = await loginAs('emp1');
    const plain = await emp.get('/api/staff');
    expect(plain.status).toBe(200);
    expect(plain.body.map(s => s.name).some(n => BRANCH2_NAMES.test(n))).toBe(false);

    // Golden Rule 1: query string and header branch overrides must be ignored.
    const spoofed = await emp.get('/api/staff?branch_id=2').set('x-branch-id', '2');
    expect(spoofed.status).toBe(200);
    expect(spoofed.body.map(s => s.name).some(n => BRANCH2_NAMES.test(n))).toBe(false);
  });

  test('GET /api/staff/:id returns the caller branch record', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/staff/6');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 6 });
    expect(res.body.name).toBe('Branch One Employee');
    expect(res.body.email).toBe('emp1@test.local');
  });

  test('branch-1 employee cannot read a branch-2 staff member: 404 @known-bug A-BUG-2', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/staff/12'); // bm2
    expect(res.status).toBe(404);
  });

  test('unknown staff id returns 404', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/staff/9999');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/staff/stats (documented: Auth + Scope)', () => {
  test('stats count only the caller branch, matching SQL COUNT(*) @known-bug A-BUG-3', async () => {
    const expected = await one(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status = 'active')::int AS active,
             COUNT(*) FILTER (WHERE status = 'leave')::int AS on_leave
      FROM staff WHERE branch_id = 1
    `);
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/staff/stats');
    expect(res.status).toBe(200);
    expect(Number(res.body.total)).toBe(expected.total);
    expect(Number(res.body.active)).toBe(expected.active);
    expect(Number(res.body.on_leave)).toBe(expected.on_leave);
  });
});

describe('/api/staff writes (documented: Admin Only)', () => {
  test('employee cannot create staff: 403 @known-bug A-BUG-1', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.post('/api/staff')
      .send({ name: 'Illegal Hire', role: 'EMPLOYEE' });
    expect(res.status).toBe(403);
  });

  test('employee cannot update a branch-2 staff member: 404 @known-bug A-BUG-1', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.put('/api/staff/12')
      .send({ name: 'Hijacked', role: 'ADMIN' });
    expect(res.status).toBe(404);
    const row = await one('SELECT name FROM staff WHERE id = 12', []);
    expect(row.name).not.toBe('Hijacked');
  });

  test('employee cannot delete a branch-2 staff member: 404 @known-bug A-BUG-1', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.delete('/api/staff/12');
    // actual: 200 { success:true }; branch-2 staff id 12 is hard-deleted.
    expect(res.status).toBe(404);
    expect(await count('staff', 'WHERE id = 12')).toBe(1);
  });

  test('admin POST /api/staff creates a directory row (DB side effect)', async () => {
    const admin = await loginAs('admin');
    const before = await count('staff');
    const res = await admin.post('/api/staff').send({
      name: 'Directory Hire', role: 'EMPLOYEE', phone: '010-9999-0001',
      email: 'hire@test.local', base_salary: 7000,
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.id).toEqual(expect.any(Number));
    expect(await count('staff')).toBe(before + 1);

    const row = await one('SELECT * FROM staff WHERE id = $1', [res.body.id]);
    expect(row).toMatchObject({
      name: 'Directory Hire', role: 'EMPLOYEE', phone: '010-9999-0001',
      email: 'hire@test.local', status: 'active',
    });
    expect(Number(row.base_salary)).toBe(7000);
  });

  test('POST /api/staff with missing name/role returns 400, not 500', async () => {
    const admin = await loginAs('admin');
    const res = await admin.post('/api/staff').send({ phone: '010-0000-0000' });
    expect(res.status).toBe(400);
  });

  test('admin PUT /api/staff/:id updates the row (DB side effect)', async () => {
    const admin = await loginAs('admin');
    const res = await admin.put('/api/staff/6').send({
      name: 'Renamed Employee', role: 'WAREHOUSE_MANAGER', phone: '010-1234-5678',
      email: 'renamed@test.local', status: 'active', base_salary: 8000,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const row = await one('SELECT * FROM staff WHERE id = 6', []);
    expect(row).toMatchObject({
      name: 'Renamed Employee', role: 'WAREHOUSE_MANAGER',
      phone: '010-1234-5678', email: 'renamed@test.local',
    });
    expect(Number(row.base_salary)).toBe(8000);
  });

  test('admin DELETE /api/staff/:id removes the row (DB side effect)', async () => {
    const admin = await loginAs('admin');
    const created = await admin.post('/api/staff')
      .send({ name: 'Temporary Hire', role: 'EMPLOYEE' });
    expect(created.status).toBe(201);

    const res = await admin.delete(`/api/staff/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(await count('staff', 'WHERE id = $1', [created.body.id])).toBe(0);
    expect((await admin.get(`/api/staff/${created.body.id}`)).status).toBe(404);
  });

  test('a newly created directory staff member has no usable login credentials', async () => {
    const admin = await loginAs('admin');
    const created = await admin.post('/api/staff')
      .send({ name: 'Credentialless', role: 'EMPLOYEE' });
    const row = await one('SELECT registration_number, password_hash FROM staff WHERE id = $1',
      [created.body.id]);
    // Implemented behaviour (README's payload omits credentials). Documented in status questions.
    expect(row.registration_number).toBeNull();
    expect(row.password_hash).toBeNull();
  });

  test('raw staff rows still match seeded fixtures after a reset', async () => {
    expect(await count('staff')).toBe(20);
    expect((await q('SELECT id, branch_id FROM staff WHERE id = 12')).length).toBe(1);
  });
});
