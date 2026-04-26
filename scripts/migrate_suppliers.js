/**
 * migrate_suppliers.js
 * Run with: node migrate_suppliers.js
 * Creates / updates local_suppliers table with city_area field.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
    const pool = await mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'alquods_db',
        multipleStatements: true,
    });

    console.log('✅ Connected to DB:', process.env.DB_NAME);

    // 1. Create table if it doesn't exist
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS local_suppliers (
            id               INT          PRIMARY KEY AUTO_INCREMENT,
            supplier_code    VARCHAR(20)  NOT NULL,
            company_name     VARCHAR(150) NOT NULL,
            contact_person   VARCHAR(100) NOT NULL,
            phone            VARCHAR(30)  NOT NULL,
            city_area        VARCHAR(100) NOT NULL DEFAULT '',
            notes            TEXT,
            created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);
    console.log('✅ Table local_suppliers ensured.');

    // 2. Add city_area column if missing
    try {
        await pool.execute(`ALTER TABLE local_suppliers ADD COLUMN city_area VARCHAR(100) NOT NULL DEFAULT '' AFTER phone`);
        console.log('✅ city_area column added.');
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log('ℹ️  city_area column already exists.');
        } else throw e;
    }

    // 3. Add created_at if missing
    try {
        await pool.execute(`ALTER TABLE local_suppliers ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
        console.log('✅ created_at column added.');
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') console.log('ℹ️  created_at already exists.');
        else throw e;
    }

    // 4. Add updated_at if missing
    try {
        await pool.execute(`ALTER TABLE local_suppliers ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
        console.log('✅ updated_at column added.');
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') console.log('ℹ️  updated_at already exists.');
        else throw e;
    }

    // 5. Seed sample data if table is empty
    const [[{ cnt }]] = await pool.execute('SELECT COUNT(*) AS cnt FROM local_suppliers');
    if (cnt === 0) {
        await pool.execute(`
            INSERT INTO local_suppliers (supplier_code, company_name, contact_person, phone, city_area, notes) VALUES
            ('LOC-0201','Al-Amal Medical Supplies','Ahmed Youssef','+20 100 123 4567','Cairo, Nasr City','Main consumables supplier'),
            ('LOC-0202','Nile Pharma Dist.','Sara Kamel','+20 122 987 6543','Giza, Dokki',NULL),
            ('LOC-0203','Delta Equipments','Mohamed Ibrahim','+20 111 555 4444','Alexandria, Smouha',NULL),
            ('LOC-0204','Egyptian Care','Hassan Ali','+20 106 777 8888','Cairo, Maadi',NULL)
        `);
        console.log('✅ Seeded 4 sample suppliers.');
    } else {
        console.log(`ℹ️  Table already has ${cnt} row(s). Skipping seed.`);
    }

    await pool.end();
    console.log('🎉 Migration complete!');
})().catch(err => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
});
