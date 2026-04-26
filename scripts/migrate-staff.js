const pool = require('../db');

async function migrate() {
    try {
        console.log('🚀 Running Staff Management migration...');

        // 1. Create staff table
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS staff (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                role ENUM('admin', 'sales', 'warehouse') NOT NULL DEFAULT 'sales',
                phone VARCHAR(30),
                email VARCHAR(100),
                status ENUM('active', 'leave') NOT NULL DEFAULT 'active',
                base_salary DECIMAL(10,2) DEFAULT 0.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ staff table ready');

        // 2. Add staff_id column to orders table (if not exists)
        try {
            await pool.execute(`
                ALTER TABLE orders ADD COLUMN staff_id INT NULL,
                ADD CONSTRAINT fk_orders_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL
            `);
            console.log('✅ staff_id column added to orders table');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME' || e.message.includes('Duplicate column')) {
                console.log('ℹ️  staff_id column already exists in orders — skipping');
            } else {
                console.warn('⚠️  Could not add staff_id to orders:', e.message);
            }
        }

        // 3. Seed demo staff if table is empty
        const [[{ cnt }]] = await pool.execute('SELECT COUNT(*) as cnt FROM staff');
        if (cnt === 0) {
            await pool.execute(`
                INSERT INTO staff (name, role, phone, email, status, base_salary) VALUES
                ('أحمد محمد',   'admin',     '+970 599 000 111', 'ahmed@alquds.com',   'active', 1500.00),
                ('سارة أحمد',   'sales',     '+970 599 000 222', 'sara@alquds.com',    'leave', 1200.00),
                ('محمود علي',   'warehouse', '+970 599 000 333', 'mahmoud@alquds.com', 'active', 1000.00),
                ('ليلى خالد',   'admin',     '+970 599 000 444', 'layla@alquds.com',   'active', 1500.00)
            `);
            console.log('✅ Demo staff seeded');
        }

        console.log('🎉 Migration complete!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
