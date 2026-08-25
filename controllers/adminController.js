const db = require('../db');
const bcrypt = require('bcrypt');

exports.getBranches = async (req, res) => {
    try {
        const [branches] = await db.query('SELECT * FROM branches ORDER BY id ASC');
        res.json(branches);
    } catch (error) {
        console.error('getBranches error:', error);
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
};

exports.getPermissions = async (req, res) => {
    try {
        const [permissions] = await db.query('SELECT * FROM permissions ORDER BY category, id ASC');
        res.json({ success: true, permissions });
    } catch (error) {
        console.error('getPermissions error:', error);
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
};

exports.getStaffList = async (req, res) => {
    try {
        // Fetch staff with branch name
        const [staffRows] = await db.query(`
            SELECT s.id, s.name, s.registration_number, s.role, s.status, s.branch_id, b.name as branch_name 
            FROM staff s
            LEFT JOIN branches b ON s.branch_id = b.id
            ORDER BY s.id DESC
        `);
        
        // Fetch permissions for all staff
        const [permsRows] = await db.query('SELECT staff_id, permission_key FROM staff_permissions');
        
        // Group permissions by staff_id
        const permsMap = {};
        for (const p of permsRows) {
            if (!permsMap[p.staff_id]) permsMap[p.staff_id] = [];
            permsMap[p.staff_id].push(p.permission_key);
        }

        // Combine
        const staff = staffRows.map(s => ({
            ...s,
            permissions: permsMap[s.id] || []
        }));

        res.json({ success: true, staff });
    } catch (error) {
        console.error('getStaffList error:', error);
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
};

exports.createStaff = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const { name, registration_number, password, role, branch_id, permissions } = req.body;
        
        if (!name || !registration_number || !password || !role) {
            return res.status(400).json({ success: false, error: 'Missing required fields.' });
        }

        const allowedRoles = ['ADMIN', 'BRANCH_MANAGER', 'DEPUTY_MANAGER', 'ASSISTANT_MANAGER', 'ASSISTANT_DEPUTY_ASSISTANT_MANAGER', 'WAREHOUSE_MANAGER'];
        if (!allowedRoles.includes(role)) {
            return res.status(400).json({ success: false, error: 'Invalid job role provided.' });
        }

        await conn.beginTransaction();

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const [insertResult] = await conn.execute(`
            INSERT INTO staff (name, registration_number, password_hash, role, branch_id)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `, [name, registration_number, password_hash, role, branch_id || 1]);
        
        const newStaffId = insertResult.insertId || insertResult[0]?.id; // depends on db wrapper

        if (permissions && Array.isArray(permissions) && permissions.length > 0) {
            for (const p of permissions) {
                await conn.execute(`INSERT INTO staff_permissions (staff_id, permission_key) VALUES ($1, $2)`, [newStaffId, p]);
            }
        }

        await conn.commit();
        res.json({ success: true, message: 'Staff created successfully.', id: newStaffId });
    } catch (error) {
        await conn.rollback();
        console.error('createStaff error:', error);
        if (error.code === '23505') { // Postgres unique violation
             return res.status(400).json({ success: false, error: 'Registration number already exists.' });
        }
        res.status(500).json({ success: false, error: 'Internal server error.' });
    } finally {
        conn.release();
    }
};

exports.updateStaff = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const staffId = req.params.id;
        const { name, registration_number, password, role, branch_id, status, permissions } = req.body;
        
        const allowedRoles = ['ADMIN', 'BRANCH_MANAGER', 'DEPUTY_MANAGER', 'ASSISTANT_MANAGER', 'ASSISTANT_DEPUTY_ASSISTANT_MANAGER', 'WAREHOUSE_MANAGER'];
        if (role && !allowedRoles.includes(role)) {
            return res.status(400).json({ success: false, error: 'Invalid job role provided.' });
        }
        
        await conn.beginTransaction();

        let updateQuery = `UPDATE staff SET name = $1, registration_number = $2, role = $3, branch_id = $4, status = $5`;
        let queryParams = [name, registration_number, role, branch_id || 1, status || 'active'];
        
        if (password) {
            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(password, salt);
            updateQuery += `, password_hash = $6 WHERE id = $7`;
            queryParams.push(password_hash, staffId);
        } else {
            updateQuery += ` WHERE id = $6`;
            queryParams.push(staffId);
        }

        await conn.execute(updateQuery, queryParams);

        if (permissions && Array.isArray(permissions)) {
            // Delete old permissions
            await conn.execute(`DELETE FROM staff_permissions WHERE staff_id = $1`, [staffId]);
            // Insert new permissions
            for (const p of permissions) {
                await conn.execute(`INSERT INTO staff_permissions (staff_id, permission_key) VALUES ($1, $2)`, [staffId, p]);
            }
        }

        await conn.commit();
        res.json({ success: true, message: 'Staff updated successfully.' });
    } catch (error) {
        await conn.rollback();
        console.error('updateStaff error:', error);
        res.status(500).json({ success: false, error: 'Internal server error.' });
    } finally {
        conn.release();
    }
};
