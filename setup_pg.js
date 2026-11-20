// @ts-check
'use strict';

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres@127.0.0.1:5433/alquods_db';
const ROOT = __dirname;

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

const UNDOCUMENTED_BUT_REQUIRED_MIGRATIONS = [
  'migrate_auth.js',
  'migrate_inventory_permission.js',
  'migrate_warehouses_isolation.js',
  'migrate_strict_isolation.js',
  'migrate_missing_branch_columns.js',
  'migrate_supplier_payments.js',
  'migrate_supplier_soft_delete.js',
];

async function initDB() {
  console.log(`🚀 Connecting to PostgreSQL at: ${connectionString.replace(/:[^:@]+@/, ':***@')}`);

  const u = new URL(connectionString);
  const dbName = decodeURIComponent(u.pathname.replace(/^\//, ''));
  const maintenanceUrl = `${u.protocol}//${u.username ? u.username + (u.password ? ':' + u.password : '') + '@' : ''}${u.host}/postgres`;

  // 1. Ensure target database exists
  const baseClient = new Client({ connectionString: maintenanceUrl });
  try {
    await baseClient.connect();
    const res = await baseClient.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (res.rowCount === 0) {
      console.log(`📦 Database "${dbName}" does not exist. Creating it...`);
      await baseClient.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✅ Database "${dbName}" created!`);
    } else {
      console.log(`✅ Database "${dbName}" already exists.`);
    }
  } catch (err) {
    console.error('❌ Error checking/creating database:', err.message);
    process.exit(1);
  } finally {
    await baseClient.end();
  }

  // 2. Connect to target database and apply setup_pg.sql
  const dbClient = new Client({ connectionString });
  try {
    await dbClient.connect();
    console.log(`✅ Connected to ${dbName}!`);

    const sqlPath = path.join(ROOT, 'setup_pg.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📜 Running setup_pg.sql...');
    await dbClient.query(sql);
    console.log('✓ Applied setup_pg.sql');

    // 3. Run all migrations sequentially
    console.log('📜 Running migrations...');
    const allMigrations = [...README_MIGRATIONS, ...UNDOCUMENTED_BUT_REQUIRED_MIGRATIONS];
    for (const mig of allMigrations) {
      const absPath = path.join(ROOT, mig);
      if (fs.existsSync(absPath)) {
        execFileSync(process.execPath, [absPath], {
          cwd: ROOT,
          env: { ...process.env, DATABASE_URL: connectionString },
          stdio: 'pipe',
          timeout: 60000,
        });
        console.log(`  ✓ ${mig}`);
      }
    }

    // 4. Seed initial staff, branches, and sample catalog
    console.log('📜 Seeding initial data...');
    const { rows: tables } = await dbClient.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    if (tables.length) {
      await dbClient.query(`TRUNCATE TABLE ${tables.map(t => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
    }
    const { seed } = require('./tests/helpers/seed');
    await dbClient.query('BEGIN');
    await seed(dbClient);
    await dbClient.query('COMMIT');
    console.log('✅ Seed data successfully populated!');

    console.log('🎉 Setup complete! All tables, migrations, and staff accounts are ready.');
  } catch (err) {
    await dbClient.query('ROLLBACK').catch(() => {});
    console.error('❌ Error executing database setup:', err.message);
    process.exit(1);
  } finally {
    await dbClient.end();
  }
}

if (require.main === module) {
  initDB();
}

module.exports = { initDB };
