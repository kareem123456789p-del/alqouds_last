'use strict';
/**
 * Worker A — Authentication & session lifecycle.
 *
 * Oracle: readme.md §Authentication (lines 138-182) and the route table at line 590.
 * Sessions are in-memory, keyed by a 64-hex cookie token; /check re-reads role and
 * permissions live from the database; switch-branch is admin-only.
 */
const { resetDatabase, q } = require('../../helpers/db');
const { anon, loginAs, request, app, clearSessions } = require('../../helpers/auth');

beforeEach(async () => {
  clearSessions();
  await resetDatabase();
});
afterAll(() => clearSessions());

describe('POST /api/auth/login', () => {
  test('valid credentials return 200, hide password_hash and set a 64-hex HttpOnly cookie', async () => {
    const res = await anon().post('/api/auth/login')
      .send({ registration_number: 'admin', password: 'Passw0rd!' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      role: 'ADMIN',
      redirect: '/dashboard',
    });
    expect(res.body).not.toHaveProperty('password_hash');
    expect(JSON.stringify(res.body)).not.toMatch(/password_hash/);

    const cookies = res.headers['set-cookie'] || [];
    const sessionCookie = cookies.find(c => c.startsWith('session_token='));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toMatch(/^session_token=[0-9a-f]{64};/);
    expect(sessionCookie).toMatch(/HttpOnly/i);
    expect(sessionCookie).toMatch(/SameSite=Lax/i);
    expect(sessionCookie).toMatch(/Max-Age=86400/); // 24h default (readme.md:149)
  });

  test('remember extends the cookie lifetime to 7 days', async () => {
    const res = await anon().post('/api/auth/login')
      .send({ registration_number: 'admin', password: 'Passw0rd!', remember: true });
    expect(res.status).toBe(200);
    const cookie = (res.headers['set-cookie'] || []).find(c => c.startsWith('session_token='));
    expect(cookie).toMatch(/Max-Age=604800/); // 7 days (readme.md:149)
  });

  test('wrong password returns 401, not 500', async () => {
    const res = await anon().post('/api/auth/login')
      .send({ registration_number: 'admin', password: 'not-the-password' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('unknown registration number returns 401, not 500', async () => {
    const res = await anon().post('/api/auth/login')
      .send({ registration_number: 'does-not-exist', password: 'Passw0rd!' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('missing credentials return 400, not 500', async () => {
    const empty = await anon().post('/api/auth/login').send({});
    expect(empty.status).toBe(400);
    expect(empty.body.success).toBe(false);

    const noPassword = await anon().post('/api/auth/login').send({ registration_number: 'admin' });
    expect(noPassword.status).toBe(400);
  });

  test.failing('a staff member whose status is not active cannot log in @known-bug A-BUG-5', async () => {
    // readme.md §Authentication + worker brief: inactive users must be rejected.
    await q("UPDATE staff SET status = 'leave' WHERE registration_number = 'emp1'");
    const res = await anon().post('/api/auth/login')
      .send({ registration_number: 'emp1', password: 'Passw0rd!' });
    // actual: 200 with a valid session — login never checks staff.status.
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/check and GET /api/auth/me', () => {
  test('anonymous /check and /me return 401 authenticated:false', async () => {
    const check = await anon().get('/api/auth/check');
    expect(check.status).toBe(401);
    expect(check.body).toMatchObject({ authenticated: false });

    const me = await anon().get('/api/auth/me');
    expect(me.status).toBe(401);
    expect(me.body).toMatchObject({ authenticated: false });
  });

  test('authenticated /check reports id, role, branch and a permissions array', async () => {
    const admin = await loginAs('admin');
    const res = await admin.get('/api/auth/check');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      authenticated: true,
      userId: 1,
      registration_number: 'admin',
      role: 'ADMIN',
      assigned_branch_id: 1,
      active_branch_id: 1,
    });
    expect(Array.isArray(res.body.permissions)).toBe(true);
    expect(res.body).not.toHaveProperty('password_hash');
  });

  test('/me mirrors /check', async () => {
    const crm = await loginAs('crm1');
    const check = await crm.get('/api/auth/check');
    const me = await crm.get('/api/auth/me');
    expect(check.status).toBe(200);
    expect(me.status).toBe(200);
    for (const key of ['authenticated', 'userId', 'registration_number', 'role',
      'assigned_branch_id', 'active_branch_id']) {
      expect(me.body[key]).toEqual(check.body[key]);
    }
    expect(me.body.permissions).toEqual(expect.arrayContaining(['CREATE_DOCTOR', 'DELETE_PHARMACY']));
  });

  test('/check re-reads permissions live from staff_permissions', async () => {
    const crm = await loginAs('crm1');
    const before = await crm.get('/api/auth/check');
    expect(before.body.permissions).toContain('CREATE_DOCTOR');

    await q("DELETE FROM staff_permissions WHERE staff_id = 9 AND permission_key = 'CREATE_DOCTOR'");
    const after = await crm.get('/api/auth/check');
    expect(after.status).toBe(200);
    expect(after.body.permissions).not.toContain('CREATE_DOCTOR');
  });
});

describe('POST /api/auth/logout', () => {
  test('logout invalidates the session; a second logout is safe', async () => {
    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login')
      .send({ registration_number: 'emp1', password: 'Passw0rd!' });
    expect(login.status).toBe(200);
    expect((await agent.get('/api/auth/check')).status).toBe(200);

    const logout = await agent.post('/api/auth/logout');
    expect(logout.status).toBe(200);
    expect(logout.body.success).toBe(true);
    expect((await agent.get('/api/auth/check')).status).toBe(401);

    const again = await agent.post('/api/auth/logout');
    expect(again.status).toBe(200);
  });
});

describe('POST /api/auth/refresh-permissions', () => {
  test('anonymous refresh returns 401', async () => {
    const res = await anon().post('/api/auth/refresh-permissions').send({});
    expect(res.status).toBe(401);
  });

  test('refresh reflects a live DB revoke and immediately changes authorization', async () => {
    const crm = await loginAs('crm1');
    expect((await crm.get('/api/auth/check')).body.permissions).toContain('CREATE_DOCTOR');

    await q("DELETE FROM staff_permissions WHERE staff_id = 9 AND permission_key = 'CREATE_DOCTOR'");
    const refreshed = await crm.post('/api/auth/refresh-permissions').send({});
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.success).toBe(true);
    expect(refreshed.body.permissions).not.toContain('CREATE_DOCTOR');
    expect((await crm.get('/api/auth/check')).body.permissions).not.toContain('CREATE_DOCTOR');

    const denied = await crm.post('/api/doctors').send({ name: 'Post-Revoke', specialty: 'GP' });
    expect(denied.status).toBe(403);
  });
});

describe('POST /api/auth/switch-branch', () => {
  test('employee is refused with 403', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.post('/api/auth/switch-branch').send({ branch_id: 2 });
    expect(res.status).toBe(403);
    expect((await emp.get('/api/auth/check')).body.active_branch_id).toBe(1);
  });

  test('missing branch_id returns 400', async () => {
    const admin = await loginAs('admin');
    const res = await admin.post('/api/auth/switch-branch').send({});
    expect(res.status).toBe(400);
  });

  test('a non-existent branch_id returns a 4xx client error (never 500)', async () => {
    const admin = await loginAs('admin');
    const res = await admin.post('/api/auth/switch-branch').send({ branch_id: 999 });
    // README's route table does not pin 400 vs 404 for an unknown id; the
    // implementation answers 404. Either is a client error; see status questions.
    expect([400, 404]).toContain(res.status);
    expect((await admin.get('/api/auth/check')).body.active_branch_id).toBe(1);
  });

  test.failing('a malformed branch_id returns 400, not a 500 @known-bug A-BUG-6', async () => {
    const admin = await loginAs('admin');
    const res = await admin.post('/api/auth/switch-branch').send({ branch_id: 'abc' });
    // actual: 500 — Postgres 22P02 from `WHERE id = 'abc'` escapes the handler.
    expect(res.status).toBe(400);
  });

  test('admin switch to branch 2 changes subsequent branch-scoped reads', async () => {
    const admin = await loginAs('admin');
    expect((await admin.get('/api/doctors')).body.map(d => d.id)).toEqual([1, 2, 3]);

    const switched = await admin.post('/api/auth/switch-branch').send({ branch_id: 2 });
    expect(switched.status).toBe(200);
    expect(switched.body.active_branch_id).toBe(2);
    expect((await admin.get('/api/auth/check')).body.active_branch_id).toBe(2);

    expect((await admin.get('/api/doctors')).body.map(d => d.id)).toEqual([4]);
    expect((await admin.get('/api/pharmacies')).body.map(p => p.id)).toEqual([4]);
  });
});
