'use strict';
/**
 * Worker A — RBAC.
 *
 * Oracle: readme.md §Role Hierarchy (163-172), route tables at 590, 692-707,
 * 721-730, 749-757. Permission gates must be enforced server-side, not in the UI.
 */
const { resetDatabase, one, count, q } = require('../../helpers/db');
const { loginAs, clearSessions } = require('../../helpers/auth');

beforeEach(async () => {
  clearSessions();
  await resetDatabase();
});
afterAll(() => clearSessions());

describe('/api/admin/* is Admin Only', () => {
  test('employee gets 403 on GET /api/admin/branches', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/admin/branches');
    expect(res.status).toBe(403);
  });

  test('employee gets 403 on GET /api/admin/permissions', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/admin/permissions');
    expect(res.status).toBe(403);
  });

  test('employee gets 403 on GET /api/admin/staff', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/admin/staff');
    expect(res.status).toBe(403);
  });

  test('employee cannot POST or PUT /api/admin/staff', async () => {
    const emp = await loginAs('emp1');
    expect((await emp.post('/api/admin/staff').send({
      name: 'X', registration_number: 'x', password: 'Passw0rd!', role: 'BRANCH_MANAGER',
    })).status).toBe(403);
    expect((await emp.put('/api/admin/staff/1').send({
      name: 'X', registration_number: 'admin', role: 'ADMIN',
    })).status).toBe(403);
  });

  test('admin gets 200 on the three admin GET routes with documented shapes', async () => {
    const admin = await loginAs('admin');
    const branches = await admin.get('/api/admin/branches');
    expect(branches.status).toBe(200);
    expect(Array.isArray(branches.body)).toBe(true);
    expect(branches.body.map(b => b.id)).toEqual([1, 2]);

    const permissions = await admin.get('/api/admin/permissions');
    expect(permissions.status).toBe(200);
    expect(permissions.body.success).toBe(true);
    expect(Array.isArray(permissions.body.permissions)).toBe(true);
    expect(permissions.body.permissions.some(p => p.key === 'CREATE_DOCTOR')).toBe(true);

    const staff = await admin.get('/api/admin/staff');
    expect(staff.status).toBe(200);
    expect(staff.body.success).toBe(true);
    expect(Array.isArray(staff.body.staff)).toBe(true);
    expect(staff.body.staff[0]).toHaveProperty('permissions');
    expect(staff.body.staff[0]).toHaveProperty('branch_name');
  });

  test('superadmin gets 200 on all three admin GET routes', async () => {
    const superadmin = await loginAs('superadmin');
    for (const path of ['/api/admin/branches', '/api/admin/permissions', '/api/admin/staff']) {
      expect((await superadmin.get(path)).status).toBe(200);
    }
  });
});

describe('POST /api/admin/staff', () => {
  test('valid payload creates a hashed user account and permissions (DB side effect)', async () => {
    const admin = await loginAs('admin');
    const res = await admin.post('/api/admin/staff').send({
      name: 'New Manager', registration_number: 'newmgr', password: 'Passw0rd!',
      role: 'BRANCH_MANAGER', branch_id: 2, permissions: ['CREATE_DOCTOR'],
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.id).toEqual(expect.any(Number));

    const row = await one('SELECT * FROM staff WHERE id = $1', [res.body.id]);
    expect(row).toMatchObject({
      name: 'New Manager', registration_number: 'newmgr', role: 'BRANCH_MANAGER',
      branch_id: 2, status: 'active',
    });
    expect(row.password_hash).toMatch(/^\$2[aby]\$/); // bcrypt, never plain text
    expect(row.password_hash).not.toBe('Passw0rd!');
    expect(await count('staff_permissions', 'WHERE staff_id = $1', [res.body.id])).toBe(1);
    expect((await q('SELECT permission_key FROM staff_permissions WHERE staff_id = $1', [res.body.id]))
      .map(p => p.permission_key)).toEqual(['CREATE_DOCTOR']);
  });

  test('missing required fields return 400', async () => {
    const admin = await loginAs('admin');
    const res = await admin.post('/api/admin/staff').send({ name: 'Incomplete' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('a role outside the allow-list returns 400', async () => {
    const admin = await loginAs('admin');
    const res = await admin.post('/api/admin/staff').send({
      name: 'Bad Role', registration_number: 'badrole', password: 'Passw0rd!', role: 'PIRATE',
    });
    expect(res.status).toBe(400);
  });

  test('duplicate registration number returns 400', async () => {
    const admin = await loginAs('admin');
    const res = await admin.post('/api/admin/staff').send({
      name: 'Duplicate', registration_number: 'admin', password: 'Passw0rd!', role: 'BRANCH_MANAGER',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/i);
  });
});

describe('PUT /api/admin/staff/:id', () => {
  test('valid payload updates the account and replaces its permissions in the DB', async () => {
    const admin = await loginAs('admin');
    const res = await admin.put('/api/admin/staff/7').send({
      name: 'Collector Two', registration_number: 'coll1-new', password: 'NewPass1!',
      role: 'DEPUTY_MANAGER', branch_id: 2, status: 'active',
      permissions: ['can_manage_collections', 'reports_view'],
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const row = await one('SELECT * FROM staff WHERE id = 7', []);
    expect(row).toMatchObject({
      name: 'Collector Two', registration_number: 'coll1-new',
      role: 'DEPUTY_MANAGER', branch_id: 2, status: 'active',
    });
    const perms = (await q('SELECT permission_key FROM staff_permissions WHERE staff_id = 7 ORDER BY permission_key'))
      .map(p => p.permission_key);
    expect(perms).toEqual(['can_manage_collections', 'reports_view']);
  });

  test('invalid role returns 400 and leaves the row untouched', async () => {
    const admin = await loginAs('admin');
    const res = await admin.put('/api/admin/staff/7').send({
      name: 'Should Not Apply', registration_number: 'coll1', role: 'PIRATE',
    });
    expect(res.status).toBe(400);
    const row = await one('SELECT name FROM staff WHERE id = 7', []);
    expect(row.name).toBe('Branch One Collector');
  });
});

describe('doctor & pharmacy write gates are server-side', () => {
  test('employee without permissions gets 403 on all four write routes', async () => {
    const emp = await loginAs('emp1');
    expect((await emp.post('/api/doctors').send({ name: 'X', specialty: 'Y' })).status).toBe(403);
    expect((await emp.put('/api/doctors/1').send({ name: 'X', specialty: 'Y' })).status).toBe(403);
    expect((await emp.delete('/api/doctors/1')).status).toBe(403);
    expect((await emp.post('/api/pharmacies').send({ name: 'X', area: 'Y' })).status).toBe(403);
    expect((await emp.put('/api/pharmacies/1').send({ name: 'X', area: 'Y' })).status).toBe(403);
    expect((await emp.delete('/api/pharmacies/1')).status).toBe(403);
  });

  test('CRM permission holder can create, but cannot target branch 2 via the body', async () => {
    const crm = await loginAs('crm1');
    const created = await crm.post('/api/doctors').send({
      name: 'CRM Doctor', specialty: 'GP', branch_id: 2,
    });
    expect(created.status).toBe(201);
    const row = await one('SELECT * FROM doctors WHERE id = $1', [created.body.doctor.id]);
    expect(row.branch_id).toBe(1); // Golden Rule 1: client-supplied branch is ignored
    expect(Number(row.credit_limit)).toBe(60000);

    const pharm = await crm.post('/api/pharmacies').send({
      name: 'CRM Pharmacy', area: 'Nasr City', branch_id: 2,
    });
    expect(pharm.status).toBe(201);
    const prow = await one('SELECT * FROM pharmacies WHERE id = $1', [pharm.body.id]);
    expect(prow.branch_id).toBe(1);
  });
});
