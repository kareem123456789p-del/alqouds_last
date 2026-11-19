'use strict';
/**
 * Assertion helpers shared by route-matrix tests.
 */

const { expect } = require('@jest/globals');

/** Assert every row belongs to the expected branch (or is a branch-less aggregate). */
function assertNoCrossBranchRows(rows, branchId, field = 'branch_id') {
  expect(Array.isArray(rows)).toBe(true);
  for (const row of rows) {
    if (row && Object.prototype.hasOwnProperty.call(row, field) && row[field] !== null) {
      expect(Number(row[field])).toBe(Number(branchId));
    }
  }
}

/** Assert a response body contains no password material. */
function assertNoSecrets(body) {
  const text = JSON.stringify(body || {});
  expect(text).not.toMatch(/\$2[aby]\$\d{2}\$/);
  expect(text).not.toMatch(/password_hash/i);
  expect(text.toLowerCase()).not.toContain('password');
}

/** Standard unauthenticated assertion for API routes. */
function expectUnauthorized(res) {
  expect([401, 403]).toContain(res.status);
}

module.exports = { assertNoCrossBranchRows, assertNoSecrets, expectUnauthorized };
