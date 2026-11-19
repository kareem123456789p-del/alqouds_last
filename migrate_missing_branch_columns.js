/**
 * fix(qa): add branch_id columns that every controller already writes.
 *
 * BUG-001 — A fresh install following README.md ends up without branch_id on
 * order_items, retail_sale_items, supplier_transactions and client_transactions.
 * Every INSERT into those tables supplies branch_id, so order creation, POS
 * sales, supplier imports, collections and returns all fail with 42703
 * (undefined_column) on a clean database.
 *
 * This migration is idempotent, uses PostgreSQL-only syntax (Golden Rule 3),
 * and backfills historical rows to branch 1 before adding the FK.
 */
const db = require('./db');

const TABLES = [
  'order_items',
  'retail_sale_items',
  'supplier_transactions',
  'client_transactions',
];

async function migrate() {
  console.log('Starting missing branch_id columns migration...');
  for (const table of TABLES) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS branch_id INT DEFAULT 1`);
    await db.execute(`UPDATE ${table} SET branch_id = 1 WHERE branch_id IS NULL`);
    await db.execute(`ALTER TABLE ${table} ALTER COLUMN branch_id SET DEFAULT 1`);

    try {
      await db.execute(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS fk_${table}_branch`);
      await db.execute(`
        ALTER TABLE ${table}
        ADD CONSTRAINT fk_${table}_branch
        FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT
      `);
    } catch (err) {
      console.log(`FK constraint issue for ${table}: ${err.message}`);
    }

    await db.execute(`CREATE INDEX IF NOT EXISTS idx_${table}_branch ON ${table}(branch_id)`);
    console.log(`  ✓ ${table}.branch_id`);
  }
  console.log('Missing branch_id columns migration completed.');
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });
