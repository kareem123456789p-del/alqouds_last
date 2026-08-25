const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'controllers/dashboardController.js');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    "pool.execute(\"SELECT COUNT(*) as count FROM orders WHERE status = 'Pending'\"),",
    "pool.execute(\"SELECT COUNT(*) as count FROM orders WHERE status = 'Pending' AND branch_id = ?\", [req.branchId]),"
);

content = content.replace(
    "pool.execute(\"SELECT SUM(total_amount) as total FROM orders WHERE status = 'Dispatched'\"),",
    "pool.execute(\"SELECT SUM(total_amount) as total FROM orders WHERE status = 'Dispatched' AND branch_id = ?\", [req.branchId]),"
);

content = content.replace(
    "pool.execute(\"SELECT COALESCE(SUM(w.current_stock * p.price), 0) as total_value, COALESCE(SUM(w.current_stock), 0) as total_items FROM warehouse_inventory w JOIN products p ON w.product_id = p.id\"),",
    "pool.execute(\"SELECT COALESCE(SUM(w.current_stock * p.price), 0) as total_value, COALESCE(SUM(w.current_stock), 0) as total_items FROM warehouse_inventory w JOIN products p ON w.product_id = p.id WHERE w.branch_id = ?\", [req.branchId]),"
);

content = content.replace(
    "pool.execute(\"SELECT COUNT(*) as count FROM doctors\"),",
    "pool.execute(\"SELECT COUNT(*) as count FROM doctors WHERE branch_id = ?\", [req.branchId]),"
);

content = content.replace(
    "pool.execute(\"SELECT COUNT(*) as count FROM warehouses\")",
    "pool.execute(\"SELECT COUNT(*) as count FROM warehouses\") // warehouses don't strictly have branch_id typically, but we added it. So: WHERE branch_id = ?\", [req.branchId])"
);
content = content.replace("So: WHERE branch_id = ?\", [req.branchId])", "pool.execute(\"SELECT COUNT(*) as count FROM warehouses WHERE branch_id = ?\", [req.branchId])");
// Let's just do a clean replace for the warehouses line:
content = content.replace(
    "pool.execute(\"SELECT COUNT(*) as count FROM warehouses\") // warehouses don't strictly have branch_id typically, but we added it. pool.execute(\"SELECT COUNT(*) as count FROM warehouses WHERE branch_id = ?\", [req.branchId])",
    "pool.execute(\"SELECT COUNT(*) as count FROM warehouses WHERE branch_id = ?\", [req.branchId])"
);

fs.writeFileSync(file, content, 'utf8');
