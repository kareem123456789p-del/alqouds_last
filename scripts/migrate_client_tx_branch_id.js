/**
 * Migration: Add branch_id column to client_transactions table
 * Run once: node scripts/migrate_client_tx_branch_id.js
 */
const pool = require('../db');

async function migrate() {
    try {
        console.log('Adding branch_id column to client_transactions table...');
        await pool.execute(`
            ALTER TABLE client_transactions
            ADD COLUMN IF NOT EXISTS branch_id INTEGER DEFAULT NULL
        `);
        console.log('✅ branch_id column added successfully (or already exists).');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
