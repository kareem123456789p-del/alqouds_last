const pool = require('./db');

async function migrate() {
    console.log("==================================================");
    console.log("🚀 STARTING WAREHOUSES STRICT ISOLATION MIGRATION");
    console.log("==================================================\n");

    try {
        // Ensure branch_id exists and create index
        console.log("1. Adding branch_id to warehouses (if not exists) and creating index...");
        try {
            await pool.execute('ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS branch_id INT DEFAULT 1;');
            console.log("✅ Column branch_id verified.");
        } catch (e) {
            console.log("Column might already exist:", e.message);
        }

        try {
            await pool.execute('CREATE INDEX IF NOT EXISTS idx_warehouses_branch ON warehouses(branch_id);');
            console.log("✅ Index idx_warehouses_branch created/verified.");
        } catch (e) {
            console.log("Index creation error:", e.message);
        }

        // Add foreign key constraint if it doesn't exist
        console.log("2. Verifying foreign key constraint for branch_id...");
        try {
            // Drop it just in case, then recreate to be sure
            await pool.execute('ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS fk_warehouses_branch;');
            await pool.execute('ALTER TABLE warehouses ADD CONSTRAINT fk_warehouses_branch FOREIGN KEY (branch_id) REFERENCES branches(id);');
            console.log("✅ Foreign key constraint added/verified.");
        } catch (e) {
            console.log("FK constraint error:", e.message);
        }
        
        // Update "مخزن السيل" to branch 2
        console.log("3. Explicitly scoping specific warehouses...");
        const [updateRes] = await pool.execute("UPDATE warehouses SET branch_id = 2 WHERE name LIKE '%مخزن السيل%';");
        console.log(`✅ Set "مخزن السيل" to Branch 2 (Affected rows: ${updateRes.affectedRows}).`);
        
        // Ensure all other existing warehouses have a non-null branch_id
        const [updateNulls] = await pool.execute("UPDATE warehouses SET branch_id = 1 WHERE branch_id IS NULL;");
        console.log(`✅ Defaulted any NULL branch_id to Branch 1 (Affected rows: ${updateNulls.affectedRows}).`);

        // Enforce NOT NULL
        console.log("4. Enforcing NOT NULL on branch_id...");
        await pool.execute('ALTER TABLE warehouses ALTER COLUMN branch_id SET NOT NULL;');
        console.log("✅ NOT NULL constraint enforced on branch_id.");
        
        console.log("\n==================================================");
        console.log("🎉 MIGRATION COMPLETED SUCCESSFULLY!");
        console.log("==================================================\n");
        process.exit(0);
    } catch (err) {
        console.error("❌ Migration error:", err);
        process.exit(1);
    }
}

migrate();
