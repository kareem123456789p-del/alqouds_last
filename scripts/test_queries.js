const mysql = require('mysql2/promise');

async function testQuery() {
    try {
        const db = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'alquods_db'
        });

        console.log("Testing dashboard stats queries...");

        const [pending] = await db.query("SELECT COUNT(*) as count FROM orders WHERE status = 'Pending'");
        console.log("Pending:", pending);

        const [disp] = await db.query("SELECT SUM(total_amount) as total FROM orders WHERE status = 'Dispatched'");
        console.log("Dispatched:", disp);

        const [inv] = await db.query("SELECT IFNULL(SUM(w.current_stock * p.price), 0) as total_value, IFNULL(SUM(w.current_stock), 0) as total_items FROM warehouse_inventory w JOIN products p ON w.product_id = p.id");
        console.log("Inventory:", inv);

        const [docs] = await db.query("SELECT COUNT(*) as count FROM doctors");
        console.log("Docs:", docs);

        const [wh] = await db.query("SELECT COUNT(*) as count FROM warehouses");
        console.log("Warehouses:", wh);

        await db.end();
        console.log("All queries succeeded.");
    } catch (e) {
        console.error("Query Error:", e.message);
    }
}

testQuery();
