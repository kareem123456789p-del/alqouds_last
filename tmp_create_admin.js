const bcrypt = require('bcrypt');
const db = require('./db');

async function createAdmin() {
    try {
        const password = 'admin';
        const hash = await bcrypt.hash(password, 10);
        
        // Check if admin already exists
        const [existing] = await db.query("SELECT * FROM staff WHERE registration_number = '1000'");
        if (existing.length > 0) {
            console.log("Admin exists, updating password to 'admin'");
            await db.query("UPDATE staff SET password_hash = $1, role = 'ADMIN' WHERE id = $2", [hash, existing[0].id]);
        } else {
            console.log("Creating new Admin user");
            await db.query(`
                INSERT INTO staff (name, registration_number, role, status, password_hash) 
                VALUES ('System Admin', '1000', 'ADMIN', 'active', $1)
            `, [hash]);
        }
        console.log("Admin registration number: 1000, password: admin");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

createAdmin();
