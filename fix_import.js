const fs = require('fs');
let code = fs.readFileSync('controllers/importController.js', 'utf8');

// Add branch_id to warehouse_inventory SELECT and UPDATE and INSERT
code = code.replace(
    /SELECT id FROM warehouse_inventory WHERE warehouse_id = \? AND product_id = \?'/g,
    `SELECT id FROM warehouse_inventory WHERE warehouse_id = ? AND product_id = ? AND branch_id = ?'`
);
code = code.replace(
    /const queryParams = \[warehouse_id, product_id\];/g,
    `const queryParams = [warehouse_id, product_id, req.branchId];`
);

code = code.replace(
    /UPDATE warehouse_inventory SET current_stock = current_stock \+ \?, qty_threshold = \?, expiry_month_threshold = \?, unit_price = \? WHERE id = \?'/g,
    `UPDATE warehouse_inventory SET current_stock = current_stock + ?, qty_threshold = ?, expiry_month_threshold = ?, unit_price = ? WHERE id = ? AND branch_id = ?'`
);
code = code.replace(
    /\[qty, qtyThresholdVal, expiryMonthThresholdVal, price, inventoryCheck\[0\]\.id\]/g,
    `[qty, qtyThresholdVal, expiryMonthThresholdVal, price, inventoryCheck[0].id, req.branchId]`
);

code = code.replace(
    /INSERT INTO warehouse_inventory\s*\(\s*warehouse_id, product_id, current_stock, batch_number, expiry_date, qty_threshold, expiry_month_threshold, unit_price\s*\)\s*VALUES \(\?, \?, \?, \?, \?, \?, \?, \?\)/g,
    `INSERT INTO warehouse_inventory
                        (warehouse_id, product_id, current_stock, batch_number, expiry_date, qty_threshold, expiry_month_threshold, unit_price, branch_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
code = code.replace(
    /\[warehouse_id, product_id, qty, batchQueryValue, expiryQueryValue, qtyThresholdVal, expiryMonthThresholdVal, price\]/g,
    `[warehouse_id, product_id, qty, batchQueryValue, expiryQueryValue, qtyThresholdVal, expiryMonthThresholdVal, price, req.branchId]`
);

// Add branch_id to import_logs INSERT
code = code.replace(
    /INSERT INTO import_logs\s*\(\s*product_id, supplier_id, quantity, unit_price, warehouse_id, shipment_id, invoice_image\s*\)\s*VALUES \(\?, \?, \?, \?, \?, \?, \?\)/g,
    `INSERT INTO import_logs
                        (product_id, supplier_id, quantity, unit_price, warehouse_id, shipment_id, invoice_image, branch_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);
code = code.replace(
    /\[product_id, supplier_id, qty, price, warehouse_id, shipmentId, invoiceImagePath\]/g,
    `[product_id, supplier_id, qty, price, warehouse_id, shipmentId, invoiceImagePath, req.branchId]`
);

// Add branch_id to supplier_transactions INSERT ?
// Wait, supplier_transactions didn't have branch_id according to previous logic, we use local_suppliers for it.
// But we didn't add branch_id to supplier_transactions table, so we don't modify the INSERT INTO supplier_transactions.

// What about getAllImports?
code = code.replace(
    /SELECT il\.\*, p\.name AS product_name, s\.company_name AS supplier_name\s*FROM import_logs il\s*JOIN products p ON il\.product_id = p\.id\s*LEFT JOIN local_suppliers s ON il\.supplier_id = s\.id\s*ORDER BY il\.created_at DESC/g,
    `SELECT il.*, p.name AS product_name, s.company_name AS supplier_name
             FROM import_logs il
             JOIN products p ON il.product_id = p.id
             LEFT JOIN local_suppliers s ON il.supplier_id = s.id
             WHERE il.branch_id = ?
             ORDER BY il.created_at DESC`
);

code = code.replace(
    /pool\.query\(\s*query\s*\)/g,
    `pool.query(query, [req.branchId])`
);

fs.writeFileSync('controllers/importController.js', code);
console.log('Fixed importController.js');
