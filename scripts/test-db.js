#!/usr/bin/env node
/**
 * Test database provisioning for the Al-Quds QA suite.
 *
 * HARD SAFETY RULES
 *  - The database name MUST start with `alquods_test`. Anything else aborts.
 *  - The script never connects to the production database.
 *  - Reset uses TRUNCATE ... RESTART IDENTITY CASCADE (never DELETE FROM products).
 *
 * Usage:
 *   node scripts/test-db.js            # create if missing + (re)apply schema/migrations
 *   node scripts/test-db.js --reset    # truncate all data (fast, used between test files)
 *   node scripts/test-db.js --drop     # drop the test database
 *   node scripts/test-db.js --verify   # schema sanity checks only
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

// Load .env.test explicitly. Never .env (it holds real credentials).
const envPath = path.join(ROOT, '.env.test');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('✖ DATABASE_URL is not set. Create .env.test (see .env.test.example).');
  process.exit(1);
}

function dbNameFromUrl(url) {
  const u = new URL(url);
  return decodeURIComponent(u.pathname.replace(/^\//, ''));
}

const DB_NAME = dbNameFromUrl(DATABASE_URL);

function assertTestDatabase(name) {
  if (!/^alquods_test[a-z0-9_]*$/.test(name)) {
    console.error(
      `\n✖ REFUSING TO RUN: database "${name}" is not a test database.\n` +
      `  Only databases named alquods_test* may be touched by the QA suite.\n`
    );
    process.exit(2);
  }
}

assertTestDatabase(DB_NAME);

const { Client } = require('pg');

function maintenanceConfig() {
  const u = new URL(DATABASE_URL);
  return {
    host: u.hostname,
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username || 'postgres'),
    password: u.password ? decodeURIComponent(u.password) : undefined,
    database: 'postgres',
    ssl: false,
  };
}

function targetConfig() {
  const u = new URL(DATABASE_URL);
  return {
    host: u.hostname,
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username || 'postgres'),
    password: u.password ? decodeURIComponent(u.password) : undefined,
    database: DB_NAME,
    ssl: false,
  };
}

async function withClient(config, fn) {
  const client = new Client(config);
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function createDatabaseIfMissing() {
  return withClient(maintenanceConfig(), async (client) => {
    const { rows } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [DB_NAME]);
    if (rows.length === 0) {
      // DB_NAME is validated by assertTestDatabase; still quote as identifier.
      await client.query(`CREATE DATABASE "${DB_NAME}"`);
      console.log(`✓ created database ${DB_NAME}`);
      return true;
    }
    return false;
  });
}

/**
 * Migrations that README.md tells a fresh install to run, in order.
 */
const README_MIGRATIONS = [
  'migrate_rbac.js',
  'migrate_branch_scoping.js',
  'migrate_stock_transfers.js',
  'scripts/migrate_returns_tables.js',
  'migrate_warehouse_permissions.js',
  'migrate_doctor_pharmacy_permissions.js',
  'migrate_collections_permission.js',
  'migrate_analytics_permission.js',
];

/**
 * Migrations that exist in the repo and are REQUIRED by controllers, but are
 * missing from README.md's installation instructions. Applying them is the only
 * way a fresh install boots at all. Tracked as BUG-001 in qa/BUGS.md.
 */
const UNDOCUMENTED_BUT_REQUIRED_MIGRATIONS = [
  'migrate_auth.js',
  'migrate_inventory_permission.js',
  'migrate_warehouses_isolation.js',
  'migrate_strict_isolation.js',
  // fix(qa) BUG-001: controllers write branch_id on these tables.
  'migrate_missing_branch_columns.js',
];

function runMigrations(list) {
  for (const file of list) {
    const abs = path.join(ROOT, file);
    if (!fs.existsSync(abs)) {
      console.log(`  · skip (missing) ${file}`);
      continue;
    }
    try {
      execFileSync(process.execPath, [abs], {
        cwd: ROOT,
        env: { ...process.env, DATABASE_URL },
        stdio: 'pipe',
        timeout: 120000,
      });
      console.log(`  ✓ ${file}`);
    } catch (err) {
      const out = `${err.stdout || ''}${err.stderr || ''}`.trim();
      console.error(`  ✖ ${file}\n${out.split('\n').slice(-8).join('\n')}`);
      throw new Error(`Migration failed: ${file}`);
    }
  }
}

async function applySchema() {
  const sqlPath = path.join(ROOT, 'setup_pg.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await withClient(targetConfig(), async (client) => {
    await client.query(sql);
  });
  console.log('✓ applied setup_pg.sql');
}

async function provision({ reset = true } = {}) {
  assertTestDatabase(DB_NAME);
  await createDatabaseIfMissing();
  if (reset) {
    await applySchema();
    console.log('✓ running README migrations');
    runMigrations(README_MIGRATIONS);
    console.log('✓ running required-but-undocumented migrations (BUG-001)');
    runMigrations(UNDOCUMENTED_BUT_REQUIRED_MIGRATIONS);
    await verify();
  }
  return DB_NAME;
}

/** Fast data reset used by tests. Schema stays; rows go. */
async function resetData() {
  assertTestDatabase(DB_NAME);
  await withClient(targetConfig(), async (client) => {
    const { rows } = await client.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `);
    if (rows.length === 0) return;
    const list = rows.map(r => `"${r.tablename}"`).join(', ');
    await client.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  });
}

async function dropDatabase() {
  assertTestDatabase(DB_NAME);
  await withClient(maintenanceConfig(), async (client) => {
    await client.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [DB_NAME]
    );
    await client.query(`DROP DATABASE IF EXISTS "${DB_NAME}"`);
    console.log(`✓ dropped ${DB_NAME}`);
  });
}

async function verify() {
  assertTestDatabase(DB_NAME);
  const requiredTables = [
    'branches', 'staff', 'permissions', 'staff_permissions', 'uom', 'products',
    'warehouses', 'warehouse_inventory', 'local_suppliers', 'supplier_transactions',
    'import_logs', 'doctors', 'pharmacies', 'orders', 'order_items',
    'client_transactions', 'payments', 'retail_shifts', 'retail_sales',
    'retail_sale_items', 'stock_transfers', 'stock_transfer_items',
    'stock_audit_logs', 'returns', 'return_items', 'employee_withdrawals',
  ];
  // Columns the controllers write unconditionally.
  const requiredColumns = [
    ['staff', 'registration_number'], ['staff', 'password_hash'], ['staff', 'branch_id'],
    ['warehouses', 'branch_id'],
    ['orders', 'branch_id'],
    ['order_items', 'branch_id'],
    ['retail_sale_items', 'branch_id'],
    ['supplier_transactions', 'branch_id'],
    ['warehouse_inventory', 'branch_id'],
    ['client_transactions', 'branch_id'],
  ];

  const missing = [];
  await withClient(targetConfig(), async (client) => {
    const { rows: t } = await client.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
    );
    const have = new Set(t.map(r => r.tablename));
    for (const table of requiredTables) if (!have.has(table)) missing.push(`table ${table}`);
    const { rows: c } = await client.query(
      `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`
    );
    const haveCol = new Set(c.map(r => `${r.table_name}.${r.column_name}`));
    for (const [table, column] of requiredColumns) {
      if (!haveCol.has(`${table}.${column}`)) missing.push(`column ${table}.${column}`);
    }
  });

  if (missing.length) {
    console.error('✖ schema verification failed:\n  ' + missing.join('\n  '));
    process.exitCode = 3;
  } else {
    console.log(`✓ schema verified (${requiredTables.length} tables, ${requiredColumns.length} critical columns)`);
  }
  return missing;
}

module.exports = {
  DB_NAME, DATABASE_URL, assertTestDatabase,
  provision, resetData, dropDatabase, verify,
  README_MIGRATIONS, UNDOCUMENTED_BUT_REQUIRED_MIGRATIONS,
};

if (require.main === module) {
  (async () => {
    const arg = process.argv[2] || '--provision';
    if (arg === '--reset') { await resetData(); console.log('✓ data truncated'); }
    else if (arg === '--drop') { await dropDatabase(); }
    else if (arg === '--verify') { await verify(); }
    else { await provision({ reset: true }); }
    process.exit(process.exitCode || 0);
  })().catch(err => { console.error(err); process.exit(1); });
}
