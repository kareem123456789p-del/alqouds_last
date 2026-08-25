const db = require('./db');

async function migrateBranchScoping() {
    try {
        console.log('Starting Branch Scoping Migration...');

        // Tables mapping based on actual database structure
        const targetTables = [
            'warehouse_inventory', 
            'import_logs', 
            'orders', 
            'retail_sales', 
            'retail_shifts', 
            'pharmacies', 
            'doctors', 
            'payments', 
            'employee_withdrawals'
        ];

        // 1. Add branch_id to each table if it doesn't exist
        for (const table of targetTables) {
            console.log(`Processing table: ${table}`);
            
            // Add column if not exists
            try {
                await db.execute(`
                    ALTER TABLE ${table}
                    ADD COLUMN IF NOT EXISTS branch_id INT DEFAULT 1;
                `);
            } catch (err) {
                console.log(`Column might already exist in ${table} or error: ${err.message}`);
            }

            // Backfill existing records (already handled by DEFAULT 1, but we ensure it)
            await db.execute(`UPDATE ${table} SET branch_id = 1 WHERE branch_id IS NULL;`);

            // Add FK constraint safely
            try {
                // Drop first if it exists to avoid duplicate constraint errors
                await db.execute(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS fk_${table}_branch`);
                await db.execute(`
                    ALTER TABLE ${table}
                    ADD CONSTRAINT fk_${table}_branch
                    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT;
                `);
            } catch (err) {
                 console.log(`FK constraint issue for ${table}: ${err.message}`);
            }

            // Add Index
            await db.execute(`CREATE INDEX IF NOT EXISTS idx_${table}_branch ON ${table}(branch_id);`);
        }

        console.log('Branch Scoping Migration Completed.');
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        process.exit();
    }
}

migrateBranchScoping();
