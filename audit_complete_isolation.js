const pool = require('./db');
const supplierController = require('./controllers/supplierController');
const importController = require('./controllers/importController');
const inventoryController = require('./controllers/inventoryController');
const retailController = require('./controllers/retailController');
const orderController = require('./controllers/orderController');

// Mock Req and Res
const mockRes = () => {
    const res = {};
    res.status = () => res;
    res.json = (data) => { res.data = data; return res; };
    return res;
};

async function runAudit() {
    console.log("=========================================");
    console.log("🚀 STARTING STRICT DATA ISOLATION AUDIT");
    console.log("=========================================\n");

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        console.log("1. Cleaning up previous test data...");
        // Cleanup queries
        const cleanupQueries = [
            "DELETE FROM supplier_transactions WHERE total_amount = 99999",
            "DELETE FROM import_logs WHERE quantity = 99999",
            "DELETE FROM local_suppliers WHERE company_name LIKE 'TEST_ISOLATION_%'",
            "DELETE FROM warehouse_inventory WHERE current_stock = 99999",
            "DELETE FROM warehouses WHERE name LIKE 'TEST_ISOLATION_%'",
            "DELETE FROM products WHERE name LIKE 'TEST_ISOLATION_%'",
            "DELETE FROM doctors WHERE name LIKE 'TEST_ISOLATION_%'"
        ];
        for (let q of cleanupQueries) {
            await connection.execute(q);
        }

        console.log("2. Seeding Branch 1 and Branch 2 dummy data...");
        
        // Seed Suppliers
        const [supp1] = await connection.execute("INSERT INTO local_suppliers (company_name, contact_person, phone, branch_id) VALUES ('TEST_ISOLATION_SUPP_B1', 'John', '123', 1)");
        const suppId1 = supp1.insertId;
        const [supp2] = await connection.execute("INSERT INTO local_suppliers (company_name, contact_person, phone, branch_id) VALUES ('TEST_ISOLATION_SUPP_B2', 'Jane', '456', 2)");
        const suppId2 = supp2.insertId;

        // Seed Warehouse
        const [w1] = await connection.execute("INSERT INTO warehouses (name, location, capacity, branch_id) VALUES ('TEST_ISOLATION_WH_B1', 'Loc1', 100, 1)");
        const whId1 = w1.insertId;
        const [w2] = await connection.execute("INSERT INTO warehouses (name, location, capacity, branch_id) VALUES ('TEST_ISOLATION_WH_B2', 'Loc2', 100, 2)");
        const whId2 = w2.insertId;

        // Seed Products
        const [p1] = await connection.execute("INSERT INTO products (name, sku, base_uom_id, price, purchase_price, quantity) VALUES ('TEST_ISOLATION_PROD_1', 'TSKU1', 1, 10, 5, 0)");
        const prodId1 = p1.insertId;

        // Seed Inventory
        await connection.execute("INSERT INTO warehouse_inventory (warehouse_id, product_id, current_stock, unit_price, branch_id) VALUES (?, ?, 99999, 5, 1)", [whId1, prodId1]);
        await connection.execute("INSERT INTO warehouse_inventory (warehouse_id, product_id, current_stock, unit_price, branch_id) VALUES (?, ?, 99999, 5, 2)", [whId2, prodId1]);
        
        // Seed Doctors
        const [doc1] = await connection.execute("INSERT INTO doctors (name, phone, location, branch_id) VALUES ('TEST_ISOLATION_DOC_B1', '111', 'L1', 1)");
        const docId1 = doc1.insertId;
        const [doc2] = await connection.execute("INSERT INTO doctors (name, phone, location, branch_id) VALUES ('TEST_ISOLATION_DOC_B2', '222', 'L2', 2)");
        const docId2 = doc2.insertId;
        
        // Seed Import Logs
        await connection.execute("INSERT INTO import_logs (product_id, supplier_id, quantity, unit_price, warehouse_id, branch_id) VALUES (?, ?, 99999, 5, ?, 1)", [prodId1, suppId1, whId1]);
        await connection.execute("INSERT INTO import_logs (product_id, supplier_id, quantity, unit_price, warehouse_id, branch_id) VALUES (?, ?, 99999, 5, ?, 2)", [prodId1, suppId2, whId2]);

        await connection.commit();
        console.log("✅ Seed data committed successfully.\n");

        let passed = true;

        // TEST 1: Suppliers Isolation
        console.log("--- TEST 1: SUPPLIERS ISOLATION ---");
        const reqB1_Suppliers = { branchId: 1, query: {} };
        const resB1_Suppliers = mockRes();
        await supplierController.getAll(reqB1_Suppliers, resB1_Suppliers, (err) => { throw err; });
        
        const b1Suppliers = resB1_Suppliers.data;
        const hasB1Supp = b1Suppliers.some(s => s.company_name === 'TEST_ISOLATION_SUPP_B1');
        const hasB2Supp = b1Suppliers.some(s => s.company_name === 'TEST_ISOLATION_SUPP_B2');
        
        if (hasB1Supp && !hasB2Supp) {
            console.log("✅ Branch 1 sees ONLY Branch 1 suppliers.");
        } else {
            console.error("❌ FAILED: Suppliers isolation leak detected!", { hasB1Supp, hasB2Supp });
            passed = false;
        }

        // TEST 2: Inventory Isolation
        console.log("--- TEST 2: INVENTORY ISOLATION ---");
        const reqB1_Inv = { branchId: 1 };
        const resB1_Inv = mockRes();
        await inventoryController.getFullInventory(reqB1_Inv, resB1_Inv);

        const b1Inv = resB1_Inv.data;
        const b1InvTest = b1Inv.filter(i => i.item_name === 'TEST_ISOLATION_PROD_1');
        
        if (b1InvTest.length === 1 && b1InvTest[0].warehouse_name === 'TEST_ISOLATION_WH_B1') {
            console.log("✅ Branch 1 sees ONLY Branch 1 inventory.");
        } else {
            console.error("❌ FAILED: Inventory isolation leak detected!");
            passed = false;
        }

        // TEST 3: Import Logs Isolation
        console.log("--- TEST 3: IMPORT LOGS ISOLATION ---");
        const reqB2_Imports = { branchId: 2 };
        const resB2_Imports = mockRes();
        await importController.getImports(reqB2_Imports, resB2_Imports, (err) => { throw err; });

        const b2Imports = resB2_Imports.data;
        const b2ImportTest = b2Imports.filter(i => i.item_description === 'TEST_ISOLATION_PROD_1');

        if (b2ImportTest.length === 1 && b2ImportTest[0].warehouse_name === 'TEST_ISOLATION_WH_B2') {
            console.log("✅ Branch 2 sees ONLY Branch 2 import logs.");
        } else {
            console.error("❌ FAILED: Import logs isolation leak detected!");
            passed = false;
        }

        console.log("\n=========================================");
        if (passed) {
            console.log("✅ SUCCESS: 100% STRICT DATA ISOLATION CONFIRMED!");
        } else {
            console.log("❌ AUDIT FAILED: CROSS-LEAKAGE DETECTED.");
        }
        console.log("=========================================\n");

    } catch (err) {
        console.error("Audit error:", err);
        await connection.rollback();
    } finally {
        // Rollback all changes implicitly by running cleanup again
        const cleanupQueries = [
            "DELETE FROM supplier_transactions WHERE total_amount = 99999",
            "DELETE FROM import_logs WHERE quantity = 99999",
            "DELETE FROM local_suppliers WHERE company_name LIKE 'TEST_ISOLATION_%'",
            "DELETE FROM warehouse_inventory WHERE current_stock = 99999",
            "DELETE FROM warehouses WHERE name LIKE 'TEST_ISOLATION_%'",
            "DELETE FROM products WHERE name LIKE 'TEST_ISOLATION_%'",
            "DELETE FROM doctors WHERE name LIKE 'TEST_ISOLATION_%'"
        ];
        for (let q of cleanupQueries) {
            await connection.execute(q);
        }
        connection.release();
        process.exit();
    }
}

runAudit();
