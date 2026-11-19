'use strict';
/**
 * Database helpers for integration tests.
 *
 * Uses its own pg Pool (independent from the app's db.js pool) so tests can
 * assert raw database state and detect connection leaks without interference.
 */

const { Pool } = require('pg');
const { seed } = require('./seed');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Tests must run through jest.config.js (tests/setup/env.js).');
}

const dbName = decodeURIComponent(new URL(connectionString).pathname.replace(/^\//, ''));
if (!/^alquods_test[a-z0-9_]*$/.test(dbName)) {
  throw new Error(`REFUSING TO RUN: "${dbName}" is not an alquods_test* database.`);
}

const pool = new Pool({ connectionString, max: 5 });

async function q(sql, params = []) {
  const res = await pool.query(sql, params);
  return res.rows;
}

async function one(sql, params = []) {
  const rows = await q(sql, params);
  return rows[0] || null;
}

async function scalar(sql, params = []) {
  const row = await one(sql, params);
  if (!row) return null;
  return Object.values(row)[0];
}

async function resetDatabase() {
  const tables = await q(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`);
  if (tables.length) {
    await pool.query(`TRUNCATE TABLE ${tables.map(t => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await seed(client);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function closeDb() {
  await pool.end();
}

// ── Domain helpers ──────────────────────────────────────────────────────────

/** Sum of physical stock for a product across all branches (or one branch). */
async function stockSum(productId, branchId = null) {
  const sql = branchId
    ? 'SELECT COALESCE(SUM(current_stock),0)::int AS s FROM warehouse_inventory WHERE product_id = $1 AND branch_id = $2'
    : 'SELECT COALESCE(SUM(current_stock),0)::int AS s FROM warehouse_inventory WHERE product_id = $1';
  return scalar(sql, branchId ? [productId, branchId] : [productId]);
}

async function warehouseStock(productId, warehouseId) {
  return scalar(
    'SELECT COALESCE(SUM(current_stock),0)::int FROM warehouse_inventory WHERE product_id = $1 AND warehouse_id = $2',
    [productId, warehouseId]
  );
}

async function productRow(productId) {
  return one('SELECT * FROM products WHERE id = $1', [productId]);
}

function parseClientId(raw) {
  const [type, id] = String(raw).split(/[-_]/);
  return { type, id: Number(id) };
}

/** Ledger balance: SUM(client_transactions.amount) for a doc- or pharm- client id. */
async function clientLedgerSum(rawClientId) {
  const { type, id } = parseClientId(rawClientId);
  const column = type === 'doc' ? 'client_id' : 'pharmacy_id';
  return Number(await scalar(
    `SELECT COALESCE(SUM(amount),0) FROM client_transactions WHERE ${column} = $1`,
    [id]
  ));
}

async function clientDebt(rawClientId) {
  const { type, id } = parseClientId(rawClientId);
  const table = type === 'doc' ? 'doctors' : 'pharmacies';
  return Number(await scalar(`SELECT total_debt FROM ${table} WHERE id = $1`, [id]));
}

/** Supplier balance: SUM(supplier_transactions.total_amount). */
async function supplierBalance(supplierId) {
  return Number(await scalar(
    'SELECT COALESCE(SUM(total_amount),0) FROM supplier_transactions WHERE supplier_id = $1',
    [supplierId]
  ));
}

async function count(table, where = '', params = []) {
  return Number(await scalar(`SELECT COUNT(*) FROM ${table} ${where}`, params));
}

/** Open transactions / leaked connections, used by atomicity tests. */
async function openTransactionCount() {
  return Number(await scalar(
    `SELECT COUNT(*) FROM pg_stat_activity
     WHERE datname = current_database() AND state = 'idle in transaction'`
  ));
}

async function activeConnectionCount() {
  return Number(await scalar(
    `SELECT COUNT(*) FROM pg_stat_activity WHERE datname = current_database()`
  ));
}

module.exports = {
  pool, q, one, scalar, resetDatabase, closeDb,
  stockSum, warehouseStock, productRow, clientLedgerSum, clientDebt,
  supplierBalance, count, openTransactionCount, activeConnectionCount,
  parseClientId, dbName,
};
