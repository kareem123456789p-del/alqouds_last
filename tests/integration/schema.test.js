'use strict';
/**
 * Regression tests for BUG-001.
 *
 * A fresh install that follows README.md must produce the schema the
 * controllers actually write to. These assertions fail on the unpatched
 * setup_pg.sql + README migration list.
 */

const { q } = require('../helpers/db');

async function columns(table) {
  const rows = await q(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return rows.map(r => r.column_name);
}

describe('BUG-001: branch_id columns required by controllers', () => {
  test.each([
    'order_items',
    'retail_sale_items',
    'supplier_transactions',
    'client_transactions',
  ])('%s has a branch_id column', async (table) => {
    expect(await columns(table)).toContain('branch_id');
  });

  test('staff has the authentication columns the login query uses', async () => {
    const cols = await columns('staff');
    expect(cols).toEqual(expect.arrayContaining(['registration_number', 'password_hash', 'branch_id']));
  });

  test('warehouses has branch_id (warehouse queries filter on it)', async () => {
    expect(await columns('warehouses')).toContain('branch_id');
  });
});
