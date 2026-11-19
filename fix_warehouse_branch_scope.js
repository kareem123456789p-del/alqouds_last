/**
 * Migration: Fix warehouse branch_id constraints and data
 * 
 * 1. Remove DEFAULT 1 from branch_id column to catch missing parameter bugs instantly
 * 2. Re-assign any misattributed warehouses created by Branch 2 staff back to branch_id = 2
 * 
 * Run: node fix_warehouse_branch_scope.js
 */
const pool = require('./db');

async function migrate() {
    console.log("==================================================");
    console.log("🔧 WAREHOUSE BRANCH SCOPE FIX MIGRATION");
    console.log("==================================================\n");

    try {
        // 1. Remove DEFAULT 1 from branch_id to catch missing-param bugs
        console.log("1. Removing DEFAULT 1 from warehouses.branch_id...");
        try {
            await pool.execute('ALTER TABLE warehouses ALTER COLUMN branch_id DROP DEFAULT;');
            console.log("   ✅ DEFAULT removed. Missing branch_id will now cause an error.");
        } catch (e) {
            console.log("   ⚠️  Could not remove default (may already be removed):", e.message);
        }

        // 2. Show current warehouse assignments for audit
        console.log("\n2. Current warehouse assignments:");
        const [warehouses] = await pool.execute(
            'SELECT id, name, location, branch_id FROM warehouses ORDER BY id'
        );
        warehouses.forEach(w => {
            console.log(`   [ID ${w.id}] "${w.name}" — Location: ${w.location} — Branch: ${w.branch_id}`);
        });

        // 3. Re-assign misattributed warehouses
        // Any warehouses that were created by Branch 2 staff but ended up with branch_id = 1
        // due to the missing branch_id in the INSERT query.
        // We check for warehouses with Arabic names or names containing "السيل" that should be Branch 2
        console.log("\n3. Re-assigning misattributed warehouses...");

        const [fixResult] = await pool.execute(
            "UPDATE warehouses SET branch_id = 2 WHERE branch_id = 1 AND (name LIKE '%السيل%' OR name LIKE '%مخزن السيل%')"
        );
        console.log(`   ✅ Fixed Arabic-named warehouses: ${fixResult.affectedRows} row(s) updated.`);

        // 4. Show final state
        console.log("\n4. Final warehouse assignments:");
        const [final] = await pool.execute(
            'SELECT id, name, location, branch_id FROM warehouses ORDER BY id'
        );
        final.forEach(w => {
            console.log(`   [ID ${w.id}] "${w.name}" — Location: ${w.location} — Branch: ${w.branch_id}`);
        });

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
