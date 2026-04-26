const pool = require('../db');

// POST /api/collections
const recordPayment = async (req, res, next) => {
    let connection;
    try {
        const { client_id: rawClientId, amount, payment_method, reference_no, notes } = req.body;

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

        // 3. Decouple to find client and update debt
        if (isDoctor) {
            const [[doc]] = await connection.execute('SELECT id, IFNULL(total_debt, 0) as total_debt FROM doctors WHERE id = ?', [id]);
            if (!doc) throw new Error('Doctor not found.');
            currentDebt = parseFloat(doc.total_debt);

            await connection.execute('UPDATE doctors SET total_debt = total_debt - ? WHERE id = ?', [paymentAmount, id]);
        } else {
            const [[pharm]] = await connection.execute('SELECT id, IFNULL(total_debt, 0) as total_debt FROM pharmacies WHERE id = ?', [id]);
            if (!pharm) throw new Error('Pharmacy not found.');
            currentDebt = parseFloat(pharm.total_debt);

            await connection.execute('UPDATE pharmacies SET total_debt = total_debt - ? WHERE id = ?', [paymentAmount, id]);
        }

        // 4. Insert into payments
        const [paymentRes] = await connection.execute(
            `INSERT INTO payments (client_id, pharmacy_id, amount, payment_method, reference_no, notes) VALUES (?, ?, ?, ?, ?, ?)`,
            [dbClientId, dbPharmacyId, paymentAmount, payment_method || 'Cash', reference_no || null, notes || null]
        );
        const paymentId = paymentRes.insertId;

        // 5. Insert into client_transactions for unified history tracking
        if (isDoctor) {
            await connection.execute(
                `INSERT INTO client_transactions (client_id, type, amount, reference_id) VALUES (?, 'PAYMENT', ?, ?)`,
                [dbClientId, -paymentAmount, paymentId]
            );
        } else {
            await connection.execute(
                `INSERT INTO client_transactions (pharmacy_id, type, amount, reference_id) VALUES (?, 'PAYMENT', ?, ?)`,
                [dbPharmacyId, -paymentAmount, paymentId]
            );
        }

        await connection.commit();
        res.status(201).json({ success: true, message: 'Payment recorded successfully', new_balance: currentDebt - paymentAmount });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Save Payment Error:', err);
        // Ensure returning status 500 JSON so frontend doesn't crash on HTML
        res.status(500).json({ error: err.message || 'Internal Server Error' });
    } finally {
        if (connection) connection.release();
    }
};

// GET /api/collections
const getRecentPayments = async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const offset = Math.max(parseInt(req.query.offset) || 0, 0);

        const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM payments`);

        const [payments] = await pool.execute(`
            SELECT 
                p.id, p.amount, p.payment_method, p.reference_no, p.notes, p.created_at,
                COALESCE(d.name, ph.name) as client_name,
                IF(p.client_id IS NOT NULL, p.client_id, p.pharmacy_id) as client_id,
                IF(p.client_id IS NOT NULL, 'doc', 'pharm') as client_type
            FROM payments p
            LEFT JOIN doctors d ON p.client_id = d.id
            LEFT JOIN pharmacies ph ON p.pharmacy_id = ph.id
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        `, [limit, offset]);

        res.json({ payments, total, limit, offset });
    } catch (err) { next(err); }
};

// GET /api/collections/client/:id/monthly
const getClientMonthly = async (req, res, next) => {
    try {
        const rawId = req.params.id;
        const [type, actualId] = rawId.split(/[-_]/);
        const typeClean = type ? type.trim() : '';
        const id = actualId ? actualId.trim() : null;

        if (!id) return res.status(400).json({ error: 'Invalid client ID format' });

        let query = '';
        if (typeClean === 'doc') {
            query = `SELECT SUM(amount) as monthly_sum FROM payments WHERE client_id = ? AND MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())`;
        } else if (typeClean === 'pharm') {
            query = `SELECT SUM(amount) as monthly_sum FROM payments WHERE pharmacy_id = ? AND MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())`;
        } else {
            return res.status(400).json({ error: 'Invalid client prefix' });
        }

        const [[{ monthly_sum }]] = await pool.execute(query, [id]);
        
        res.json({ monthly_sum: parseFloat(monthly_sum) || 0 });
    } catch (err) { next(err); }
};

// GET /api/collections/summary
const getSummary = async (req, res, next) => {
    try {
        // Monthly Collections
        const [[{ monthly_total }]] = await pool.execute(`
            SELECT SUM(amount) as monthly_total 
            FROM payments 
            WHERE MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())
        `);

        // Total Market Debt (Sum of all > 0 total_debt from docs + pharms)
        const [[{ doc_debt }]] = await pool.execute(`SELECT SUM(total_debt) as doc_debt FROM doctors WHERE total_debt > 0`);
        const [[{ pharm_debt }]] = await pool.execute(`SELECT SUM(total_debt) as pharm_debt FROM pharmacies WHERE total_debt > 0`);

        const totalMarketDebt = (parseFloat(doc_debt) || 0) + (parseFloat(pharm_debt) || 0);

        res.json({
            monthly_collections: parseFloat(monthly_total) || 0,
            total_market_debt: totalMarketDebt
        });
    } catch (err) { next(err); }
};

module.exports = { recordPayment, getRecentPayments, getSummary, getClientMonthly };
