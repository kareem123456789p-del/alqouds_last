const mysql = require('mysql2/promise');
require('dotenv').config();

async function setup() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'alquods_db',
        port: process.env.DB_PORT || 3306
    });

    // Create employee_withdrawals table if not exists
    await conn.query(`
        CREATE TABLE IF NOT EXISTS employee_withdrawals (
            id INT AUTO_INCREMENT PRIMARY KEY,
            staff_id INT NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            reason VARCHAR(255) NOT NULL,
            category ENUM('Emergency', 'Salary Advance', 'Personal') DEFAULT 'Personal',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
        )
    `);
    console.log('✅ employee_withdrawals table ready');

    // Show staff table schema
    const [cols] = await conn.query('DESCRIBE staff');
    const fields = cols.map(c => c.Field);
    console.log('STAFF COLUMNS:', fields.join(', '));

    await conn.end();
}

setup().catch(console.error);
