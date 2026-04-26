const pool = require('../config/db');

/**
 * GET /api/warehouse/stats
 */
const getStats = async (req, res, next) => {
    try {
        const [[{ warehouseCount }]] = await pool.execute(
            'SELECT COUNT(*) AS warehouseCount FROM warehouses'
        );
        const [[{ totalValue }]] = await pool.execute(`
            SELECT COALESCE(SUM(wi.current_stock * p.price), 0) AS totalValue
            FROM warehouse_inventory wi
            LEFT JOIN products p ON p.id = wi.product_id
            WHERE p.is_active = 1 AND p.is_deleted = 0
        `);
        const [[{ productLines }]] = await pool.execute(`
            SELECT COUNT(DISTINCT wi.product_id) AS productLines 
            FROM warehouse_inventory wi
            LEFT JOIN products p ON p.id = wi.product_id
            WHERE p.is_active = 1 AND p.is_deleted = 0
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
            LEFT JOIN warehouse_inventory wi ON wi.warehouse_id = w.id
            LEFT JOIN products p ON wi.product_id = p.id
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
            WHERE wi.warehouse_id = ? AND wi.current_stock > 0
              AND p.is_active = 1 AND p.is_deleted = 0
            ORDER BY p.name, wi.expiry_date ASC
            LIMIT 500
        `, [id]);
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
            ORDER BY il.created_at DESC
            LIMIT 20
        `);
        res.json(rows);
    } catch (err) { next(err); }
};

/**
 * POST /api/warehouse
 * Body: { name, location, capacity }
 */
const createWarehouse = async (req, res, next) => {
    const { name, location, capacity } = req.body;
    if (!name || !location) {
        return res.status(400).json({ error: 'Name and location are required.' });
    }
    try {
        const [result] = await pool.execute(
            'INSERT INTO warehouses (name, location, capacity) VALUES (?, ?, ?)',
            [name.trim(), location.trim(), parseInt(capacity) || 10000]
        );
        const [[newWarehouse]] = await pool.execute(
            `SELECT id, name, location, capacity, 0 AS total_stock, 0 AS product_count FROM warehouses WHERE id = ?`,
            [result.insertId]
        );
        res.status(201).json(newWarehouse);
    } catch (err) { next(err); }
};

/**
 * PUT /api/warehouse/:id
 * Body: { name, location, capacity }
 */
const updateWarehouse = async (req, res, next) => {
    const { id } = req.params;
    const { name, location, capacity } = req.body;
    if (!name || !location) {
        return res.status(400).json({ error: 'Name and location are required.' });
    }
    try {
        await pool.execute(
            'UPDATE warehouses SET name = ?, location = ?, capacity = ? WHERE id = ?',
            [name.trim(), location.trim(), parseInt(capacity) || 10000, id]
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
        await pool.execute('DELETE FROM warehouses WHERE id = ?', [id]);
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
