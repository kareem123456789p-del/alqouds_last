'use strict';
/**
 * Authentication helpers.
 *
 * `loginAs('emp1')` returns a supertest agent that keeps the session cookie.
 * Roles are resolved to the seeded registration numbers in tests/helpers/seed.js.
 */

const request = require('supertest');
const app = require('../../app');
const { PASSWORD, STAFF } = require('./seed');

const ROLE_REG = {
  ADMIN: 'admin',
  'SUPER ADMIN': 'superadmin',
  BRANCH_MANAGER: 'bm1',
  DEPUTY_MANAGER: 'dm1',
  ASSISTANT_MANAGER: 'am1',
  WAREHOUSE_MANAGER: 'wm1',
  EMPLOYEE: 'emp1',
  COLLECTOR: 'coll1',
  ANALYST: 'ana1',
  CRM: 'crm1',
  WAREHOUSE_ADMIN: 'wh1',
  POS: 'pos1',
};

/** Resolve a role + branch to a seeded registration number. */
function regFor(role, branchId = 1) {
  const upper = String(role).toUpperCase();
  if (branchId === 1 && ROLE_REG[upper]) return ROLE_REG[upper];
  const candidates = STAFF.filter(s => s.branch === branchId);
  const exact = candidates.find(s => s.role.toUpperCase() === upper);
  if (exact) return exact.reg;
  // Permission-flavoured pseudo-roles map to the dedicated seeded users.
  const byPerm = {
    COLLECTOR: `coll${branchId}`,
    ANALYST: `ana${branchId}`,
    CRM: `crm${branchId}`,
    WAREHOUSE_ADMIN: `wh${branchId}`,
    POS: `pos${branchId}`,
    BRANCH_MANAGER: `bm${branchId}`,
  };
  if (byPerm[upper]) return byPerm[upper];
  throw new Error(`No seeded user for role ${role} in branch ${branchId}`);
}

/**
 * Log in and return a supertest agent with the session cookie attached.
 * Throws if the login does not return 200.
 */
async function loginAs(registrationNumber, password = PASSWORD) {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/login')
    .send({ registration_number: registrationNumber, password });
  if (res.status !== 200) {
    throw new Error(`loginAs(${registrationNumber}) failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return agent;
}

async function loginAsRole(role, branchId = 1) {
  return loginAs(regFor(role, branchId));
}

/** Raw request against the app (no cookie). */
function anon() {
  return request(app);
}

/** Clear all in-memory sessions between test files. */
function clearSessions() {
  const { sessions } = require('../../controllers/authController');
  sessions.clear();
}

module.exports = { app, request, loginAs, loginAsRole, regFor, anon, clearSessions };
