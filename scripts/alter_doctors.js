const pool = require('../db');

async function migrateDoctors() {
    try {
        console.log('Adding credit_limit and total_debt to doctors table...');

        // Attempt to add columns. Using try-catch to ignore if they already exist.
        try {
            await pool.query('ALTER TABLE doctors ADD COLUMN credit_limit DECIMAL(10,2) DEFAULT 60000.00');
        } catch (e) { console.log('credit_limit might already exist', e.message); }

        try {
            await pool.query('ALTER TABLE doctors ADD COLUMN total_debt DECIMAL(10,2) DEFAULT 0.00');
        } catch (e) { console.log('total_debt might already exist', e.message); }

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrateDoctors();
