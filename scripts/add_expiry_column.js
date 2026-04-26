const mysql = require('mysql2/promise');
require('dotenv').config();

async function addExpiryColumn() {
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

        try {
            await connection.query(`ALTER TABLE products ADD COLUMN expiry_date DATE DEFAULT NULL;`);
            console.log('✅ Column "expiry_date" added successfully!');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('ℹ️ Column "expiry_date" already exists.');
            } else {
                throw err;
            }
        }

        await connection.end();

    } catch (err) {
        console.error('❌ Error updating database:', err.message);
    }
}

addExpiryColumn();
