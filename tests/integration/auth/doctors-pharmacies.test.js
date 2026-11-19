'use strict';
/**
 * Worker A — Doctors & Pharmacies CRM (readme.md route table lines 692-707).
 *
 * Reads are Auth + Scope, writes require CREATE_/EDIT_/DELETE_ permission.
 * Non-admin branch overrides must be ignored (Golden Rule 1).
 */
const { resetDatabase, one, q, count } = require('../../helpers/db');
const { loginAs, clearSessions } = require('../../helpers/auth');

beforeEach(async () => {
  clearSessions();
  await resetDatabase();
});
afterAll(() => clearSessions());

describe('GET /api/doctors', () => {
  test('branch-1 employee sees only branch-1 doctors', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/doctors');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.map(d => d.id).sort()).toEqual([1, 2, 3]);
    expect(res.body.every(d => d.branch_id === 1)).toBe(true);
    expect(res.body[0]).toHaveProperty('specialty');
    expect(res.body[0]).toHaveProperty('credit_limit');
  });

  test('?branch_id=2 and x-branch-id:2 are ignored for a branch-1 employee', async () => {
    const emp = await loginAs('emp1');
    expect((await emp.get('/api/doctors?branch_id=2')).body.map(d => d.id).sort()).toEqual([1, 2, 3]);
    expect((await emp.get('/api/doctors').set('x-branch-id', '2')).body.map(d => d.id).sort())
      .toEqual([1, 2, 3]);
  });

  test('admin may select branch 2 explicitly', async () => {
    const admin = await loginAs('admin');
    const res = await admin.get('/api/doctors?branch_id=2');
    expect(res.status).toBe(200);
    expect(res.body.map(d => d.id)).toEqual([4]);
    expect(res.body[0].branch_id).toBe(2);
  });
});

describe('GET /api/doctors/:id', () => {
  test('branch-1 doctor detail returns 200', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/doctors/1');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 1, name: 'Dr. Ahmed Nour', specialty: 'General Practice' });
  });

  test('branch-2 doctor detail returns 404 for a branch-1 user', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/doctors/4');
    expect(res.status).toBe(404);
  });

  test('unknown doctor id returns 404', async () => {
    const emp = await loginAs('emp1');
    expect((await emp.get('/api/doctors/9999')).status).toBe(404);
  });
});

describe('GET /api/doctors/:id/transactions', () => {
  test('seeded doctor returns 200 with the documented profile shape', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/doctors/1/transactions');
    expect(res.status).toBe(200);
    expect(res.body.doctor).toMatchObject({ id: 1, name: 'Dr. Ahmed Nour' });
    expect(res.body).toHaveProperty('total_transactions_count');
    expect(res.body).toHaveProperty('total_outstanding_balance');
    expect(Array.isArray(res.body.monthGroups)).toBe(true);
    expect(res.body.total_transactions_count).toBe(0);
  });

  test('branch-2 doctor and unknown id return 404 for a branch-1 user', async () => {
    const emp = await loginAs('emp1');
    expect((await emp.get('/api/doctors/4/transactions')).status).toBe(404);
    expect((await emp.get('/api/doctors/9999/transactions')).status).toBe(404);
  });
});

describe('GET /api/doctors/:id/orders', () => {
  test('seeded doctor with an order returns 200 with order rows', async () => {
    await q(`INSERT INTO orders (order_number, client_id, total_amount, status, branch_id)
             VALUES ('QA-DOC-ORDER-1', 1, 125.50, 'Pending', 1)`);
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/doctors/1/orders');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const order = res.body.find(o => o.order_number === 'QA-DOC-ORDER-1');
    expect(order).toBeDefined();
    expect(order).toHaveProperty('id');
    expect(order).toHaveProperty('status');
    expect(order).toHaveProperty('created_at');
    expect(order).toHaveProperty('main_item_name');
    expect(Number(order.total_amount)).toBeCloseTo(125.5, 2);
  });

  test.failing('branch-2 doctor orders return 404 for a branch-1 user @known-bug A-BUG-4', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/doctors/4/orders');
    // actual: 200 [] — the handler never checks that the doctor exists in scope.
    expect(res.status).toBe(404);
  });

  test.failing('unknown doctor id orders return 404, not 200 @known-bug A-BUG-4', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/doctors/9999/orders');
    // actual: 200 [] — no existence check; an enumeration oracle is missing.
    expect(res.status).toBe(404);
  });
});

describe('Doctor writes', () => {
  test('employee without CREATE_DOCTOR gets 403', async () => {
    const emp = await loginAs('emp1');
    expect((await emp.post('/api/doctors').send({ name: 'X', specialty: 'Y' })).status).toBe(403);
  });

  test('missing name or specialty returns 400, not 500', async () => {
    const crm = await loginAs('crm1');
    expect((await crm.post('/api/doctors').send({ specialty: 'GP' })).status).toBe(400);
    expect((await crm.post('/api/doctors').send({ name: 'No Specialty' })).status).toBe(400);
  });

  test('valid create returns 201, lands in branch 1 and defaults credit_limit to 60000', async () => {
    const crm = await loginAs('crm1');
    const res = await crm.post('/api/doctors').send({
      name: 'Dr. New', specialty: 'General Practice', phone: '010-5555-0001',
      location: 'Aswan', branch_id: 2,
    });
    expect(res.status).toBe(201);
    expect(res.body.doctor).toHaveProperty('id');
    expect(res.body.doctor.name).toBe('Dr. New');

    const row = await one('SELECT * FROM doctors WHERE id = $1', [res.body.doctor.id]);
    expect(row.branch_id).toBe(1);
    expect(Number(row.credit_limit)).toBe(60000);
    expect(row.specialty).toBe('General Practice');
  });

  test('update round-trip changes the database row, branch 2 stays protected', async () => {
    const crm = await loginAs('crm1');
    const ok = await crm.put('/api/doctors/1').send({
      name: 'Dr. Ahmed Updated', specialty: 'Internal Medicine', phone: '010-1000-0099',
      status: 'active', location: 'Cairo', credit_limit: 45000,
    });
    expect(ok.status).toBe(200);
    expect(ok.body.doctor.name).toBe('Dr. Ahmed Updated');
    const row = await one('SELECT * FROM doctors WHERE id = 1', []);
    expect(row.name).toBe('Dr. Ahmed Updated');
    expect(row.specialty).toBe('Internal Medicine');
    expect(Number(row.credit_limit)).toBe(45000);

    expect((await crm.put('/api/doctors/4').send({
      name: 'Hijack', specialty: 'GP',
    })).status).toBe(404);
    const untouched = await one('SELECT name FROM doctors WHERE id = 4', []);
    expect(untouched.name).toBe('Dr. Hana Youssef');
  });

  test('delete round-trip: a doctor with no orders is removed and a follow-up GET is 404', async () => {
    const crm = await loginAs('crm1');
    const created = await crm.post('/api/doctors')
      .send({ name: 'Temporary Doctor', specialty: 'GP' });
    expect(created.status).toBe(201);
    const id = created.body.doctor.id;

    expect((await crm.delete(`/api/doctors/${id}`)).status).toBe(200);
    expect(await count('doctors', 'WHERE id = $1', [id])).toBe(0);
    expect((await crm.get(`/api/doctors/${id}`)).status).toBe(404);
  });

  test('branch-2 doctor cannot be deleted by a branch-1 CRM user', async () => {
    const crm = await loginAs('crm1');
    expect((await crm.delete('/api/doctors/4')).status).toBe(404);
    expect(await count('doctors', 'WHERE id = 4')).toBe(1);
  });
});

describe('GET /api/pharmacies', () => {
  test('branch-1 employee sees only branch-1 pharmacies', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/api/pharmacies');
    expect(res.status).toBe(200);
    expect(res.body.map(p => p.id).sort()).toEqual([1, 2, 3]);
    expect(res.body[0]).toHaveProperty('license_number');
    expect(res.body[0]).toHaveProperty('credit_limit');
  });

  test('client branch overrides are ignored for non-admins, honoured for admins', async () => {
    const emp = await loginAs('emp1');
    expect((await emp.get('/api/pharmacies?branch_id=2')).body.map(p => p.id).sort()).toEqual([1, 2, 3]);
    expect((await emp.get('/api/pharmacies').set('x-branch-id', '2')).body.map(p => p.id).sort())
      .toEqual([1, 2, 3]);

    const admin = await loginAs('admin');
    expect((await admin.get('/api/pharmacies?branch_id=2')).body.map(p => p.id)).toEqual([4]);
  });
});

describe('GET /api/pharmacies/:id', () => {
  test('branch-1 pharmacy returns 200; branch-2 and unknown return 404', async () => {
    const emp = await loginAs('emp1');
    const ok = await emp.get('/api/pharmacies/1');
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ id: 1, name: 'Al-Shifa Pharmacy', area: 'Maadi' });
    expect((await emp.get('/api/pharmacies/4')).status).toBe(404);
    expect((await emp.get('/api/pharmacies/9999')).status).toBe(404);
  });
});

describe('Pharmacy writes', () => {
  test('employee without CREATE_PHARMACY gets 403', async () => {
    const emp = await loginAs('emp1');
    expect((await emp.post('/api/pharmacies').send({ name: 'X', area: 'Y' })).status).toBe(403);
  });

  test('missing required name/area returns 400, not 500', async () => {
    const crm = await loginAs('crm1');
    const missingName = await crm.post('/api/pharmacies').send({ area: 'Maadi' });
    expect(missingName.status).toBe(400);
    const missingArea = await crm.post('/api/pharmacies').send({ name: 'No Area' });
    expect(missingArea.status).toBe(400);
    expect(missingArea.body.error).toMatch(/area/i);
  });

  test('valid create returns 201, lands in branch 1 with documented defaults', async () => {
    const crm = await loginAs('crm1');
    const res = await crm.post('/api/pharmacies').send({
      name: 'New Pharmacy', contact_person: 'Test Contact', area: 'Nasr City',
      phone: '02-0000-0000', branch_id: 2,
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.id).toEqual(expect.any(Number));

    const row = await one('SELECT * FROM pharmacies WHERE id = $1', [res.body.id]);
    expect(row).toMatchObject({
      name: 'New Pharmacy', contact_person: 'Test Contact', area: 'Nasr City', branch_id: 1,
    });
    expect(Number(row.credit_limit)).toBe(20000);
    expect(Number(row.total_debt)).toBe(0);
  });

  test('update round-trip changes the database row; branch 2 stays protected', async () => {
    const crm = await loginAs('crm1');
    const ok = await crm.put('/api/pharmacies/1').send({
      name: 'Al-Shifa Updated', contact_person: 'New Contact', area: 'Giza',
      phone: '02-1111-0000', status: 'active', credit_limit: 25000,
    });
    expect(ok.status).toBe(200);
    const row = await one('SELECT * FROM pharmacies WHERE id = 1', []);
    expect(row.name).toBe('Al-Shifa Updated');
    expect(row.area).toBe('Giza');
    expect(Number(row.credit_limit)).toBe(25000);

    // A cross-branch update is a silent no-op on the database (see A-BUG-7 for
    // the wrong 200 response status).
    expect((await one('SELECT name FROM pharmacies WHERE id = 4', [])).name).toBe('Cairo Care Pharmacy');
  });

  test.failing('branch-2 pharmacy update returns 404 for a branch-1 CRM user @known-bug A-BUG-7', async () => {
    const crm = await loginAs('crm1');
    const res = await crm.put('/api/pharmacies/4').send({ name: 'Hijack', area: 'Cairo' });
    // actual: 200 { success:true } even though zero rows matched the branch filter.
    expect(res.status).toBe(404);
  });

  test('delete round-trip removes the row; branch 2 stays protected', async () => {
    const crm = await loginAs('crm1');
    const created = await crm.post('/api/pharmacies')
      .send({ name: 'Temporary Pharmacy', area: 'Aswan' });
    expect(created.status).toBe(201);
    expect((await crm.delete(`/api/pharmacies/${created.body.id}`)).status).toBe(200);
    expect(await count('pharmacies', 'WHERE id = $1', [created.body.id])).toBe(0);
    expect((await crm.get(`/api/pharmacies/${created.body.id}`)).status).toBe(404);

    // Cross-branch delete is a silent no-op on the database (wrong status: A-BUG-7).
    expect(await count('pharmacies', 'WHERE id = 4')).toBe(1);
  });

  test.failing('branch-2 pharmacy delete returns 404 for a branch-1 CRM user @known-bug A-BUG-7', async () => {
    const crm = await loginAs('crm1');
    const res = await crm.delete('/api/pharmacies/4');
    // actual: 200 { success:true } even though zero rows matched the branch filter.
    expect(res.status).toBe(404);
  });
});
