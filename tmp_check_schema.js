const pool = require('./db');

async function check() {
    try {
        const [wi] = await pool.query('DESCRIBE warehouse_inventory');
        console.log("== warehouse_inventory ==");
        console.table(wi);

        const [oi] = await pool.query('DESCRIBE order_items');
        console.log("\n== order_items ==");
        console.table(oi);

    } catch(e) { console.error(e); }
    process.exit(0);
}
check();
