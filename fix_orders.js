const fs = require('fs');
let code = fs.readFileSync('controllers/orderController.js', 'utf8');

// getOrders
code = code.replace(
    /SELECT COUNT\(\*\) AS total FROM orders/g,
    `SELECT COUNT(*) AS total FROM orders WHERE branch_id = \${req.branchId}`
);
code = code.replace(
    /LEFT JOIN pharmacies p ON o\.pharmacy_id = p\.id\s*ORDER BY o\.created_at DESC/g,
    `LEFT JOIN pharmacies p ON o.pharmacy_id = p.id
            WHERE o.branch_id = \${req.branchId}
            ORDER BY o.created_at DESC`
);

// createOrder
code = code.replace(
    /INSERT INTO orders \(order_number, client_id, pharmacy_id, warehouse_id, expected_delivery, total_amount, status\) VALUES \(\?, \?, \?, \?, \?, \?, 'Pending'\)/g,
    `INSERT INTO orders (order_number, client_id, pharmacy_id, warehouse_id, expected_delivery, total_amount, status, branch_id) VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?)`
);
code = code.replace(
    /\[orderNumber, dbClientId, dbPharmacyId, warehouse_id, expected_delivery \|\| null, totalAmount\]/g,
    `[orderNumber, dbClientId, dbPharmacyId, warehouse_id, expected_delivery || null, totalAmount, req.branchId]`
);

// dispatchOrder, processReturn, cancelOrder
code = code.replace(
    /SELECT \* FROM orders WHERE id = \?/g,
    `SELECT * FROM orders WHERE id = ? AND branch_id = ?`
);
code = code.replace(
    /\[orderId\]/g,
    `[orderId, req.branchId]`
); // This replaces ALL [orderId], including `WHERE order_id = ?` for order_items. That's fine if I change order_items too, wait, no!
// Let me revert that global replace. I'll be more specific.

code = code.replace(/\[orderId, req\.branchId\]/g, `[orderId]`); // undo

code = code.replace(
    /SELECT \* FROM orders WHERE id = \?',\s*\[orderId\]/g,
    `SELECT * FROM orders WHERE id = ? AND branch_id = ?', [orderId, req.branchId]`
);

// getClientHistory
code = code.replace(
    /WHERE \$\{whereCol\} = \$\{id\}\s*ORDER BY o\.created_at DESC/g,
    `WHERE \${whereCol} = \${id} AND o.branch_id = \${req.branchId}
            ORDER BY o.created_at DESC`
);

fs.writeFileSync('controllers/orderController.js', code);
console.log('Fixed orderController.js');
