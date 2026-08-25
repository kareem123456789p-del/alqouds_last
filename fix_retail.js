const fs = require('fs');
let code = fs.readFileSync('controllers/retailController.js', 'utf8');

// Replace getCurrentShift
code = code.replace(
    /SELECT \* FROM retail_shifts WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1"/g,
    `SELECT * FROM retail_shifts WHERE status = 'OPEN' AND branch_id = ? ORDER BY id DESC LIMIT 1", [req.branchId]`
);

// Replace openShift 
code = code.replace(
    /SELECT \* FROM retail_shifts WHERE status = 'OPEN'"/g,
    `SELECT * FROM retail_shifts WHERE status = 'OPEN' AND branch_id = ?", [req.branchId]`
);
code = code.replace(
    /INSERT INTO retail_shifts \(status\) VALUES \('OPEN'\)"/g,
    `INSERT INTO retail_shifts (status, branch_id) VALUES ('OPEN', ?)", [req.branchId]`
);

// closeShift has getCurrentShift already updated, but wait, the replacement string is globally replaced? No, limit 1.
// Let's replace the EXACT string:
// `"SELECT * FROM retail_shifts WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1"`
// will become `"SELECT * FROM retail_shifts WHERE status = 'OPEN' AND branch_id = ? ORDER BY id DESC LIMIT 1", [req.branchId]`

// recordSale: INSERT INTO retail_sales
code = code.replace(
    /"INSERT INTO retail_sales \(shift_id, total_amount, profit_amount\) VALUES \(\?, \?, \?\)",\s*\[shiftId, totalAmount, totalProfit\]/g,
    `"INSERT INTO retail_sales (shift_id, total_amount, profit_amount, branch_id) VALUES (?, ?, ?, ?)",
            [shiftId, totalAmount, totalProfit, req.branchId]`
);

// returnSale: INSERT INTO retail_sales
code = code.replace(
    /"INSERT INTO retail_sales \(shift_id, total_amount, profit_amount\) VALUES \(\?, \?, \?\)",\s*\[shiftId, -refundTotal, -refundProfit\]/g,
    `"INSERT INTO retail_sales (shift_id, total_amount, profit_amount, branch_id) VALUES (?, ?, ?, ?)",
            [shiftId, -refundTotal, -refundProfit, req.branchId]`
);

// getShiftReport: get shift
code = code.replace(
    /"SELECT \* FROM retail_shifts WHERE id = \?",\s*\[shiftId\]/g,
    `"SELECT * FROM retail_shifts WHERE id = ? AND branch_id = ?", [shiftId, req.branchId]`
);

// getSaleInvoice:
code = code.replace(
    /"SELECT \* FROM retail_sales WHERE id = \?",\s*\[saleId\]/g,
    `"SELECT * FROM retail_sales WHERE id = ? AND branch_id = ?", [saleId, req.branchId]`
);

fs.writeFileSync('controllers/retailController.js', code);
console.log('Fixed retailController.js');
