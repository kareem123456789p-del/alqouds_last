const db = require('./db');

async function getAllUsers() {
    try {
        const [users] = await db.query("SELECT id, name, registration_number, role, status FROM staff");
        console.log(users);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

getAllUsers();
