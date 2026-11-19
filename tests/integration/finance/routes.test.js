'use strict';
/**
 * Route-matrix coverage for Worker C (finance).
 *
 * Every assigned route must reject unauthenticated callers with 401.
 */

const { anon } = require('../../helpers/auth');

const ROUTES = [
  ['get', '/api/orders'],
  ['post', '/api/orders'],
  ['put', '/api/orders/1/cancel'],
  ['get', '/api/orders/1/details'],
  ['put', '/api/orders/1/dispatch'],
  ['get', '/api/orders/1/items'],
  ['post', '/api/orders/1/return'],
  ['get', '/api/orders/clients'],
  ['get', '/api/orders/history/doctor/1'],
  ['get', '/api/orders/product/1/cost-price'],
  ['get', '/api/collections'],
  ['post', '/api/collections'],
  ['get', '/api/collections/client/doc-1/monthly'],
  ['get', '/api/collections/debts'],
  ['get', '/api/collections/summary'],
  ['get', '/api/collections/transactions'],
  ['get', '/api/withdrawals'],
  ['post', '/api/withdrawals'],
  ['get', '/api/withdrawals/stats'],
];

const BODY_METHODS = new Set(['post', 'put', 'patch']);

describe('worker C route matrix — authentication guard', () => {
  test.each(ROUTES)('%s %s rejects anonymous callers with 401', async (method, path) => {
    const req = anon()[method](path);
    const res = BODY_METHODS.has(method) ? await req.send({}) : await req;
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Authentication required.' });
  });
});
