const pool = require('../db');

/**
 * GET /api/staff
 */
const getStaff = async (req, res, next) => {
    try {
        const [rows] = await pool.execute(
            'SELECT id, name, role, phone, email, status, base_salary FROM staff ORDER BY name ASC'
        );
        res.json(rows);
    } catch (err) { next(err); }
};

/**
 * GET /api/staff/:id
 */
const getStaffById = async (req, res, next) => {
    try {
        const [[member]] = await pool.execute(
            'SELECT id, name, role, phone, email, status, base_salary FROM staff WHERE id = ?',
            [req.params.id]
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
        const { name, role, phone, email, status, base_salary } = req.body;
        if (!name || !role) return res.status(400).json({ error: 'Name and role are required' });

        const [result] = await pool.execute(
            `INSERT INTO staff (name, role, phone, email, status, base_salary) VALUES (?, ?, ?, ?, ?, ?)`,
            [name, role, phone || null, email || null, status || 'active', base_salary || 0.00]
        );
        res.status(201).json({ success: true, id: result.insertId });
    } catch (err) { next(err); }
};

/**
 * PUT /api/staff/:id
 */
const updateStaff = async (req, res, next) => {
    try {
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
        await pool.execute('DELETE FROM staff WHERE id=?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { next(err); }
};

/**
 * GET /api/staff/stats
 */
const getStaffStats = async (req, res, next) => {
    try {
        const [[totals]] = await pool.execute(
            `SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END) as on_leave
             FROM staff`
        );
        res.json(totals);
    } catch (err) { next(err); }
};

module.exports = {
    getStaff, getStaffById, createStaff, updateStaff, deleteStaff, getStaffStats
};
