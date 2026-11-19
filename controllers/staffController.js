const pool = require('../db');

function isUserAdmin(req) {
    const role = (req.user?.role || '').toUpperCase();
    return role === 'ADMIN' || role === 'SUPER ADMIN';
}

/**
 * GET /api/staff
 */
const getStaff = async (req, res, next) => {
    try {
        const isAdmin = isUserAdmin(req);
        const [rows] = await pool.execute(
            isAdmin
                ? 'SELECT id, name, role, phone, email, status, base_salary, branch_id FROM staff ORDER BY name ASC'
                : 'SELECT id, name, role, phone, email, status, base_salary, branch_id FROM staff WHERE branch_id = ? ORDER BY name ASC',
            isAdmin ? [] : [req.branchId]
        );
        res.json(rows);
    } catch (err) { next(err); }
};

/**
 * GET /api/staff/:id
 */
const getStaffById = async (req, res, next) => {
    try {
        const isAdmin = isUserAdmin(req);
        const [[member]] = await pool.execute(
            isAdmin
                ? 'SELECT id, name, role, phone, email, status, base_salary, branch_id FROM staff WHERE id = ?'
                : 'SELECT id, name, role, phone, email, status, base_salary, branch_id FROM staff WHERE id = ? AND branch_id = ?',
            isAdmin ? [req.params.id] : [req.params.id, req.branchId]
        );
        if (!member) return res.status(404).json({ error: 'Staff member not found' });
        res.json(member);
    } catch (err) { next(err); }
};

/**
 * POST /api/staff
 */
const createStaff = async (req, res, next) => {
    try {
        if (!isUserAdmin(req)) {
            return res.status(403).json({ error: 'Admin permission required to create staff' });
        }
        const { name, role, phone, email, status, base_salary, branch_id } = req.body;
        if (!name || !role) return res.status(400).json({ error: 'Name and role are required' });

        const targetBranchId = branch_id || req.branchId || 1;
        const [result] = await pool.execute(
            `INSERT INTO staff (name, role, phone, email, status, base_salary, branch_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [name, role, phone || null, email || null, status || 'active', base_salary || 0.00, targetBranchId]
        );
        res.status(201).json({ success: true, id: result.insertId });
    } catch (err) { next(err); }
};

/**
 * PUT /api/staff/:id
 */
const updateStaff = async (req, res, next) => {
    try {
        const isAdmin = isUserAdmin(req);
        if (!isAdmin) {
            const [[existing]] = await pool.execute('SELECT id FROM staff WHERE id = ? AND branch_id = ?', [req.params.id, req.branchId]);
            if (!existing) return res.status(404).json({ error: 'Staff member not found in your branch' });
        }

        const { name, role, phone, email, status, base_salary } = req.body;
        if (!name || !role) return res.status(400).json({ error: 'Name and role are required' });

        await pool.execute(
            `UPDATE staff SET name=?, role=?, phone=?, email=?, status=?, base_salary=? WHERE id=?`,
            [name, role, phone || null, email || null, status || 'active', base_salary || 0.00, req.params.id]
        );
        res.json({ success: true });
    } catch (err) { next(err); }
};

/**
 * DELETE /api/staff/:id
 */
const deleteStaff = async (req, res, next) => {
    try {
        const isAdmin = isUserAdmin(req);
        if (!isAdmin) {
            const [[existing]] = await pool.execute('SELECT id FROM staff WHERE id = ? AND branch_id = ?', [req.params.id, req.branchId]);
            if (!existing) return res.status(404).json({ error: 'Staff member not found in your branch' });
        }

        await pool.execute('DELETE FROM staff WHERE id=?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { next(err); }
};

/**
 * GET /api/staff/stats
 */
const getStaffStats = async (req, res, next) => {
    try {
        const isAdmin = isUserAdmin(req);
        const [[totals]] = await pool.execute(
            isAdmin
                ? `SELECT
                    COUNT(*)::int as total,
                    COUNT(*) FILTER (WHERE status = 'active')::int as active,
                    COUNT(*) FILTER (WHERE status = 'leave')::int as on_leave
                 FROM staff`
                : `SELECT
                    COUNT(*)::int as total,
                    COUNT(*) FILTER (WHERE status = 'active')::int as active,
                    COUNT(*) FILTER (WHERE status = 'leave')::int as on_leave
                 FROM staff WHERE branch_id = ?`,
            isAdmin ? [] : [req.branchId]
        );
        res.json(totals);
    } catch (err) { next(err); }
};

module.exports = {
    getStaff, getStaffById, createStaff, updateStaff, deleteStaff, getStaffStats
};
