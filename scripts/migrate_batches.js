const pool = require('../db');

async function migrate() {
    try {
        console.log('Starting migration for warehouse_inventory...');

        // 0. Add index on warehouse_id to satisfy foreign key requirement
        try {
            await pool.execute('ALTER TABLE warehouse_inventory ADD INDEX warehouse_id_idx (warehouse_id)');
            console.log('Added index on warehouse_id.');
        } catch (e) {
            if (e.code === 'ER_DUP_KEYNAME') {
                console.log('Index warehouse_id_idx already exists.');
            } else {
                throw e;
            }
        }

        // 1. Drop the primary key constraint (warehouse_id, product_id)
        try {
            await pool.execute('ALTER TABLE warehouse_inventory DROP PRIMARY KEY');
            console.log('Dropped composite primary key.');
        } catch (e) {
            if (e.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
                console.log('Primary key already dropped or not found. Proceeding...');
            } else {
                throw e;
            }
        }

        // 2. Add auto-increment id column if it doesn't exist
        try {
            await pool.execute('ALTER TABLE warehouse_inventory ADD COLUMN id INT AUTO_INCREMENT PRIMARY KEY FIRST');
            console.log('Added id INT AUTO_INCREMENT PRIMARY KEY.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('Column id already exists.');
            } else {
                throw e;
            }
        }

        // 3. Add expiry_date
        try {
            await pool.execute('ALTER TABLE warehouse_inventory ADD COLUMN expiry_date DATE DEFAULT NULL');
            console.log('Added column expiry_date.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('Column expiry_date already exists.');
            } else {
                throw e;
            }
        }

        // 4. Add batch_number
        try {
            await pool.execute('ALTER TABLE warehouse_inventory ADD COLUMN batch_number VARCHAR(50) DEFAULT NULL');
            console.log('Added column batch_number.');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('Column batch_number already exists.');
            } else {
                throw e;
            }
        }

        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
