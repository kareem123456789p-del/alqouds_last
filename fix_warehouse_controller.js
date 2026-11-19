const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'controllers/warehouseController.js');
let content = fs.readFileSync(file, 'utf8');

// 1. Fix getStats
content = content.replace(
    "'SELECT COUNT(*) AS warehouseCount FROM warehouses'",
    "'SELECT COUNT(*) AS warehouseCount FROM warehouses WHERE branch_id = ?', [req.branchId]"
);

// 2. Fix getWarehouses
content = content.replace(
    "GROUP BY w.id, w.name, w.location, w.capacity",
    "WHERE w.branch_id = ${req.branchId}\n            GROUP BY w.id, w.name, w.location, w.capacity"
);

// 3. Fix createWarehouse
content = content.replace(
    "'INSERT INTO warehouses (name, location, capacity) VALUES (?, ?, ?)',\n            [name.trim(), location.trim(), parseInt(capacity) || 10000]",
    "'INSERT INTO warehouses (name, location, capacity, branch_id) VALUES (?, ?, ?, ?)',\n            [name.trim(), location.trim(), parseInt(capacity) || 10000, req.branchId]"
);
content = content.replace(
    "`SELECT id, name, location, capacity, 0 AS total_stock, 0 AS product_count FROM warehouses WHERE id = ?`,",
    "`SELECT id, name, location, capacity, 0 AS total_stock, 0 AS product_count FROM warehouses WHERE id = ? AND branch_id = ?`,"
);
content = content.replace(
    "[result.insertId]",
    "[result.insertId, req.branchId]"
);

// 4. Fix updateWarehouse
content = content.replace(
    "'UPDATE warehouses SET name = ?, location = ?, capacity = ? WHERE id = ?',\n            [name.trim(), location.trim(), parseInt(capacity) || 10000, id]",
    "'UPDATE warehouses SET name = ?, location = ?, capacity = ? WHERE id = ? AND branch_id = ?',\n            [name.trim(), location.trim(), parseInt(capacity) || 10000, id, req.branchId]"
);

// 5. Fix deleteWarehouse
content = content.replace(
    "'DELETE FROM warehouses WHERE id = ?', [id]",
    "'DELETE FROM warehouses WHERE id = ? AND branch_id = ?', [id, req.branchId]"
);

fs.writeFileSync(file, content, 'utf8');
console.log('warehouseController.js updated successfully.');
