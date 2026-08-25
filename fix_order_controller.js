const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'controllers/orderController.js');
let content = fs.readFileSync(file, 'utf8');

// 1. Fix updateClientDebt function definition
content = content.replace(
    'async function updateClientDebt(connection, client, isDoctor, amount, type, orderId) {',
    'async function updateClientDebt(connection, client, isDoctor, amount, type, orderId, branchId) {'
);

// 2. Fix client_transactions insertions in updateClientDebt
content = content.replace(
    "'INSERT INTO client_transactions (client_id, type, amount, reference_id) VALUES (?, ?, ?, ?)',\n            [client.id, type, amount, orderId]",
    "'INSERT INTO client_transactions (client_id, type, amount, reference_id, branch_id) VALUES (?, ?, ?, ?, ?)',\n            [client.id, type, amount, orderId, branchId]"
);
content = content.replace(
    "'INSERT INTO client_transactions (pharmacy_id, type, amount, reference_id) VALUES (?, ?, ?, ?)',\n            [client.id, type, amount, orderId]",
    "'INSERT INTO client_transactions (pharmacy_id, type, amount, reference_id, branch_id) VALUES (?, ?, ?, ?, ?)',\n            [client.id, type, amount, orderId, branchId]"
);

// 3. Fix createOrder calling updateClientDebt
content = content.replace(
    "await updateClientDebt(connection, client, isDoctor, totalAmount, 'ORDER', orderId);",
    "await updateClientDebt(connection, client, isDoctor, totalAmount, 'ORDER', orderId, req.branchId);"
);

// 4. Fix createOrder order_items insertion
content = content.replace(
    "INSERT INTO order_items (order_id, product_id, warehouse_id, qty, base_price, unit_price, profit_margin, subtotal, inventory_id)\\n                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    "INSERT INTO order_items (order_id, product_id, warehouse_id, qty, base_price, unit_price, profit_margin, subtotal, inventory_id, branch_id)\\n                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
);
content = content.replace(
    "subtotal,\n                    item.inventory_id || null\n                ]",
    "subtotal,\n                    item.inventory_id || null,\n                    req.branchId\n                ]"
);

// 5. Fix processReturn calling updateClientDebt
content = content.replace(
    "await updateClientDebt(connection, client, isDoctor, -totalReturnAmount, 'RETURN', orderId);",
    "await updateClientDebt(connection, client, isDoctor, -totalReturnAmount, 'RETURN', orderId, req.branchId);"
);

// 6. Fix cancelOrder calling updateClientDebt
content = content.replace(
    "await updateClientDebt(connection, client, isDoctor, -parseFloat(order.total_amount), 'CANCEL', orderId);",
    "await updateClientDebt(connection, client, isDoctor, -parseFloat(order.total_amount), 'CANCEL', orderId, req.branchId);"
);

fs.writeFileSync(file, content, 'utf8');
console.log('orderController.js updated successfully.');
