const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:kareem@localhost:5432/alquods_db' });

pool.query("SELECT table_name FROM information_schema.columns WHERE column_name = 'branch_id'")
  .then(res => {
      console.log('Tables with branch_id:');
      console.log(res.rows.map(r => r.table_name));
  })
  .then(() => pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"))
  .then(res => {
      console.log('All tables:');
      console.log(res.rows.map(r => r.table_name));
  })
  .catch(console.error)
  .finally(() => pool.end());
