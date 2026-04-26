const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const schemaPath = path.join(__dirname, '..', 'alquods.sql');

async function importSchema() {
    console.log('🚀 Starting database schema import...');

    let connection;
    try {
        // Connect without selecting a database first
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            multipleStatements: true,
        });

        console.log('✅ Connected to MySQL server.');

        // Read the SQL file
        const sql = fs.readFileSync(schemaPath, 'utf8');
        console.log(`📂 Read schema file from: ${schemaPath}`);

        // Execute the SQL commands
        await connection.query(sql);
        console.log('✅ Database schema imported successfully!');

    } catch (error) {
        console.error('❌ Error importing schema:', error);
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Connection closed.');
        }
    }
}

importSchema();
