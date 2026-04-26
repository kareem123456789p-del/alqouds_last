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

        // 1. Check if column exists, if not add it
        const [columns] = await conn.execute("SHOW COLUMNS FROM orders LIKE 'warehouse_id'");
        if (columns.length === 0) {
            await conn.execute(`
                ALTER TABLE orders 
                ADD COLUMN warehouse_id INT NULL AFTER client_id
            `);
            console.log('✅ Added warehouse_id column to orders table.');
        } else {
            console.log('ℹ️  warehouse_id column already exists.');
        }

        // 2. Check if there is at least one warehouse
        const [warehouseCheck] = await conn.execute('SELECT id FROM warehouses LIMIT 1');
        if (warehouseCheck.length > 0) {
            const defaultWarehouseId = warehouseCheck[0].id;

            // 3. Update existing orders
            await conn.execute(`
                UPDATE orders 
                SET warehouse_id = ? 
                WHERE warehouse_id IS NULL OR warehouse_id = 0
            `, [defaultWarehouseId]);
            console.log(`✅ Updated existing orders to use warehouse_id ${defaultWarehouseId}.`);

            // 4. Try adding foreign key constraint
            try {
                // Check if constraint exists first
                const [constraints] = await conn.execute(`
                    SELECT CONSTRAINT_NAME 
                    FROM information_schema.KEY_COLUMN_USAGE 
                    WHERE TABLE_NAME = 'orders' 
                    AND CONSTRAINT_NAME = 'fk_orders_warehouse' 
                    AND TABLE_SCHEMA = ?
                `, [process.env.DB_NAME || 'alquods_db']);

                if (constraints.length === 0) {
                    await conn.execute(`
                        ALTER TABLE orders 
                        ADD CONSTRAINT fk_orders_warehouse 
                        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
                    `);
                    console.log('✅ Added foreign key constraint for warehouse_id.');
                } else {
                    console.log('ℹ️  Foreign key constraint already exists.');
                }
            } catch (fkErr) {
                console.log('⚠️ Could not add foreign key constraint (possibly data mismatch). Run manually if needed.', fkErr.message);
            }
        } else {
            console.log('⚠️ No warehouses found in database! Could not set default warehouse_id for existing orders.');
        }

        console.log('\\n🎉 Orders table successfully migrated to support Multi-Warehouse logic!');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        if (conn) await conn.end();
    }
}

migrate();
