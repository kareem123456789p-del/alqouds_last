const pool = require('../db');

/**
 * GET /api/pharmacies
 * Returns a simple list of pharmacies (used for standard dropdown population)
 */
const getPharmacies = async (req, res, next) => {
    try {
        const [rows] = await pool.execute(
            'SELECT id, name, license_number, contact_person, area, phone, status, credit_limit, total_debt FROM pharmacies ORDER BY name ASC'
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
            'SELECT id, name, license_number, contact_person, area, phone, status, credit_limit, total_debt FROM pharmacies WHERE id = ?',
            [req.params.id]
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
            `INSERT INTO pharmacies (name, license_number, contact_person, area, phone, status, credit_limit, total_debt)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0.00)`,
            [name, license_number || null, contact_person || null, area, phone || null, status || 'active', credit_limit || 20000.00]
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

        await pool.execute(
            `UPDATE pharmacies SET name=?, license_number=?, contact_person=?, area=?, phone=?, status=?, credit_limit=? WHERE id=?`,
            [name, license_number || null, contact_person || null, area, phone || null, status || 'active', credit_limit || 20000, req.params.id]
        );
        res.json({ success: true });
    } catch (err) { next(err); }
};

/**
 * DELETE /api/pharmacies/:id
 */
const deletePharmacy = async (req, res, next) => {
    try {
        await pool.execute('DELETE FROM pharmacies WHERE id=?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { next(err); }
};

module.exports = {
    getPharmacies, getPharmacyById, createPharmacy, updatePharmacy, deletePharmacy
};
