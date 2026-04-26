const pool = require('../db');
const fs = require('fs');
async function check() {
    try {
        const [rows] = await pool.execute('SHOW CREATE TABLE warehouse_inventory');
        fs.writeFileSync('schema.txt', rows[0]['Create Table']);
    } catch (e) {
        console.error("Error:", e.message);
    }
    process.exit();
}
check();
