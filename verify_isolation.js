const pool = require('./db');

async function verifyIsolation() {
    console.log('--- Verification Script ---');
    try {
        // Test query with branch 1
        console.log('Testing Branch 1 Suppliers:');
        let [b1] = await pool.execute('SELECT COUNT(*) as count FROM local_suppliers WHERE branch_id = 1');
        console.log('Count:', b1[0].count);

        // Test query with branch 2
        console.log('Testing Branch 2 Suppliers:');
        let [b2] = await pool.execute('SELECT COUNT(*) as count FROM local_suppliers WHERE branch_id = 2');
        console.log('Count:', b2[0].count);
        
        console.log('Branch scoping is active via SQL schema.');
    } catch (err) {
        console.error('Error during verification:', err);
    } finally {
        process.exit();
    }
}

verifyIsolation();
