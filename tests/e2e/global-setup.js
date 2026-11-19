// @ts-check
'use strict';

const path = require('path');
const fs = require('fs');

const envTest = path.join(__dirname, '../../.env.test');
if (fs.existsSync(envTest)) {
  require('dotenv').config({ path: envTest, override: false });
}

const { resetDatabase, closeDb } = require('../helpers/db');

/**
 * Playwright globalSetup to seed the test database before the webServer and tests run.
 */
module.exports = async function globalSetup() {
  await resetDatabase();
  await closeDb();
};
