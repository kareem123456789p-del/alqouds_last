const pool = require('./db');

const tablesToUpdate = [
    'local_suppliers',
    'import_logs',
    'warehouse_inventory',
    'pharmacies',
    'doctors',
    'retail_sales',
    'orders',
    'employee_withdrawals',
    'retail_shifts',
    'stock_audit_logs'
];

async function runMigration() {
    console.log('Starting strict isolation migration...');
    const conn = await pool.getConnection();

    try {
        // Ensure default branch exists
        await conn.execute(`
            INSERT INTO branches (id, name, created_at)
            VALUES (1, 'الفرع الرئيسي', NOW())
            ON CONFLICT (id) DO NOTHING;
        `);

        for (const table of tablesToUpdate) {
            console.log(`Processing table: ${table}...`);
            
            // Check if branch_id column exists
            const [cols] = await conn.execute(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = $1 AND column_name = 'branch_id';
            `, [table]);

            if (cols.length === 0) {
                // Add column
                await conn.execute(`
                    ALTER TABLE ${table} 
                    ADD COLUMN branch_id INT DEFAULT 1;
                `);
                console.log(`  Added branch_id to ${table}`);

                // Update existing to 1 (should be covered by DEFAULT, but just to be safe)
                await conn.execute(`
                    UPDATE ${table} SET branch_id = 1 WHERE branch_id IS NULL;
                `);

                // Set NOT NULL and foreign key
                await conn.execute(`
                    ALTER TABLE ${table} 
                    ALTER COLUMN branch_id SET NOT NULL,
                    ADD CONSTRAINT fk_${table}_branch_id 
                        FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
                `);
                console.log(`  Set NOT NULL and FK on ${table}`);
            } else {
                console.log(`  branch_id already exists on ${table}`);
                
                // Ensure it's NOT NULL
                await conn.execute(`UPDATE ${table} SET branch_id = 1 WHERE branch_id IS NULL`);
                await conn.execute(`ALTER TABLE ${table} ALTER COLUMN branch_id SET NOT NULL`);
            }

            // Create index
            await conn.execute(`
                CREATE INDEX IF NOT EXISTS idx_${table}_branch 
                ON ${table}(branch_id);
            `);
            console.log(`  Created index on ${table}`);
        }

        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        conn.release();
        process.exit(0);
    }
}

runMigration();
