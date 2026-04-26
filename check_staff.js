const mysql = require('mysql2/promise');
require('dotenv').config();
async function check() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'alquods_db',
        port: process.env.DB_PORT || 3306
    });
    const [cols] = await conn.query('DESCRIBE staff');
    console.log('STAFF COLS:', cols.map(c => c.Field + ' (' + c.Type + ')').join(', '));
    await conn.end();
}
check().catch(console.error);
