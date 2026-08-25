const fs = require('fs');
let code = fs.readFileSync('controllers/importController.js', 'utf8');

code = code.replace(
    /SELECT id, company_name, contact_person FROM local_suppliers ORDER BY company_name'/g,
    `SELECT id, company_name, contact_person FROM local_suppliers WHERE branch_id = ? ORDER BY company_name', [req.branchId]`
);

code = code.replace(
    /FROM import_logs il\s*LEFT JOIN products p ON il\.product_id = p\.id\s*LEFT JOIN local_suppliers ls ON il\.supplier_id = ls\.id\s*LEFT JOIN warehouses w ON il\.warehouse_id = w\.id\s*ORDER BY il\.created_at DESC\s*LIMIT 100/g,
    `FROM import_logs il
            LEFT JOIN products p ON il.product_id = p.id
            LEFT JOIN local_suppliers ls ON il.supplier_id = ls.id
            LEFT JOIN warehouses w ON il.warehouse_id = w.id
            WHERE il.branch_id = ?
            ORDER BY il.created_at DESC
            LIMIT 100\`, [req.branchId]`
);

fs.writeFileSync('controllers/importController.js', code);
console.log('Fixed importController.js queries');
