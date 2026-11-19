#!/usr/bin/env node
'use strict';

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS supplier_payments (
        id SERIAL PRIMARY KEY,
        supplier_id INT NOT NULL REFERENCES local_suppliers(id) ON DELETE CASCADE,
        amount NUMERIC(15,2) NOT NULL,
        payment_method VARCHAR(50) DEFAULT 'cash',
        reference_no VARCHAR(100),
        notes TEXT,
        branch_id INT REFERENCES branches(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ supplier_payments table created');
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  migrate().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = migrate;
