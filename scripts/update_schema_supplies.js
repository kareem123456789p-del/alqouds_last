const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateSchemaForSupplies() {
    const TARGET_PORT = process.env.DB_PORT || 3306;

    try {
        const connection = await mysql.createConnection({
            host: '127.0.0.1',
            user: 'root',
            password: '',
            port: TARGET_PORT,
            database: 'alquods_db'
        });

        console.log('✅ Connected to database');

        const columnsToAdd = [
            "ADD COLUMN sku VARCHAR(50) DEFAULT NULL",
            "ADD COLUMN category VARCHAR(100) DEFAULT 'General'",
            "ADD COLUMN manufacturer VARCHAR(100) DEFAULT NULL",
            "ADD COLUMN purchase_price DECIMAL(10, 2) DEFAULT 0.00",
            "ADD COLUMN image_url VARCHAR(255) DEFAULT NULL"
        ];

        for (const col of columnsToAdd) {
            try {
                await connection.query(`ALTER TABLE products ${col};`);
                console.log(`✅ Executed: ${col}`);
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    console.log(`ℹ️ Column already exists: ${col.split(' ')[2]}`);
                } else {
                    console.error(`❌ Error adding column: ${err.message}`);
                }
            }
        }

        await connection.end();
        console.log('🎉 Schema update complete!');

    } catch (err) {
        console.error('❌ Connection failed:', err.message);
    }
}

updateSchemaForSupplies();
