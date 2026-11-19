'use strict';
/**
 * Runs before every test file, before application modules are required.
 * Loads .env.test (never .env) and enforces the test-database naming rule.
 */

const path = require('path');
const fs = require('fs');

const envTest = path.join(__dirname, '../../.env.test');
if (fs.existsSync(envTest)) {
  require('dotenv').config({ path: envTest, override: false });
}

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is missing. Copy .env.test.example to .env.test.');
}

const name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
if (!/^alquods_test[a-z0-9_]*$/.test(name)) {
  throw new Error(
    `REFUSING TO RUN: DATABASE_URL points at "${name}", which is not an alquods_test* database.`
  );
}

// Keep test output readable; failures still print through Jest itself.
if (!process.env.DEBUG_TESTS) {
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.debug = noop;
}
