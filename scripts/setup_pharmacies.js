const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupPharmacies() {
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

        // 1. Create pharmacies table
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS pharmacies (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                license_number VARCHAR(100),
                contact_person VARCHAR(100),
                area VARCHAR(100),
                phone VARCHAR(50),
                email VARCHAR(255),
                status ENUM('active', 'pending', 'suspended') DEFAULT 'active',
                credit_limit DECIMAL(12, 2) DEFAULT 20000.00,
                total_debt DECIMAL(12, 2) DEFAULT 0.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Table "pharmacies" ready.');

        // 2. Add pharmacy_id to orders table (nullable)
        const [orderColumns] = await conn.execute("SHOW COLUMNS FROM orders LIKE 'pharmacy_id'");
        if (orderColumns.length === 0) {
            await conn.execute(`
                ALTER TABLE orders 
                ADD COLUMN pharmacy_id INT NULL AFTER client_id,
                ADD CONSTRAINT fk_orders_pharmacy FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id) ON DELETE SET NULL
            `);

            // Allow client_id to be NULL since an order might be for a pharmacy instead of a doctor
            await conn.execute(`
                ALTER TABLE orders 
                MODIFY COLUMN client_id INT NULL
            `);
            console.log('✅ Added pharmacy_id column to orders table and made client_id nullable.');
        } else {
            console.log('ℹ️  pharmacy_id column already exists in orders table.');
        }

        // 3. Add pharmacy_id to client_transactions table (nullable)
        const [txColumns] = await conn.execute("SHOW COLUMNS FROM client_transactions LIKE 'pharmacy_id'");
        if (txColumns.length === 0) {
            await conn.execute(`
                ALTER TABLE client_transactions 
                ADD COLUMN pharmacy_id INT NULL AFTER client_id,
                ADD CONSTRAINT fk_tx_pharmacy FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id) ON DELETE SET NULL
            `);

            // Allow client_id to be NULL
            await conn.execute(`
                ALTER TABLE client_transactions 
                MODIFY COLUMN client_id INT NULL
            `);
            console.log('✅ Added pharmacy_id column to client_transactions table and made client_id nullable.');
        } else {
            console.log('ℹ️  pharmacy_id column already exists in client_transactions table.');
        }

        // 4. Seed sample pharmacies
        const [[{ cnt }]] = await conn.execute('SELECT COUNT(*) AS cnt FROM pharmacies');
        if (cnt === 0) {
            await conn.execute(`
                INSERT INTO pharmacies (name, license_number, contact_person, area, phone, email, status, credit_limit, total_debt) VALUES
                ('Al-Amal Pharmacy', 'LIC-2023-8894', 'Dr. Ahmed Yassin', 'Ramallah, City Center', '+972 59 123 4567', 'ahmed.y@amal-pharmacy.com', 'active', 50000.00, 12450.00),
                ('City Care Pharmacy', 'LIC-2022-1042', 'Pharm. Layla Mahmoud', 'Nablus, Al-Rafidia', '+972 56 987 6543', 'info@citycare.ps', 'active', 30000.00, 500.00),
                ('Al-Shifa Drugstore', 'LIC-2024-0012', 'Mr. Omar Khaled', 'Hebron, Old City', '+972 59 555 1212', 'sales@alshifa.com', 'pending', 15000.00, 0.00),
                ('Life Plus Pharmacy', 'LIC-2021-5582', 'Dr. Reem Ali', 'Bethlehem, Manger St.', '+972 56 222 3344', 'admin@lifeplus.ps', 'suspended', 10000.00, 9500.00)
            `);
            console.log('✅ Seeded sample pharmacies.');
        }

        console.log('\\n🎉 Pharmacies Schema setup complete!');
    } catch (err) {
        console.error('❌ Setup failed:', err.message);
        process.exit(1);
    } finally {
        if (conn) await conn.end();
    }
}

setupPharmacies();
