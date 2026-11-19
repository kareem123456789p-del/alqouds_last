const db = require('./db');
async function check() {
    const [rows] = await db.query('SELECT * FROM permissions ORDER BY category, id');
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
}
check();
