const db = require('./db');
const bcrypt = require('bcrypt');

async function migrate() {
    try {
        console.log('Migrating staff table...');
        
        // Add columns
        await db.execute(`
            ALTER TABLE staff 
            ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100) UNIQUE,
            ADD COLUMN IF NOT EXISTS password_hash TEXT,
            ADD COLUMN IF NOT EXISTS branch_id INT DEFAULT 1;
        `);
        
        // Remove NOT NULL from email if it exists (in Postgres, we can drop NOT NULL constraint)
        await db.execute(`ALTER TABLE staff ALTER COLUMN email DROP NOT NULL;`);

        // Generate a password hash for default password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('123456', salt);

        // Update existing users
        const [users] = await db.execute(`SELECT * FROM staff`);
        
        let startRegNo = 1101;
        for (const user of users) {
            await db.execute(`UPDATE staff SET registration_number = $1, password_hash = $2 WHERE id = $3`, [startRegNo.toString(), hashedPassword, user.id]);
            startRegNo++;
        }
        
        console.log('Migration completed.');
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
migrate();
