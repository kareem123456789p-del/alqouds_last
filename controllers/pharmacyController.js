const pool = require('../db');

/**
 * GET /api/pharmacies
 * Returns a simple list of pharmacies (used for standard dropdown population)
 */
const getPharmacies = async (req, res, next) => {
    try {
        const role = req.user?.role ? req.user.role.toUpperCase() : '';
        const isAdmin = (role === 'ADMIN' || role === 'SUPER ADMIN');
        let branchId = req.branchId;
        if (isAdmin && req.query.branch_id) {
            const parsed = parseInt(req.query.branch_id);
            if (!isNaN(parsed) && parsed > 0) branchId = parsed;
        }
        if (!branchId && req.user) branchId = req.user.active_branch_id || req.user.assigned_branch_id || 1;

        const [rows] = await pool.execute(
            'SELECT id, name, license_number, contact_person, area, phone, status, credit_limit, total_debt FROM pharmacies WHERE branch_id = ? ORDER BY name ASC',
            [branchId]
        );
        res.json(rows);
    } catch (err) { next(err); }
};

/**
 * GET /api/pharmacies/:id
 */
const getPharmacyById = async (req, res, next) => {
    try {
        const [[pharmacy]] = await pool.execute(
            'SELECT id, name, license_number, contact_person, area, phone, status, credit_limit, total_debt FROM pharmacies WHERE id = ? AND branch_id = ?',
            [req.params.id, req.branchId]
        );
        if (!pharmacy) return res.status(404).json({ error: 'Pharmacy not found' });
        res.json(pharmacy);
    } catch (err) { next(err); }
};

/**
 * POST /api/pharmacies
 */
const createPharmacy = async (req, res, next) => {
    try {
        const { name, license_number, contact_person, area, phone, status, credit_limit } = req.body;
        if (!name || !area) return res.status(400).json({ error: 'Name and area are required' });

        const [result] = await pool.execute(
            `INSERT INTO pharmacies (name, license_number, contact_person, area, phone, status, credit_limit, total_debt, branch_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0.00, ?)`,
            [name, license_number || null, contact_person || null, area, phone || null, status || 'active', credit_limit || 20000.00, req.branchId]
        );
        res.status(201).json({ success: true, id: result.insertId });
    } catch (err) { next(err); }
};

/**
 * PUT /api/pharmacies/:id
 */
const updatePharmacy = async (req, res, next) => {
    try {
        const { name, license_number, contact_person, area, phone, status, credit_limit } = req.body;
        if (!name || !area) return res.status(400).json({ error: 'Name and area are required' });

        const [result] = await pool.execute(
            `UPDATE pharmacies SET name=?, license_number=?, contact_person=?, area=?, phone=?, status=?, credit_limit=? WHERE id=? AND branch_id=?`,
            [name, license_number || null, contact_person || null, area, phone || null, status || 'active', credit_limit || 20000, req.params.id, req.branchId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Pharmacy not found in caller branch.' });
        }
        res.json({ success: true });
    } catch (err) { next(err); }
};

/**
 * DELETE /api/pharmacies/:id
 */
const deletePharmacy = async (req, res, next) => {
    try {
        const [result] = await pool.execute('DELETE FROM pharmacies WHERE id=? AND branch_id=?', [req.params.id, req.branchId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Pharmacy not found in caller branch.' });
        }
        res.json({ success: true });
    } catch (err) { next(err); }
};

module.exports = {
    getPharmacies, getPharmacyById, createPharmacy, updatePharmacy, deletePharmacy
};
