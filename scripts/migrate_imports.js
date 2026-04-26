const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateImports() {
    console.log('Starting imports migration...');

    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'alquods_db',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        // Create import_logs table if it doesn't exist
        const createImportLogsTableQuery = `
            CREATE TABLE IF NOT EXISTS import_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                product_id INT NOT NULL,
                supplier_id INT NOT NULL,
                quantity INT NOT NULL,
                unit_price DECIMAL(10, 2) NOT NULL,
                status VARCHAR(50) DEFAULT 'Received',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products(id),
                FOREIGN KEY (supplier_id) REFERENCES local_suppliers(id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;

        console.log('Executing CREATE TABLE IF NOT EXISTS import_logs...');
        await pool.execute(createImportLogsTableQuery);
        console.log('✅ import_logs table is ready.');

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrateImports();
