const pool = require('./db');

const permissions = [
    {
        key: 'MANAGE_WAREHOUSES_ADD',
        description: 'إضافة مخزن جديد',
        category: 'Warehouses & Inventory / إدارة المخازن والمخزون',
        branch_id: 1
    },
    {
        key: 'MANAGE_WAREHOUSES_EDIT',
        description: 'تعديل بيانات المخزن',
        category: 'Warehouses & Inventory / إدارة المخازن والمخزون',
        branch_id: 1
    },
    {
        key: 'MANAGE_WAREHOUSES_DELETE',
        description: 'حذف مخزن',
        category: 'Warehouses & Inventory / إدارة المخازن والمخزون',
        branch_id: 1
    },
    {
        key: 'DOWNLOAD_INVENTORY_AUDIT',
        description: 'تحميل تقرير الجرد',
        category: 'Warehouses & Inventory / إدارة المخازن والمخزون',
        branch_id: 1
    },
    {
        key: 'PRINT_OFFICIAL_DECLARATION',
        description: 'طباعة الإقرار / التقرير',
        category: 'Warehouses & Inventory / إدارة المخازن والمخزون',
        branch_id: 1
    },
    {
        key: 'VIEW_STOCK_QUANTITY_AND_PRICES',
        description: 'عرض كميات وأسعار البضاعة والقيمة المالية',
        category: 'Warehouses & Inventory / إدارة المخازن والمخزون',
        branch_id: 1
    }
];

async function migrateWarehousePermissions() {
    try {
        console.log('Starting warehouse permissions migration...');

        // Ensure branch_id column exists if not already present
        try {
            await pool.query(`ALTER TABLE permissions ADD COLUMN IF NOT EXISTS branch_id INT DEFAULT 1`);
        } catch (colErr) {
            // Column may already exist or ALTER not needed
        }

        const insertQuery = `
            INSERT INTO permissions (key, description, category, branch_id)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (key) DO NOTHING
        `;

        for (const perm of permissions) {
            await pool.query(insertQuery, [
                perm.key,
                perm.description,
                perm.category,
                perm.branch_id
            ]);
            console.log(`Processed permission: ${perm.key} - ${perm.description}`);
        }

        console.log('✅ Warehouse permissions migration finished successfully.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

migrateWarehousePermissions();
