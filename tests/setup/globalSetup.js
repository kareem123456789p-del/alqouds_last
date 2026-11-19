'use strict';
/**
 * Jest global setup: provision the test database once per run.
 * Creates alquods_test_* if missing, applies setup_pg.sql and every migration.
 */

const path = require('path');
const fs = require('fs');

const envTest = path.join(__dirname, '../../.env.test');
if (fs.existsSync(envTest)) {
  require('dotenv').config({ path: envTest, override: false });
}

const { provision } = require('../../scripts/test-db');

module.exports = async () => {
  const name = await provision({ reset: true });
  process.env.QA_TEST_DB = name;
  // eslint-disable-next-line no-console
  console.log(`\n[qa] test database ready: ${name}\n`);
};
