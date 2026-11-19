'use strict';
/**
 * Per-file teardown: close the test pool so Jest exits cleanly.
 */

const { closeDb } = require('../helpers/db');

afterAll(async () => {
  await closeDb();
});
