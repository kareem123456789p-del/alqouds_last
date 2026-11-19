'use strict';
/**
 * Route-matrix coverage for worker B.
 *
 * Every assigned route must at least be reachable and reject anonymous callers.
 * Behavioural coverage lives in the domain files next to this one.
 */

const { anon } = require('../../helpers/auth');

const ROUTES = [
  ['get', '/api/products'],
  ['post', '/api/products'],
  ['put', '/api/products/1'],
  ['delete', '/api/products/1'],
  ['get', '/api/inventory'],
  ['put', '/api/inventory/1'],
  ['delete', '/api/inventory/1'],
  ['get', '/api/inventory/batches/1/1'],
  ['post', '/api/warehouse'],
  ['put', '/api/warehouse/1'],
  ['delete', '/api/warehouse/1'],
  ['get', '/api/warehouse/1/inventory'],
  ['get', '/api/warehouse/list'],
  ['get', '/api/warehouse/movements'],
  ['get', '/api/warehouse/stats'],
  ['get', '/api/transfers'],
  ['post', '/api/transfers'],
  ['patch', '/api/transfers/1/status'],
  ['get', '/api/transfers/audit-logs'],
  ['get', '/api/transfers/products/1'],
  ['get', '/api/transfers/warehouses'],
];

const BODY_METHODS = new Set(['post', 'put', 'patch']);

describe('worker B route matrix — authentication guard', () => {
  test.each(ROUTES)('%s %s rejects anonymous callers with 401', async (method, path) => {
    const req = anon()[method](path);
    const res = BODY_METHODS.has(method) ? await req.send({}) : await req;
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Authentication required.' });
  });
});
