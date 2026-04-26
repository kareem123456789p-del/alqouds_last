const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    let conn;
    try {
        conn = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'alquods_db',
        });

        console.log('✅ Connected to database.');

        // 1. Check if columns already exist to prevent errors on re-run
        const [columns] = await conn.execute("SHOW COLUMNS FROM order_items");
        const hasBasePrice = columns.some(col => col.Field === 'base_price');
        const hasProfitMargin = columns.some(col => col.Field === 'profit_margin');

        // 2. Add columns if they don't exist
        if (!hasBasePrice) {
            console.log('Adding base_price column...');
            await conn.execute(`ALTER TABLE order_items ADD COLUMN base_price DECIMAL(10, 2) DEFAULT 0.00 AFTER qty`);
            console.log('✅ Added base_price column.');
        } else {
            console.log('ℹ️ base_price column already exists.');
        }

        if (!hasProfitMargin) {
            console.log('Adding profit_margin column...');
            await conn.execute(`ALTER TABLE order_items ADD COLUMN profit_margin DECIMAL(5, 2) DEFAULT 0.10 AFTER unit_price`);
            console.log('✅ Added profit_margin column.');
        } else {
            console.log('ℹ️ profit_margin column already exists.');
        }

        // 3. Data Consistency: Set base_price for existing records to match their current unit_price
        // This ensures old data isn't lost and reporting remains accurate for historical orders.
        // We only update if base_price is 0.00 (the default we just added)
        console.log('Syncing existing data for backwards compatibility...');
        const [result] = await conn.execute(`
            UPDATE order_items 
            SET base_price = unit_price 
            WHERE base_price = 0.00 AND unit_price > 0
        `);
        console.log(`✅ Backwards compatibility sync complete. Rows affected: ${result.affectedRows}`);

        console.log('\n🎉 Migration complete!');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        if (conn) await conn.end();
    }
}

migrate();
