const fs = require('fs');
let code = fs.readFileSync('controllers/withdrawalController.js', 'utf8');

// getStats: 
code = code.replace(
    /FROM employee_withdrawals\s*WHERE EXTRACT/g,
    `FROM employee_withdrawals
            WHERE branch_id = \${req.branchId} AND EXTRACT`
);
code = code.replace(
    /FROM employee_withdrawals ew\s*JOIN staff s ON s\.id = ew\.staff_id\s*WHERE EXTRACT/g,
    `FROM employee_withdrawals ew
            JOIN staff s ON s.id = ew.staff_id
            WHERE ew.branch_id = \${req.branchId} AND EXTRACT`
);
// getWithdrawals:
code = code.replace(
    /FROM employee_withdrawals ew\s*JOIN staff s ON s\.id = ew\.staff_id\s*ORDER BY ew\.created_at DESC/g,
    `FROM employee_withdrawals ew
            JOIN staff s ON s.id = ew.staff_id
            WHERE ew.branch_id = \${req.branchId}
            ORDER BY ew.created_at DESC`
);

// createWithdrawal
code = code.replace(
    /WHERE staff_id = \?\s*AND EXTRACT\(MONTH/g,
    `WHERE staff_id = ? AND branch_id = ?
              AND EXTRACT(MONTH`
);
code = code.replace(
    /\s*\[staff_id\]/g,
    ` [staff_id, req.branchId]`
);
code = code.replace(
    /INSERT INTO employee_withdrawals \(staff_id, amount, reason, category\) VALUES \(\?, \?, \?, \?\)/g,
    `INSERT INTO employee_withdrawals (staff_id, amount, reason, category, branch_id) VALUES (?, ?, ?, ?, ?)`
);
code = code.replace(
    /\[staff_id, amount, reason, category \|\| 'Personal'\]/g,
    `[staff_id, amount, reason, category || 'Personal', req.branchId]`
);

fs.writeFileSync('controllers/withdrawalController.js', code);
console.log('Fixed withdrawalController.js');
