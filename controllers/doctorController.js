const db = require('../db');

// GET all doctors
const getAllDoctors = async (req, res) => {
    try {
        const [doctors] = await db.query('SELECT * FROM doctors ORDER BY created_at DESC');
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
        const [doctors] = await db.query('SELECT * FROM doctors WHERE id = ?', [id]);

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
            `INSERT INTO doctors (name, specialty, phone, email, license_number, status, location, credit_limit) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, specialty, phone || null, email || null, license_number || null, status || 'active', location || null, credit_limit || 60000]
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
        const [existing] = await db.query('SELECT * FROM doctors WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'الطبيب غير موجود' });
        }

        await db.query(
            `UPDATE doctors 
             SET name = ?, specialty = ?, phone = ?, email = ?, 
                 license_number = ?, status = ?, location = ?, credit_limit = ?
             WHERE id = ?`,
            [name, specialty, phone, email, license_number, status, location, credit_limit || 60000, id]
        );

        // Fetch updated doctor
        const [updatedDoctor] = await db.query('SELECT * FROM doctors WHERE id = ?', [id]);

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
        const [existing] = await db.query('SELECT * FROM doctors WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'الطبيب غير موجود' });
        }

        await db.query('DELETE FROM doctors WHERE id = ?', [id]);

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
            WHERE o.client_id = ?
            ORDER BY o.created_at DESC
            LIMIT 10
        `;

        const [orders] = await db.query(query, [id]);
        res.json(orders);
    } catch (error) {
        console.error('Error fetching doctor orders:', error);
        res.status(500).json({ error: 'Failed to fetch doctor orders', message: error.message });
    }
};

module.exports = {
    getAllDoctors,
    getDoctorById,
    createDoctor,
    updateDoctor,
    deleteDoctor,
    getDoctorOrders
};
