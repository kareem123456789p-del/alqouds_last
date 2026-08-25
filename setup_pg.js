const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function initDB() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:kareem@localhost:5432/alquods_db';

  console.log(`🚀 Trying to connect to PostgreSQL: ${connectionString.replace(/:[^:@]+@/, ':***@')}`);

  // We connect to 'postgres' first to create the database if it doesn't exist
  const baseClient = new Client({
    connectionString: connectionString.replace('/alquods_db', '/postgres'),
  });

  try {
    await baseClient.connect();
    const res = await baseClient.query("SELECT 1 FROM pg_database WHERE datname = 'alquods_db'");
    if (res.rowCount === 0) {
      console.log('📦 Database "alquods_db" does not exist. Creating it...');
      await baseClient.query('CREATE DATABASE alquods_db');
      console.log('✅ Database "alquods_db" created!');
    } else {
      console.log('✅ Database "alquods_db" already exists.');
    }
  } catch (err) {
    console.error('❌ Error checking/creating database:', err.message);
    process.exit(1);
  } finally {
    await baseClient.end();
  }

  // Now connect to the actual database to run the setup script
  const dbClient = new Client({ connectionString });
  
  try {
    await dbClient.connect();
    console.log('✅ Connected to alquods_db!');

    const sqlPath = path.join(__dirname, 'setup_pg.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📜 Running setup_pg.sql...');
    await dbClient.query(sql);

    console.log('🎉 SUCCESS! Setup complete. All tables created and seeded.');
    console.log('🚀 You can now run "npm run dev"');
  } catch (err) {
    console.error('❌ Error executing setup_pg.sql:');
    console.error(err.message);
  } finally {
    await dbClient.end();
  }
}

initDB();
