const pool = require('../db');

/**
 * GET /api/withdrawals/stats
 * Returns aggregate stats: monthly total, top employee, alerts list.
 */
const getStats = async (req, res, next) => {
    try {
        // 1. Total withdrawals this month
        const [[{ monthly_total }]] = await pool.execute(`
            SELECT COALESCE(SUM(amount), 0) AS monthly_total
            FROM employee_withdrawals
            WHERE MONTH(created_at) = MONTH(CURDATE())
              AND YEAR(created_at)  = YEAR(CURDATE())
        `);

        // 2. Employee with most withdrawals (by total amount this month)
        const [topRows] = await pool.execute(`
            SELECT s.id, s.name,
                   COUNT(ew.id) AS tx_count,
                   SUM(ew.amount) AS total_amount
            FROM employee_withdrawals ew
            JOIN staff s ON s.id = ew.staff_id
            WHERE MONTH(ew.created_at) = MONTH(CURDATE())
              AND YEAR(ew.created_at)  = YEAR(CURDATE())
            GROUP BY s.id, s.name
            ORDER BY total_amount DESC
            LIMIT 1
        `);

        // 3. Employees whose TOTAL monthly withdrawals exceed 50% of base_salary
        const [alertRows] = await pool.execute(`
            SELECT s.id, s.name, s.base_salary,
                   SUM(ew.amount) AS monthly_total
            FROM employee_withdrawals ew
            JOIN staff s ON s.id = ew.staff_id
            WHERE MONTH(ew.created_at) = MONTH(CURDATE())
              AND YEAR(ew.created_at)  = YEAR(CURDATE())
            GROUP BY s.id, s.name, s.base_salary
            HAVING SUM(ew.amount) > (COALESCE(s.base_salary, 0) * 0.5)
        `);

        res.json({
            monthly_total: parseFloat(monthly_total),
            top_employee: topRows.length ? topRows[0] : null,
            alerts: alertRows
        });
    } catch (err) { next(err); }
};

const getWithdrawals = async (req, res, next) => {
    try {
        const [rows] = await pool.execute(`
            SELECT
                ew.id,
                ew.amount,
                ew.reason,
                ew.category,
                ew.created_at,
                s.id   AS staff_id,
                s.name AS staff_name,
                s.base_salary
            FROM employee_withdrawals ew
            JOIN staff s ON s.id = ew.staff_id
            ORDER BY ew.created_at DESC
            LIMIT 50
        `);

        /* Compute monthly running totals in JS (per employee, within same month) */
        const monthlySums = {};
        const sorted = [...rows].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        sorted.forEach(r => {
            const key = `${r.staff_id}-${new Date(r.created_at).getFullYear()}-${new Date(r.created_at).getMonth()}`;
            monthlySums[key] = (monthlySums[key] || 0) + parseFloat(r.amount);
            r._running = monthlySums[key];
        });

        const tagged = rows.map(r => ({
            ...r,
            running_total: r._running,
            is_high_ratio: parseFloat(r._running || r.amount) > parseFloat(r.base_salary || 0) * 0.5
        }));

        res.json(tagged);
    } catch (err) { next(err); }
};


/**
 * POST /api/withdrawals
 * Creates a new withdrawal record after validating against salary.
 */
const createWithdrawal = async (req, res, next) => {
    try {
        const { staff_id, amount, reason, category } = req.body;

        if (!staff_id || !amount || !reason) {
            return res.status(400).json({ error: 'staff_id, amount, and reason are required.' });
        }

        // Fetch staff base salary
        const [[staff]] = await pool.execute(
            'SELECT id, name, base_salary FROM staff WHERE id = ?',
            [staff_id]
        );
        if (!staff) return res.status(404).json({ error: 'Staff member not found.' });

        const [[{ monthly_sum }]] = await pool.execute(`
            SELECT COALESCE(SUM(amount), 0) AS monthly_sum
            FROM employee_withdrawals
            WHERE staff_id = ?
              AND MONTH(created_at) = MONTH(CURDATE())
              AND YEAR(created_at)  = YEAR(CURDATE())
        `, [staff_id]);

        const newTotal = parseFloat(monthly_sum) + parseFloat(amount);
        const is_high_ratio = newTotal > parseFloat(staff.base_salary || 0) * 0.5;

        const [result] = await pool.execute(
            'INSERT INTO employee_withdrawals (staff_id, amount, reason, category) VALUES (?, ?, ?, ?)',
            [staff_id, amount, reason, category || 'Personal']
        );

        res.status(201).json({
            success: true,
            id: result.insertId,
            is_high_ratio,
            new_monthly_total: newTotal,
            staff_name: staff.name,
            base_salary: staff.base_salary
        });
    } catch (err) { next(err); }
};

module.exports = { getStats, getWithdrawals, createWithdrawal };
