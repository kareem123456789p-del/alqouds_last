const pool = require('./db');

async function fixData() {
    try {
        console.log('--- Database Cleanup Verification ---');
        
        // 1. Update Hossam to Branch 2
        await pool.execute("UPDATE staff SET branch_id = 2 WHERE name LIKE '%حسام%'");
        console.log('✅ Updated Hossam to branch_id = 2');

        // 2. Update Islam to Branch 1
        await pool.execute("UPDATE staff SET branch_id = 1 WHERE name LIKE '%اسلام%'");
        console.log('✅ Updated Islam to branch_id = 1');

        // 3. Find any data created by Hossam and ensure it is branch 2
        // Since we don't have a created_by field for suppliers/doctors/etc in the schema,
        // we'll update any records that might belong to him if there is any mapping.
        // Wait, did Hossam create some specific data recently?
        // Let's just update anything inserted recently (id > some number) just in case.
        // I will just fetch and see if anything has branch_id = 2.
        
        const [staff] = await pool.execute('SELECT id, name, branch_id FROM staff WHERE name LIKE \'%حسام%\' OR name LIKE \'%اسلام%\'');
        console.log('Staff after update:', staff);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

fixData();
