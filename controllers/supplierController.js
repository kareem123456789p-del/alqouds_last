const pool = require('../db');

// Generate next supplier code like LOC-XXXX
async function nextCode() {
    const [[{ maxCode }]] = await pool.execute(
        `SELECT MAX(CAST(SUBSTRING(supplier_code FROM 5) AS INTEGER)) AS maxCode
         FROM local_suppliers`
    );
    const next = (maxCode || 200) + 1;
    return 'LOC-' + String(next).padStart(4, '0');
}

/**
 * GET /api/suppliers?search=&city=
 */
const getAll = async (req, res, next) => {
    try {
        const { search = '', city = '', include_archived = 'false' } = req.query;
        let sql = `SELECT * FROM local_suppliers WHERE branch_id = ?`;
        const params = [req.branchId];

        if (include_archived !== 'true') {
            sql += ` AND (is_active = TRUE OR is_active IS NULL)`;
        }

        if (search) {
            sql += ` AND (company_name LIKE ? OR contact_person LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }
        if (city) {
            sql += ` AND city_area LIKE ?`;
            params.push(`%${city}%`);
        }

        sql += ` ORDER BY id DESC`;
        const [rows] = await pool.execute(sql, params);
        res.json(rows);
    } catch (err) { next(err); }
};

/**
 * GET /api/suppliers/:id
 */
const getOne = async (req, res, next) => {
    try {
        const [[row]] = await pool.execute(
            'SELECT * FROM local_suppliers WHERE id = ? AND branch_id = ?', [req.params.id, req.branchId]
        );
        if (!row) return res.status(404).json({ error: 'Supplier not found' });
        res.json(row);
    } catch (err) { next(err); }
};

/**
 * POST /api/suppliers
 * Body: { company_name, contact_person, phone, city_area, notes }
 */
const create = async (req, res, next) => {
    const { company_name, contact_person, phone, city_area, notes } = req.body;
    if (!company_name || !contact_person || !phone || !city_area) {
        return res.status(400).json({ error: 'company_name, contact_person, phone, and city_area are required.' });
    }
    try {
        const code = await nextCode();
        const [result] = await pool.execute(
            `INSERT INTO local_suppliers (supplier_code, company_name, contact_person, phone, city_area, notes, branch_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [code, company_name.trim(), contact_person.trim(), phone.trim(), city_area.trim(), notes?.trim() || null, req.branchId]
        );
        const [[newRow]] = await pool.execute('SELECT * FROM local_suppliers WHERE id = ?', [result.insertId]);
        res.status(201).json(newRow);
    } catch (err) { next(err); }
};

/**
 * PUT /api/suppliers/:id
 */
const update = async (req, res, next) => {
    const { company_name, contact_person, phone, city_area, notes } = req.body;
    if (!company_name || !contact_person || !phone || !city_area) {
        return res.status(400).json({ error: 'All fields required.' });
    }
    try {
        await pool.execute(
            `UPDATE local_suppliers
             SET company_name=?, contact_person=?, phone=?, city_area=?, notes=?
             WHERE id=? AND branch_id=?`,
            [company_name.trim(), contact_person.trim(), phone.trim(), city_area.trim(), notes?.trim() || null, req.params.id, req.branchId]
        );
        res.json({ success: true });
    } catch (err) { next(err); }
};

/**
 * DELETE /api/suppliers/:id
 */
const remove = async (req, res, next) => {
    try {
        const [txRows] = await pool.execute(
            'SELECT COUNT(*) as cnt FROM supplier_transactions WHERE supplier_id = ?',
            [req.params.id]
        );
        const cnt = txRows[0]?.cnt ?? txRows[0]?.count ?? 0;
        if (Number(cnt) > 0) {
            // Decision 7B: Soft-delete archiving when supplier has transaction history
            const [archiveResult] = await pool.execute(
                'UPDATE local_suppliers SET is_active = FALSE WHERE id = ? AND branch_id = ?',
                [req.params.id, req.branchId]
            );
            if (archiveResult.affectedRows === 0) {
                return res.status(404).json({ error: 'Supplier not found' });
            }
            return res.json({ success: true, message: 'Supplier archived successfully', archived: true });
        }

        const [result] = await pool.execute('DELETE FROM local_suppliers WHERE id = ? AND branch_id = ?', [req.params.id, req.branchId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Supplier not found' });
        }
        res.json({ success: true });
    } catch (err) { next(err); }
};

/**
 * GET /api/suppliers/:id/history
 * Returns shipments grouped by month/year.
 * Each shipment has detailed items.
 */
const getHistory = async (req, res, next) => {
    try {
        const supplierId = req.params.id;

        // Fetch detailed rows for this supplier's import charges
        const [rows] = await pool.execute(`
            SELECT
                st.id AS st_id,
                COALESCE(il.shipment_id, CONCAT('TX-', st.id)) AS shipment_group,
                st.created_at,
                st.total_amount,
                il.invoice_image,
                il.quantity,
                il.unit_price,
                COALESCE(p.name, 'General Transaction') AS product_name
            FROM supplier_transactions st
            LEFT JOIN import_logs il ON st.import_log_id = il.id
            LEFT JOIN products p ON il.product_id = p.id
            JOIN local_suppliers ls ON st.supplier_id = ls.id
            WHERE st.supplier_id = ?
              AND st.transaction_type = 'IMPORT_CHARGE'
              AND ls.branch_id = ?
              AND st.branch_id = ?
            ORDER BY st.created_at DESC
        `, [supplierId, req.branchId, req.branchId]);

        // Group rows by shipment_group
        const shipmentMap = new Map();
        for (const row of rows) {
            const sg = row.shipment_group;
            if (!shipmentMap.has(sg)) {
                shipmentMap.set(sg, {
                    shipment_group: sg,
                    created_at: row.created_at, // Use first seen (max date due to ORDER BY DESC)
                    shipment_total: 0,
                    invoice_image: row.invoice_image,
                    items: [],
                    seen_st_ids: new Set()
                });
            }
            const shipment = shipmentMap.get(sg);
            
            // Add to total_amount (accumulate since total_amount is per item transaction)
            if (!shipment.seen_st_ids.has(row.st_id)) {
                shipment.shipment_total += Number(row.total_amount);
                shipment.seen_st_ids.add(row.st_id);
            }

            // Add the item
            shipment.items.push({
                product_name: row.product_name,
                quantity: row.quantity || 1,
                unit_price: Number(row.unit_price) || Number(row.total_amount)
            });
        }

        const shipments = Array.from(shipmentMap.values());
        // Sort shipments by created_at DESC (they mostly are, but to be sure)
        shipments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // Group shipments by Month Year
        const monthMap = new Map();
        for (const shipment of shipments) {
            const date = new Date(shipment.created_at);
            const monthYear = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); // e.g. "April 2026"
            
            if (!monthMap.has(monthYear)) {
                monthMap.set(monthYear, {
                    monthLabel: monthYear,
                    shipments: []
                });
            }
            monthMap.get(monthYear).shipments.push(shipment);
        }

        const monthGroups = Array.from(monthMap.values());

        // ── Overall totals (all transaction types for balance) ────────────────
        const [[rowBal]] = await pool.execute(`
            SELECT COALESCE(SUM(st.total_amount), 0) AS total_balance
            FROM supplier_transactions st
            JOIN local_suppliers ls ON st.supplier_id = ls.id
            WHERE st.supplier_id = ? AND ls.branch_id = ? AND st.branch_id = ?
        `, [supplierId, req.branchId, req.branchId]);

        const totalBalance = rowBal?.total_balance ?? rowBal?.totalBalance ?? 0;

        res.json({
            total_transactions_count: shipments.length,
            total_outstanding_balance: parseFloat(totalBalance),
            monthGroups
        });
    } catch (err) { next(err); }
};


module.exports = { getAll, getOne, create, update, remove, getHistory };
