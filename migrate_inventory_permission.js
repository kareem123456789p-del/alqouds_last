const db = require('./db');

async function migrate() {
    console.log('Starting VIEW_INVENTORY_CARD permission migration...');
    try {
        await db.query(`
            INSERT INTO permissions (key, description, category, branch_id)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (key) DO NOTHING
        `, [
            'VIEW_INVENTORY_CARD',
            'عرض كارت المخزون والدخول لصفحة المخزون',
            'Inventory', // Or whatever the inventory category is named. What is it exactly? "Inventory" or "Warehouses & Inventory / إدارة المخازن والمخزون"
            1
        ]);
        console.log('✅ VIEW_INVENTORY_CARD permission added successfully.');
    } catch (err) {
        console.error('Error inserting permission:', err);
    }
    process.exit(0);
}

migrate();
