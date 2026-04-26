const mysql = require('mysql2/promise');
require('dotenv').config();

async function setup() {
    let conn;
    try {
        conn = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'alquods_db',
            multipleStatements: true
        });

        console.log('✅ Connected to database.');

        // 1. Create warehouses table
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS warehouses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(150) NOT NULL,
                location VARCHAR(200) NOT NULL,
                capacity INT DEFAULT 10000,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Table "warehouses" ready.');

        // 2. Create warehouse_inventory (many-to-many: warehouse ↔ product)
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS warehouse_inventory (
                warehouse_id INT NOT NULL,
                product_id INT NOT NULL,
                current_stock INT NOT NULL DEFAULT 0,
                PRIMARY KEY (warehouse_id, product_id),
                FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Table "warehouse_inventory" ready.');

        // 3. Create transfer_logs
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS transfer_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                from_warehouse_id INT NOT NULL,
                to_warehouse_id INT NOT NULL,
                product_id INT NOT NULL,
                quantity INT NOT NULL,
                transferred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (from_warehouse_id) REFERENCES warehouses(id),
                FOREIGN KEY (to_warehouse_id) REFERENCES warehouses(id),
                FOREIGN KEY (product_id) REFERENCES products(id)
            )
        `);
        console.log('✅ Table "transfer_logs" ready.');

        // 4. Seed warehouses (only if empty)
        const [rows] = await conn.execute('SELECT COUNT(*) as cnt FROM warehouses');
        if (rows[0].cnt === 0) {
            await conn.execute(`
                INSERT INTO warehouses (name, location, capacity) VALUES
                ('Central Storage A', 'Jerusalem Sector 4', 10000),
                ('Emergency Depot', 'Hebron Mobile Unit', 3000),
                ('Regional Hub', 'Ramallah Central', 7500)
            `);
            console.log('✅ Sample warehouses seeded.');
        } else {
            console.log('ℹ️  Warehouses already exist — skipping seed.');
        }

        // 5. Seed warehouse_inventory from existing products (only if empty)
        const [invRows] = await conn.execute('SELECT COUNT(*) as cnt FROM warehouse_inventory');
        if (invRows[0].cnt === 0) {
            // Get all product IDs
            const [products] = await conn.execute('SELECT id FROM products LIMIT 50');
            const [warehouses] = await conn.execute('SELECT id FROM warehouses');

            if (products.length > 0 && warehouses.length > 0) {
                // Distribute products across warehouses with random stock
                const values = [];
                products.forEach(p => {
                    warehouses.forEach(w => {
                        const stock = Math.floor(Math.random() * 500) + 100;
                        values.push(`(${w.id}, ${p.id}, ${stock})`);
                    });
                });
                if (values.length > 0) {
                    await conn.execute(`
                        INSERT IGNORE INTO warehouse_inventory (warehouse_id, product_id, current_stock)
                        VALUES ${values.join(', ')}
                    `);
                    console.log(`✅ Seeded ${values.length} warehouse_inventory entries.`);
                }
            } else {
                console.log('ℹ️  No products found to seed inventory — run your product setup first.');
            }
        } else {
            console.log('ℹ️  Warehouse inventory already seeded — skipping.');
        }

        console.log('\n🎉 Warehouse setup complete! You can now run the server.');
    } catch (err) {
        console.error('❌ Setup failed:', err.message);
        process.exit(1);
    } finally {
        if (conn) await conn.end();
    }
}

setup();
