const pool = require('../config/db');

/**
 * GET /api/warehouse/stats
 */
const getStats = async (req, res, next) => {
    try {
        const [[{ warehouseCount }]] = await pool.execute(
            'SELECT COUNT(*) AS warehouseCount FROM warehouses WHERE branch_id = ?', [req.branchId]
        );
        const [[{ totalValue }]] = await pool.execute(`
            SELECT COALESCE(SUM(wi.current_stock * p.price), 0) AS totalValue
            FROM warehouse_inventory wi
            LEFT JOIN products p ON p.id = wi.product_id
            WHERE p.is_active = 1 AND p.is_deleted = 0 AND wi.branch_id = ${req.branchId}
        `);
        const [[{ productLines }]] = await pool.execute(`
            SELECT COUNT(DISTINCT wi.product_id) AS productLines 
            FROM warehouse_inventory wi
            LEFT JOIN products p ON p.id = wi.product_id
            WHERE p.is_active = 1 AND p.is_deleted = 0 AND wi.branch_id = ${req.branchId}
        `);
        res.json({
            active_warehouses: warehouseCount,
            total_inventory_value: parseFloat(totalValue).toFixed(2),
            product_lines: productLines
        });
    } catch (err) { next(err); }
};

/**
 * GET /api/warehouse/list
 */
const getWarehouses = async (req, res, next) => {
    try {
        const [rows] = await pool.execute(`
            SELECT 
                w.id,
                w.name,
                w.location,
                w.capacity,
                COALESCE(SUM(CASE WHEN p.is_active = 1 AND p.is_deleted = 0 THEN wi.current_stock ELSE 0 END), 0) AS total_stock,
                COUNT(DISTINCT CASE WHEN p.is_active = 1 AND p.is_deleted = 0 THEN wi.product_id END) AS product_count
            FROM warehouses w
            LEFT JOIN warehouse_inventory wi ON wi.warehouse_id = w.id AND wi.branch_id = ${req.branchId}
            LEFT JOIN products p ON wi.product_id = p.id
            WHERE w.branch_id = ${req.branchId}
            GROUP BY w.id, w.name, w.location, w.capacity
            ORDER BY w.id
        `);
        res.json(rows);
    } catch (err) { next(err); }
};

/**
 * GET /api/warehouse/:id/inventory
 */
const getWarehouseInventory = async (req, res, next) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.execute(`
            SELECT 
                p.id,
                p.name,
                p.sku,
                p.price AS unit_price,
                COALESCE(wi.expiry_date, p.expiry_date) AS expiry_date,
                wi.batch_number,
                wi.current_stock AS quantity,
                bu.name AS base_uom_name,
                blku.name AS bulk_uom_name,
                p.conversion_factor
            FROM warehouse_inventory wi
            LEFT JOIN products p ON p.id = wi.product_id
            LEFT JOIN uom bu ON p.base_uom_id = bu.id
            LEFT JOIN uom blku ON p.bulk_uom_id = blku.id
            WHERE wi.warehouse_id = ? AND wi.current_stock > 0 AND wi.branch_id = ?
              AND p.is_active = 1 AND p.is_deleted = 0
            ORDER BY p.name, wi.expiry_date ASC
            LIMIT 500
        `, [id, req.branchId]);
        res.json(rows);
    } catch (err) { next(err); }
};

/**
 * GET /api/warehouse/movements
 * Uses import_logs as the movement source (transfer_logs table does not exist)
 */
const getMovements = async (req, res, next) => {
    try {
        const [rows] = await pool.execute(`
            SELECT
                il.id,
                il.quantity,
                il.created_at  AS transferred_at,
                il.warehouse_id,
                p.name         AS product_name,
                w.name         AS warehouse_name,
                ls.company_name AS supplier_name,
                il.status,
                'import'       AS movement_type
            FROM import_logs il
            JOIN products p         ON p.id  = il.product_id
            JOIN warehouses w       ON w.id  = il.warehouse_id
            LEFT JOIN local_suppliers ls ON ls.id = il.supplier_id
            WHERE il.branch_id = ?
            ORDER BY il.created_at DESC
            LIMIT 20
        `, [req.branchId]);
        res.json(rows);
    } catch (err) { next(err); }
};

/**
 * POST /api/warehouse
 * Body: { name, location, capacity }
 * branch_id is STRICTLY taken from req.branchId (set by branchScope middleware).
 * DO NOT read branch_id from req.body.
 */
const createWarehouse = async (req, res, next) => {
    const { name, location, capacity } = req.body;
    const branchId = req.branchId;

    if (!name) {
        return res.status(400).json({ error: 'Warehouse name is required.' });
    }
    if (!branchId) {
        return res.status(400).json({ success: false, message: 'Branch ID is missing from session.' });
    }

    const query = `
        INSERT INTO warehouses (name, location, capacity, branch_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, location, capacity, 0 AS total_stock, 0 AS product_count;
    `;
    const values = [name.trim(), location ? location.trim() : null, parseInt(capacity, 10) || 10000, branchId];

    try {
        // Use pool.query directly with postgres variables
        const [rows] = await pool.query(query, values);
        
        // pool.query using our wrapper returns [rows, fields]. We want the first row.
        const newWarehouse = Array.isArray(rows) && rows.length > 0 ? rows[0] : rows;
        
        res.status(201).json({ success: true, data: newWarehouse });
    } catch (err) {
        console.error("Error creating warehouse:", err);
        // Catch foreign key / constraint errors and return clean responses
        if (err.code === '23503') {
            return res.status(400).json({ error: 'Invalid branch reference. The specified branch does not exist.' });
        }
        if (err.code === '23505') {
            return res.status(409).json({ error: 'A warehouse with this name already exists.' });
        }
        if (err.code === '23502') {
            return res.status(400).json({ error: 'Missing required field (NOT NULL constraint violated).' });
        }
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
};

/**
 * PUT /api/warehouse/:id
 * Body: { name, location, capacity }
 * Scoped to the user's branch — cannot edit warehouses belonging to other branches.
 */
const updateWarehouse = async (req, res, next) => {
    const { id } = req.params;
    const { name, location, capacity } = req.body;
    if (!name || !location) {
        return res.status(400).json({ error: 'Name and location are required.' });
    }
    try {
        await pool.execute(
            'UPDATE warehouses SET name = ?, location = ?, capacity = ? WHERE id = ? AND branch_id = ?',
            [name.trim(), location.trim(), parseInt(capacity) || 10000, id, req.branchId]
        );
        res.json({ success: true });
    } catch (err) { next(err); }
};

/**
 * DELETE /api/warehouse/:id
 */
const deleteWarehouse = async (req, res, next) => {
    const { id } = req.params;
    try {
        await pool.execute('DELETE FROM warehouses WHERE id = ? AND branch_id = ?', [id, req.branchId]);
        res.json({ success: true });
    } catch (err) { next(err); }
};

module.exports = {
    getStats,
    getWarehouses,
    getWarehouseInventory,
    getMovements,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse
};
