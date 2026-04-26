const pool = require('./db');

async function migrate() {
    try {
        console.log("Starting migration...");
        
        // Add qty_threshold to warehouse_inventory
        try {
            await pool.query('ALTER TABLE warehouse_inventory ADD COLUMN qty_threshold INT DEFAULT 20');
            console.log("Added qty_threshold to warehouse_inventory");
        } catch (e) {
            console.log("qty_threshold might already exist:", e.message);
        }

        // Add expiry_month_threshold to warehouse_inventory
        try {
            await pool.query('ALTER TABLE warehouse_inventory ADD COLUMN expiry_month_threshold INT DEFAULT 3');
            console.log("Added expiry_month_threshold to warehouse_inventory");
        } catch (e) {
            console.log("expiry_month_threshold might already exist:", e.message);
        }

        // Add inventory_id to order_items
        try {
            await pool.query('ALTER TABLE order_items ADD COLUMN inventory_id INT NULL');
            console.log("Added inventory_id to order_items");
        } catch (e) {
            console.log("inventory_id might already exist:", e.message);
        }

        console.log("Migration complete.");
    } catch(e) {
        console.error("Critical Migration error:", e);
    }
    process.exit(0);
}
migrate();
