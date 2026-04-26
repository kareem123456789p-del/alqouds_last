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
        });

        console.log('✅ Connected to database.');

        // 1. Create supplier_transactions table
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS supplier_transactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                supplier_id INT NOT NULL,
                import_log_id INT NOT NULL,
                total_amount DECIMAL(12, 2) NOT NULL,
                transaction_type VARCHAR(50) NOT NULL DEFAULT 'IMPORT_CHARGE',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (supplier_id) REFERENCES local_suppliers(id),
                FOREIGN KEY (import_log_id) REFERENCES import_logs(id)
            )
        `);
        console.log('✅ Table "supplier_transactions" ready.');

        // 2. Add warehouse_id to import_logs if it doesn't exist
        try {
            await conn.execute(`
                ALTER TABLE import_logs
                ADD COLUMN warehouse_id INT NULL DEFAULT 1 AFTER product_id
            `);
            console.log('✅ Added "warehouse_id" to "import_logs".');

            // Add foreign key
            await conn.execute(`
                ALTER TABLE import_logs
                ADD CONSTRAINT fk_import_warehouse
                FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
            `);
            console.log('✅ Added FK constraint to "import_logs.warehouse_id".');

        } catch (err) {
            // ER_DUP_FIELDNAME (1060) means the column already exists
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('ℹ️ Column "warehouse_id" already exists in "import_logs".');
            } else {
                throw err;
            }
        }

        console.log('\n🎉 Supplier Transactions setup complete!');
    } catch (err) {
        console.error('❌ Setup failed:', err.message);
        process.exit(1);
    } finally {
        if (conn) await conn.end();
    }
}

setup();
