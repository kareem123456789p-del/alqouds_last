'use strict';
/**
 * Worker E — Frontend Pages & Server-Side RBAC Guards
 *
 * Covers:
 * - Anonymous access: /login.html, static assets, 302 redirects for HTML pages
 * - Operational HTML pages (all 19 pages)
 * - /pos and /pos.html aliases
 * - /dashboard protection (requireAdmin)
 * - /dashboard.html unprotected static access (E-BUG-4 / BUG-014)
 * - Root / redirect for Admin and SUPER ADMIN (E-BUG-3 / BUG-015)
 */

const { loginAs, anon } = require('../../helpers/auth');
const { resetDatabase } = require('../../helpers/db');

beforeEach(async () => {
  await resetDatabase();
});

const STATIC_PAGES = [
  'admin_fix.html',
  'analytics.html',
  'collections.html',
  'doctors.html',
  'import.html',
  'index.html',
  'inventory.html',
  'orders.html',
  'pharmacy_directory.html',
  'pos.html',
  'products.html',
  'retail_sales.html',
  'staff_directory.html',
  'suppliers.html',
  'transfer.html',
  'warehouse.html',
  'withdrawals.html',
];

describe('Anonymous Access & Global Auth Guard', () => {
  test('GET / serves login.html with status 200', async () => {
    const res = await anon().get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('مركز القدس');
  });

  test('GET /login.html is accessible anonymously with 200', async () => {
    const res = await anon().get('/login.html');
    expect(res.status).toBe(200);
  });

  test('GET /js/authGuard.js is accessible anonymously with 200', async () => {
    const res = await anon().get('/js/authGuard.js');
    expect(res.status).toBe(200);
  });

  test.each(['/index.html', '/orders.html', '/analytics.html', '/dashboard', '/pos'])(
    'unauthenticated %s redirects to /login.html',
    async (path) => {
      const res = await anon().get(path).set('Accept', 'text/html');
      expect([302, 401]).toContain(res.status);
      if (res.status === 302) {
        expect(res.headers.location).toMatch(/login\.html/);
      }
    }
  );
});

describe('Authenticated Employee Page Access', () => {
  test.each(STATIC_PAGES)('GET /%s returns 200 text/html for authenticated employee', async (page) => {
    const emp = await loginAs('emp1');
    const res = await emp.get(`/${page}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
  });

  test('GET /pos serves retail_sales terminal with 200', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/pos');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
  });

  test('GET /dashboard redirects non-admin employee away from admin dashboard', async () => {
    const emp = await loginAs('emp1');
    const res = await emp.get('/dashboard');
    expect([302, 403]).toContain(res.status);
    if (res.status === 302) {
      expect(res.headers.location).toMatch(/index\.html/);
    }
  });

  test.failing('GET /dashboard.html blocks non-admin employee @known-bug E-BUG-4', async () => {
    const emp = await loginAs('emp1');
    // Global guard only checks requireAuth, so static dashboard.html is served 200 to regular employees
    const res = await emp.get('/dashboard.html');
    expect([302, 403]).toContain(res.status);
  });
});

describe('Admin & Super Admin Redirects', () => {
  test('GET /dashboard returns 200 for admin', async () => {
    const admin = await loginAs('admin');
    const res = await admin.get('/dashboard');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
  });

  test.failing('GET / redirects admin to /dashboard @known-bug E-BUG-3', async () => {
    const admin = await loginAs('admin');
    const res = await admin.get('/');
    // express.static shadows app.get('/') by serving public/index.html (200), bypassing role redirect to /dashboard
    expect([302]).toContain(res.status);
    expect(res.headers.location).toBe('/dashboard');
  });

  test.failing('GET / redirects SUPER ADMIN to /dashboard @known-bug E-BUG-3', async () => {
    const superadmin = await loginAs('superadmin');
    const res = await superadmin.get('/');
    // Seed role 'SUPER ADMIN' does not match 'Super Admin', and express.static serves index.html (200)
    expect([302]).toContain(res.status);
    expect(res.headers.location).toBe('/dashboard');
  });
});
