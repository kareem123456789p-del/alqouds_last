const mysql = require('mysql2/promise');
require('dotenv').config();
async function list() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'alquods_db',
        port: process.env.DB_PORT || 3306
    });
    const [rows] = await conn.query('SHOW TABLES');
    const tables = rows.map(r => Object.values(r)[0]);
    console.log("TABLES: ", tables);
    for (let t of tables) {
        if (t === 'staff' || t.includes('withdraw') || t === 'employee') {
            const [cols] = await conn.query('DESCRIBE ' + t);
            console.log("SCHEMA FOR " + t + ": ", cols);
        }
    }
    await conn.end();
}
list();
