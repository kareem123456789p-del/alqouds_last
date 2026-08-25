const db = require('./db');

async function migrateRBAC() {
    try {
        console.log('Starting RBAC migration...');

        // 1. Create branches table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS branches (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                address TEXT,
                phone VARCHAR(50),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Create permissions table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS permissions (
                id SERIAL PRIMARY KEY,
                key VARCHAR(100) UNIQUE NOT NULL,
                description TEXT,
                category VARCHAR(100) NOT NULL
            );
        `);

        // 3. Create staff_permissions table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS staff_permissions (
                staff_id INT NOT NULL,
                permission_key VARCHAR(100) NOT NULL,
                PRIMARY KEY (staff_id, permission_key),
                CONSTRAINT fk_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
                CONSTRAINT fk_permission FOREIGN KEY (permission_key) REFERENCES permissions(key) ON DELETE CASCADE
            );
        `);

        // Seed Branches
        const [branches] = await db.query(`SELECT count(*) as count FROM branches`);
        if (parseInt(branches[0].count) === 0) {
            console.log('Seeding branches...');
            await db.execute(`INSERT INTO branches (name) VALUES ('الفرع الرئيسي'), ('الفرع الثاني')`);
        }

        // Seed Permissions
        const [perms] = await db.query(`SELECT count(*) as count FROM permissions`);
        if (parseInt(perms[0].count) === 0) {
            console.log('Seeding permissions...');
            const seedPerms = [
                ['pos_access', 'Access to Point of Sale', 'POS'],
                ['inventory_edit', 'Edit Inventory items', 'Inventory'],
                ['stock_transfer_approve', 'Approve stock transfers', 'Transfers'],
                ['reports_view', 'View system reports', 'Reports'],
                ['expenses_manage', 'Manage expenses', 'Expenses'],
                ['system_settings', 'Manage system settings', 'Settings']
            ];
            for (const p of seedPerms) {
                await db.execute(`INSERT INTO permissions (key, description, category) VALUES ($1, $2, $3)`, p);
            }
        }

        console.log('RBAC Migration completed.');
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        process.exit();
    }
}

migrateRBAC();
