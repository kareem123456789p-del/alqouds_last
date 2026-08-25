const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:kareem@localhost:5432/alquods_db' });

async function main() {
    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    const allTables = res.rows.map(r => r.table_name);
    
    for (const table of allTables) {
        // Check if branch_id exists
        const colRes = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = 'branch_id'`, [table]);
        if (colRes.rows.length === 0) {
            console.log(`Adding branch_id to ${table}`);
            await pool.query(`ALTER TABLE "${table}" ADD COLUMN branch_id INT DEFAULT 1`);
            // we will set it NOT NULL later if needed, but for now just add it.
        }
    }
    console.log("Done.");
}

main().catch(console.error).finally(() => pool.end());
