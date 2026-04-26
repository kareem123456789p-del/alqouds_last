const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function run() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'alquods_db',
        port: process.env.DB_PORT || 3306
    });

    const tables = ['orders', 'order_items', 'client_transactions', 'doctors', 'pharmacies', 'products', 'warehouse_inventory', 'local_suppliers', 'import_logs', 'supplier_transactions', 'suppliers'];

    let schema = {};
    for (const t of tables) {
        try {
            const [cols] = await conn.query(`DESCRIBE ${t}`);
            schema[t] = cols.map(c => ({ Field: c.Field, Type: c.Type }));
        } catch (e) {
            schema[t] = "Table not found";
        }
    }

    fs.writeFileSync('schema_live.json', JSON.stringify(schema, null, 2));
    await conn.end();
}

run();
