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

        // Create local_suppliers table
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS local_suppliers (
                id             INT AUTO_INCREMENT PRIMARY KEY,
                supplier_code  VARCHAR(20)  NOT NULL UNIQUE,
                company_name   VARCHAR(150) NOT NULL,
                contact_person VARCHAR(100) NOT NULL,
                phone          VARCHAR(30)  NOT NULL,
                city_area      VARCHAR(100) NOT NULL,
                notes          TEXT         DEFAULT NULL,
                created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Table "local_suppliers" ready.');

        // Seed sample data if empty
        const [[{ cnt }]] = await conn.execute('SELECT COUNT(*) AS cnt FROM local_suppliers');
        if (cnt === 0) {
            await conn.execute(`
                INSERT INTO local_suppliers
                    (supplier_code, company_name, contact_person, phone, city_area, notes)
                VALUES
                    ('LOC-0214', 'Al-Amal Medical Supplies', 'Ahmed Youssef', '+970 599-100-1234', 'Jerusalem, Old City',  'Main distributor for consumables'),
                    ('LOC-0355', 'Nile Pharma Dist.',        'Sara Kamel',    '+970 598-200-5678', 'Ramallah, Center',     'Fast delivery — 24h'),
                    ('LOC-0412', 'Delta Equipments',         'Mohamed Ibrahim','+970 597-300-9012', 'Hebron, Industrial Zone', 'Equipment specialist'),
                    ('LOC-0567', 'Egyptian Care',            'Hassan Ali',     '+970 596-400-3456', 'Bethlehem, Beit Jala', 'Bulk orders preferred'),
                    ('LOC-0621', 'ProMed Supplies',          'Lina Haddad',    '+970 595-500-7890', 'Nablus, Center',      'Sterile products only')
            `);
            console.log('✅ Sample suppliers seeded (5 rows).');
        } else {
            console.log('ℹ️  Suppliers already seeded — skipping.');
        }

        console.log('\n🎉 Supplier setup complete! Run "node app.js" to start the server.');
    } catch (err) {
        console.error('❌ Setup failed:', err.message);
        process.exit(1);
    } finally {
        if (conn) await conn.end();
    }
}

setup();
