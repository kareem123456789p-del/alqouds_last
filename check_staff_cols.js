const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:kareem@localhost:5432/alquods_db' });
pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'staff'").then(res => {
    console.log(res.rows.map(r => r.column_name));
    process.exit(0);
});
