const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:kareem@localhost:5432/alquods_db',
});

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Convert mysql2 `?` placeholders to PostgreSQL `$1, $2, …` */
function convertPlaceholders(sql) {
    let index = 0;
    return sql.replace(/\?/g, () => `$${++index}`);
}

/**
 * For INSERT statements, append `RETURNING *` so we can extract `insertId`.
 * Only appends if not already present.
 */
function appendReturning(sql) {
    const trimmed = sql.trimEnd().replace(/;$/, '');
    if (/^INSERT\s/i.test(trimmed) && !/RETURNING\s/i.test(trimmed)) {
        return trimmed + ' RETURNING *';
    }
    return trimmed;
}

/** Build a mysql2-compatible result from a pg result */
function wrapResult(pgResult) {
    const rows = pgResult.rows || [];
    const fields = pgResult.fields || [];

    // Attach mysql2-style metadata to the rows array
    rows.insertId = rows.length > 0 && rows[0].id !== undefined ? rows[0].id : null;
    rows.affectedRows = pgResult.rowCount || 0;

    return [rows, fields];
}

// ─── Pool-level execute & query ─────────────────────────────────────────────

async function execute(sql, params = []) {
    const pgSql = appendReturning(convertPlaceholders(sql));
    const result = await pool.query(pgSql, params);
    return wrapResult(result);
}

async function query(sql, params = []) {
    return execute(sql, params);
}

// ─── Connection-level (transactions) ────────────────────────────────────────

async function getConnection() {
    const client = await pool.connect();

    const conn = {
        async execute(sql, params = []) {
            const pgSql = appendReturning(convertPlaceholders(sql));
            const result = await client.query(pgSql, params);
            return wrapResult(result);
        },
        async query(sql, params = []) {
            return conn.execute(sql, params);
        },
        async beginTransaction() {
            await client.query('BEGIN');
        },
        async commit() {
            await client.query('COMMIT');
        },
        async rollback() {
            await client.query('ROLLBACK');
        },
        release() {
            client.release();
        }
    };
    return conn;
}

// ─── Exported API (mysql2-compatible promise pool) ──────────────────────────

/**
 * Utility helper for Data Scoping
 * Injects or provides the strictly required branch_id filtering logic.
 */
function getBranchScope(branchId) {
    return branchId ? `branch_id = ${parseInt(branchId)}` : `1=1`;
}

const promisePool = {
    execute,
    query,
    getConnection,
    getBranchScope
};

module.exports = promisePool;

// Non-fatal startup connectivity check
pool.query('SELECT 1')
    .then(() => {
        console.log('✅ تم الاتصال بقاعدة البيانات (PostgreSQL Pool) بنجاح!');
    })
    .catch((err) => {
        console.error('⚠️  DB connectivity check failed (server will still start):');
        console.error('   Code:', err.code);
        console.error('   Message:', err.message);
    });