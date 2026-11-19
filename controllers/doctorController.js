const db = require('../db');

// GET all doctors
const getAllDoctors = async (req, res) => {
    try {
        const role = req.user?.role ? req.user.role.toUpperCase() : '';
        const isAdmin = (role === 'ADMIN' || role === 'SUPER ADMIN');
        let branchId = req.branchId;
        if (isAdmin && req.query.branch_id) {
            const parsed = parseInt(req.query.branch_id);
            if (!isNaN(parsed) && parsed > 0) branchId = parsed;
        }
        if (!branchId && req.user) branchId = req.user.active_branch_id || req.user.assigned_branch_id || 1;

        const [doctors] = await db.query('SELECT * FROM doctors WHERE branch_id = ? ORDER BY created_at DESC', [branchId]);
        res.json(doctors);
    } catch (error) {
        console.error('Error fetching doctors:', error);
        res.status(500).json({ error: 'فشل في جلب بيانات الأطباء', message: error.message });
    }
};

// GET doctor by ID
const getDoctorById = async (req, res) => {
    try {
        const { id } = req.params;
        const [doctors] = await db.query('SELECT * FROM doctors WHERE id = ? AND branch_id = ?', [id, req.branchId]);

        if (doctors.length === 0) {
            return res.status(404).json({ error: 'الطبيب غير موجود' });
        }

        res.json(doctors[0]);
    } catch (error) {
        console.error('Error fetching doctor:', error);
        res.status(500).json({ error: 'فشل في جلب بيانات الطبيب', message: error.message });
    }
};

// POST create new doctor
const createDoctor = async (req, res) => {
    try {
        const { name, specialty, phone, email, address, license_number, status, location, credit_limit } = req.body;

        // Validation
        if (!name || !specialty) {
            return res.status(400).json({ error: 'الاسم والتخصص مطلوبان' });
        }

        const [result] = await db.query(
            `INSERT INTO doctors (name, specialty, phone, email, license_number, status, location, credit_limit, branch_id) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, specialty, phone || null, email || null, license_number || null, status || 'active', location || null, credit_limit || 60000, req.branchId]
        );

        // Fetch the newly created doctor
        const [newDoctor] = await db.query('SELECT * FROM doctors WHERE id = ?', [result.insertId]);

        res.status(201).json({
            message: 'تم إضافة الطبيب بنجاح',
            doctor: newDoctor[0]
        });
    } catch (error) {
        console.error('Error creating doctor:', error);
        res.status(500).json({ error: 'فشل في إضافة الطبيب', message: error.message });
    }
};

// PUT update doctor
const updateDoctor = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, specialty, phone, email, address, license_number, status, location, credit_limit } = req.body;

        // Check if doctor exists
        const [existing] = await db.query('SELECT * FROM doctors WHERE id = ? AND branch_id = ?', [id, req.branchId]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'الطبيب غير موجود' });
        }

        await db.query(
            `UPDATE doctors 
             SET name = ?, specialty = ?, phone = ?, email = ?, 
                 license_number = ?, status = ?, location = ?, credit_limit = ?
             WHERE id = ? AND branch_id = ?`,
            [name, specialty, phone, email, license_number, status, location, credit_limit || 60000, id, req.branchId]
        );

        // Fetch updated doctor
        const [updatedDoctor] = await db.query('SELECT * FROM doctors WHERE id = ? AND branch_id = ?', [id, req.branchId]);

        res.json({
            message: 'تم تحديث بيانات الطبيب بنجاح',
            doctor: updatedDoctor[0]
        });
    } catch (error) {
        console.error('Error updating doctor:', error);
        res.status(500).json({ error: 'فشل في تحديث بيانات الطبيب', message: error.message });
    }
};

// DELETE doctor
const deleteDoctor = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if doctor exists
        const [existing] = await db.query('SELECT * FROM doctors WHERE id = ? AND branch_id = ?', [id, req.branchId]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'الطبيب غير موجود' });
        }

        await db.query('DELETE FROM doctors WHERE id = ? AND branch_id = ?', [id, req.branchId]);

        res.json({ message: 'تم حذف الطبيب بنجاح' });
    } catch (error) {
        console.error('Error deleting doctor:', error);
        res.status(500).json({ error: 'فشل في حذف الطبيب', message: error.message });
    }
};

// GET doctor's orders
const getDoctorOrders = async (req, res) => {
    try {
        const { id } = req.params;

        // Complex query to get order and its first distinct item summary for the profile view
        const query = `
            SELECT 
                o.id, 
                o.order_number, 
                o.status, 
                o.total_amount, 
                o.created_at,
                (SELECT p.name 
                 FROM order_items oi 
                 JOIN products p ON oi.product_id = p.id 
                 WHERE oi.order_id = o.id 
                 LIMIT 1) as main_item_name,
                (SELECT COUNT(*) 
                 FROM order_items oi 
                 WHERE oi.order_id = o.id) as total_items
            FROM orders o
            WHERE o.client_id = ? AND o.branch_id = ?
            ORDER BY o.created_at DESC
            LIMIT 10
        `;

        const [orders] = await db.query(query, [id, req.branchId]);
        res.json(orders);
    } catch (error) {
        console.error('Error fetching doctor orders:', error);
        res.status(500).json({ error: 'Failed to fetch doctor orders', message: error.message });
    }
};

// GET /api/doctors/:id/transactions — full profile with order history for modal
const getDoctorTransactions = async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch doctor info
        const [doctors] = await db.query(
            'SELECT id, name, specialty, phone, email, location, COALESCE(credit_limit, 60000) as credit_limit, COALESCE(total_debt, 0) as total_debt FROM doctors WHERE id = ? AND branch_id = ?',
            [id, req.branchId]
        );
        if (doctors.length === 0) {
            return res.status(404).json({ error: 'Doctor not found' });
        }
        const doctor = doctors[0];

        // Fetch all orders for this doctor
        const [orders] = await db.query(`
            SELECT
                o.id,
                o.order_number,
                o.created_at,
                o.total_amount,
                o.status,
                (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
                (SELECT p.name FROM order_items oi2
                 JOIN products p ON oi2.product_id = p.id
                 WHERE oi2.order_id = o.id
                 ORDER BY oi2.id ASC LIMIT 1) AS main_item_name
            FROM orders o
            WHERE o.client_id = ?
            ORDER BY o.created_at DESC
        `, [id]);

        // Total outstanding balance (non-cancelled orders)
        const totalBalance = orders
            .filter(o => o.status !== 'Cancelled')
            .reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);

        // Group by month/year
        const monthMap = new Map();
        for (const order of orders) {
            const date = new Date(order.created_at);
            const monthYear = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
            if (!monthMap.has(monthYear)) {
                monthMap.set(monthYear, { monthLabel: monthYear, shipments: [] });
            }
            monthMap.get(monthYear).shipments.push({
                id: order.id,
                order_number: order.order_number,
                created_at: order.created_at,
                shipment_total: parseFloat(order.total_amount || 0),
                status: order.status,
                item_count: order.item_count,
                main_item_name: order.main_item_name,
                items: [{ product_name: order.main_item_name || 'N/A', quantity: order.item_count }]
            });
        }

        res.json({
            doctor,
            total_transactions_count: orders.length,
            total_outstanding_balance: totalBalance,
            monthGroups: Array.from(monthMap.values())
        });
    } catch (error) {
        console.error('Error fetching doctor transactions:', error);
        res.status(500).json({ error: 'Failed to fetch doctor transactions', message: error.message });
    }
};

module.exports = {
    getAllDoctors,
    getDoctorById,
    createDoctor,
    updateDoctor,
    deleteDoctor,
    getDoctorOrders,
    getDoctorTransactions
};
