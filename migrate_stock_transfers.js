const db = require('./db');

async function migrateStockTransfers() {
    try {
        console.log('Starting Stock Transfers Migration...');

        // 1. Create stock_transfers
        await db.execute(`
            CREATE TABLE IF NOT EXISTS stock_transfers (
                id SERIAL PRIMARY KEY,
                transfer_code VARCHAR(50) UNIQUE NOT NULL,
                source_branch_id INT NOT NULL REFERENCES branches(id),
                destination_branch_id INT NOT NULL REFERENCES branches(id),
                status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED')),
                notes TEXT,
                created_by_staff_id INT REFERENCES staff(id),
                processed_by_staff_id INT REFERENCES staff(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Create stock_transfer_items
        // Here item_id = products.id, batch_id = warehouse_inventory.id
        await db.execute(`
            CREATE TABLE IF NOT EXISTS stock_transfer_items (
                id SERIAL PRIMARY KEY,
                transfer_id INT NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
                item_id INT NOT NULL,
                batch_id INT NOT NULL,
                quantity INT NOT NULL CHECK (quantity > 0)
            );
        `);

        // 3. Create stock_audit_logs
        await db.execute(`
            CREATE TABLE IF NOT EXISTS stock_audit_logs (
                id SERIAL PRIMARY KEY,
                branch_id INT NOT NULL REFERENCES branches(id),
                staff_id INT REFERENCES staff(id),
                action_type VARCHAR(50) NOT NULL,
                item_id INT,
                batch_id INT,
                quantity_changed INT NOT NULL,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('Stock Transfers Migration Completed.');
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        process.exit();
    }
}

migrateStockTransfers();
