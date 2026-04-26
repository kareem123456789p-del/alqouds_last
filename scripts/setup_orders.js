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

        // 1. Create clients table
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS clients (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(150) NOT NULL,
                type VARCHAR(50) DEFAULT 'Pharmacy',
                contact_person VARCHAR(100),
                phone VARCHAR(30),
                email VARCHAR(100),
                address VARCHAR(255),
                credit_limit DECIMAL(12, 2) DEFAULT 0.00,
                total_debt DECIMAL(12, 2) DEFAULT 0.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Table "clients" ready.');

        // 2. Create orders table
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_number VARCHAR(50) NOT NULL UNIQUE,
                client_id INT NOT NULL,
                expected_delivery DATE,
                total_amount DECIMAL(12, 2) DEFAULT 0.00,
                status VARCHAR(50) DEFAULT 'Pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (client_id) REFERENCES clients(id)
            )
        `);
        console.log('✅ Table "orders" ready.');

        // 3. Create order_items table
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS order_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                product_id INT NOT NULL,
                warehouse_id INT, -- To track which warehouse it was dispatched from
                batch_no VARCHAR(100),
                expiry_date DATE,
                qty INT NOT NULL,
                unit_price DECIMAL(10, 2) NOT NULL,
                discount DECIMAL(10, 2) DEFAULT 0.00,
                tax DECIMAL(10, 2) DEFAULT 0.00,
                subtotal DECIMAL(12, 2) NOT NULL,
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id),
                FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
            )
        `);
        console.log('✅ Table "order_items" ready.');

        // 4. Create client_transactions table
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS client_transactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                client_id INT NOT NULL,
                type VARCHAR(50) NOT NULL, -- 'ORDER', 'PAYMENT', 'RETURN'
                amount DECIMAL(12, 2) NOT NULL,
                reference_id INT, -- could be order_id or payment_id
                date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (client_id) REFERENCES clients(id)
            )
        `);
        console.log('✅ Table "client_transactions" ready.');

        // Seed some sample clients
        const [[{ cnt }]] = await conn.execute('SELECT COUNT(*) AS cnt FROM clients');
        if (cnt === 0) {
            await conn.execute(`
                INSERT INTO clients (name, type, contact_person, phone, address, credit_limit, total_debt) VALUES
                ('Al-Shifa Hospital', 'Hospital', 'Dr. Ahmed', '+970 599 123 456', 'Gaza City, North District', 60000.00, 45230.50),
                ('City Care Pharmacy', 'Pharmacy', 'Mohamed', '+970 598 234 567', 'Ramallah Center', 20000.00, 5200.00),
                ('Gaza Hope Clinic', 'Clinic', 'Dr. Sara', '+970 597 345 678', 'Gaza Strip', 10000.00, 0.00)
            `);
            console.log('✅ Seeded sample clients.');
        }

        console.log('\n🎉 Orders Database setup complete!');
    } catch (err) {
        console.error('❌ Setup failed:', err.message);
        process.exit(1);
    } finally {
        if (conn) await conn.end();
    }
}

setup();
