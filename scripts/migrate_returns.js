const pool = require('../db');

async function migrate() {
    console.log("Starting DB migration for Returns System...");
    try {
        const conn = await pool.getConnection();

        // Check and add columns to order_items
        console.log("Updating order_items table...");
        try {
            await conn.query('ALTER TABLE order_items ADD COLUMN returned_qty INT DEFAULT 0, ADD COLUMN return_reason VARCHAR(255) DEFAULT NULL');
            console.log("Added columns to order_items.");
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log("Columns already exist in order_items.");
            } else {
                throw e;
            }
        }

        // Check and add columns to import_logs
        console.log("Updating import_logs table...");
        try {
            await conn.query('ALTER TABLE import_logs ADD COLUMN returned_qty INT DEFAULT 0, ADD COLUMN return_reason VARCHAR(255) DEFAULT NULL');
            console.log("Added columns to import_logs.");
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log("Columns already exist in import_logs.");
            } else {
                throw e;
            }
        }

        conn.release();
        console.log("Migration complete.");
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

migrate();
