const pool = require('../db');

/**
 * Helper to safely resolve branch_id for the collections module.
 * Prioritizes admin request query / body params, then req.branchId (from branchScope),
 * session active/assigned branch, and defaults to 1.
 */
function resolveBranchId(req) {
    const role = req.user?.role ? req.user.role.toUpperCase() : '';
    const isAdmin = (role === 'ADMIN' || role === 'SUPER ADMIN');

    if (isAdmin) {
        if (req.query?.branch_id) {
            const parsed = parseInt(req.query.branch_id);
            if (!isNaN(parsed) && parsed > 0) return parsed;
        }
        if (req.body?.branch_id) {
            const parsed = parseInt(req.body.branch_id);
            if (!isNaN(parsed) && parsed > 0) return parsed;
        }
        if (req.headers && req.headers['x-branch-id']) {
            const parsed = parseInt(req.headers['x-branch-id']);
            if (!isNaN(parsed) && parsed > 0) return parsed;
        }
    }
    return req.branchId || req.user?.active_branch_id || req.user?.assigned_branch_id || 1;
}

// POST /api/collections
const recordPayment = async (req, res, next) => {
    let connection;
    try {
        const { client_id: rawClientId, amount, payment_method, reference_no, notes } = req.body;
        const branchId = resolveBranchId(req);

        // 1. Validation
        if (!rawClientId || typeof rawClientId !== 'string') {
            return res.status(400).json({ error: 'Client selection is required and must be valid.' });
        }

        const paymentAmount = parseFloat(amount);
        if (isNaN(paymentAmount) || paymentAmount <= 0) {
            return res.status(400).json({ error: 'Payment amount must be a number greater than zero.' });
        }

        // 2. Database Connection & Transaction
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [type, actualId] = rawClientId.split(/[-_]/);
        const typeClean = type ? type.trim() : '';
        const id = actualId ? actualId.trim() : null;

        if (!id) throw new Error('Invalid client ID format.');

        let isDoctor = typeClean === 'doc';
        let dbClientId = isDoctor ? id : null;
        let dbPharmacyId = !isDoctor ? id : null;

        let currentDebt = 0;

        // 3. Find client strictly within the active branch and update debt
        if (isDoctor) {
            const [[doc]] = await connection.execute(
                'SELECT id, COALESCE(total_debt, 0) as total_debt FROM doctors WHERE id = ? AND branch_id = ?',
                [id, branchId]
            );
            if (!doc) throw new Error('Doctor not found in the active branch.');
            currentDebt = parseFloat(doc.total_debt);

            await connection.execute(
                'UPDATE doctors SET total_debt = total_debt - ? WHERE id = ? AND branch_id = ?',
                [paymentAmount, id, branchId]
            );
        } else {
            const [[pharm]] = await connection.execute(
                'SELECT id, COALESCE(total_debt, 0) as total_debt FROM pharmacies WHERE id = ? AND branch_id = ?',
                [id, branchId]
            );
            if (!pharm) throw new Error('Pharmacy not found in the active branch.');
            currentDebt = parseFloat(pharm.total_debt);

            await connection.execute(
                'UPDATE pharmacies SET total_debt = total_debt - ? WHERE id = ? AND branch_id = ?',
                [paymentAmount, id, branchId]
            );
        }

        // 4. Insert into payments with branch_id
        const [paymentRes] = await connection.execute(
            `INSERT INTO payments (client_id, pharmacy_id, amount, payment_method, reference_no, notes, branch_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [dbClientId, dbPharmacyId, paymentAmount, payment_method || 'Cash', reference_no || null, notes || null, branchId]
        );
        const paymentId = paymentRes.insertId;

        // 5. Insert into client_transactions for unified history tracking with branch_id
        if (isDoctor) {
            await connection.execute(
                `INSERT INTO client_transactions (client_id, type, amount, reference_id, branch_id) VALUES (?, 'PAYMENT', ?, ?, ?)`,
                [dbClientId, -paymentAmount, paymentId, branchId]
            );
        } else {
            await connection.execute(
                `INSERT INTO client_transactions (pharmacy_id, type, amount, reference_id, branch_id) VALUES (?, 'PAYMENT', ?, ?, ?)`,
                [dbPharmacyId, -paymentAmount, paymentId, branchId]
            );
        }

        await connection.commit();
        res.status(201).json({
            success: true,
            message: 'Payment recorded successfully',
            branch_id: branchId,
            new_balance: currentDebt - paymentAmount
        });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Save Payment Error:', err);
        const statusCode = err.statusCode || (err.message.includes('not found') ? 404 : 400);
        res.status(statusCode).json({ error: err.message || 'Internal Server Error' });
    } finally {
        if (connection) connection.release();
    }
};

// GET /api/collections or GET /api/collections/transactions
const getRecentPayments = async (req, res, next) => {
    try {
        const branchId = resolveBranchId(req);
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const offset = Math.max(parseInt(req.query.offset) || 0, 0);

        const [[{ total }]] = await pool.execute(
            `SELECT COUNT(*) AS total FROM payments WHERE branch_id = ?`,
            [branchId]
        );

        const [payments] = await pool.execute(`
            SELECT 
                p.id, p.amount, p.payment_method, p.reference_no, p.notes, p.created_at, p.branch_id,
                COALESCE(d.name, ph.name) as client_name,
                CASE WHEN p.client_id IS NOT NULL THEN p.client_id ELSE p.pharmacy_id END as client_id,
                CASE WHEN p.client_id IS NOT NULL THEN 'doc' ELSE 'pharm' END as client_type
            FROM payments p
            LEFT JOIN doctors d ON p.client_id = d.id
            LEFT JOIN pharmacies ph ON p.pharmacy_id = ph.id
            WHERE p.branch_id = ?
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        `, [branchId, limit, offset]);

        res.json({ branch_id: branchId, payments, total, limit, offset });
    } catch (err) { next(err); }
};

// GET /api/collections/client/:id/monthly
const getClientMonthly = async (req, res, next) => {
    try {
        const branchId = resolveBranchId(req);
        const rawId = req.params.id;
        const [type, actualId] = rawId.split(/[-_]/);
        const typeClean = type ? type.trim() : '';
        const id = actualId ? actualId.trim() : null;

        if (!id) return res.status(400).json({ error: 'Invalid client ID format' });

        let query = '';
        if (typeClean === 'doc') {
            query = `SELECT SUM(amount) as monthly_sum 
                     FROM payments 
                     WHERE client_id = ? AND branch_id = ? 
                       AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE) 
                       AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)`;
        } else if (typeClean === 'pharm') {
            query = `SELECT SUM(amount) as monthly_sum 
                     FROM payments 
                     WHERE pharmacy_id = ? AND branch_id = ? 
                       AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE) 
                       AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)`;
        } else {
            return res.status(400).json({ error: 'Invalid client prefix' });
        }

        const [[{ monthly_sum }]] = await pool.execute(query, [id, branchId]);
        
        res.json({ branch_id: branchId, monthly_sum: parseFloat(monthly_sum) || 0 });
    } catch (err) { next(err); }
};

// GET /api/collections/summary
const getSummary = async (req, res, next) => {
    try {
        const branchId = resolveBranchId(req);

        // Monthly Collections strictly for active branch
        const [[{ monthly_total }]] = await pool.execute(`
            SELECT SUM(amount) as monthly_total 
            FROM payments 
            WHERE branch_id = ?
              AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE) 
              AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
        `, [branchId]);

        // Total Market Debt for active branch (Sum of all > 0 total_debt from docs + pharms)
        const [[{ doc_debt }]] = await pool.execute(
            `SELECT SUM(total_debt) as doc_debt FROM doctors WHERE total_debt > 0 AND branch_id = ?`,
            [branchId]
        );
        const [[{ pharm_debt }]] = await pool.execute(
            `SELECT SUM(total_debt) as pharm_debt FROM pharmacies WHERE total_debt > 0 AND branch_id = ?`,
            [branchId]
        );

        const totalMarketDebt = (parseFloat(doc_debt) || 0) + (parseFloat(pharm_debt) || 0);

        res.json({
            branch_id: branchId,
            monthly_collections: parseFloat(monthly_total) || 0,
            total_market_debt: totalMarketDebt
        });
    } catch (err) { next(err); }
};

// GET /api/collections/debts or GET /api/customers/debt
const getCustomerDebts = async (req, res, next) => {
    try {
        const branchId = resolveBranchId(req);
        const [docs] = await pool.execute(
            `SELECT id, name, specialty, phone, total_debt, credit_limit, branch_id, 'doc' as type 
             FROM doctors 
             WHERE branch_id = ? AND total_debt > 0 
             ORDER BY total_debt DESC`,
            [branchId]
        );
        const [pharms] = await pool.execute(
            `SELECT id, name, contact_person, phone, total_debt, credit_limit, branch_id, 'pharm' as type 
             FROM pharmacies 
             WHERE branch_id = ? AND total_debt > 0 
             ORDER BY total_debt DESC`,
            [branchId]
        );

        res.json({
            branch_id: branchId,
            debts: [...docs, ...pharms]
        });
    } catch (err) { next(err); }
};

module.exports = {
    recordPayment,
    getRecentPayments,
    getSummary,
    getClientMonthly,
    getCustomerDebts,
    resolveBranchId
};
