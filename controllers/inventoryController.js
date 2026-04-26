const pool = require('../config/db');

/**
 * GET /api/inventory
 * Returns warehouse_inventory rows joined with active products only.
 * Soft-deleted products (is_active = 0) are excluded.
 */
exports.getFullInventory = async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT
                wi.id           AS inventory_id,
                p.id            AS product_id,
                p.name          AS item_name,
                p.sku,
                wi.batch_number,
                wi.expiry_date,
                wi.qty_threshold,
                wi.expiry_month_threshold,
                w.name          AS warehouse_name,
                wi.current_stock AS qty,
                p.price,
                p.purchase_price,
                wi.unit_price AS batch_unit_price,
                bu.name         AS base_uom,
                IF(p.bulk_uom_id IS NOT NULL, 1, 0) AS has_bulk_uom,
                blku.name       AS bulk_uom,
                p.conversion_factor
            FROM products p
            LEFT JOIN warehouse_inventory wi  ON p.id = wi.product_id
            LEFT JOIN warehouses w            ON wi.warehouse_id = w.id
            LEFT JOIN uom bu                  ON p.base_uom_id = bu.id
            LEFT JOIN uom blku                ON p.bulk_uom_id = blku.id
            WHERE p.is_active = 1 AND p.is_deleted = 0
            ORDER BY wi.expiry_date ASC
        `);
        res.json(rows || []);
    } catch (err) {
        console.error('❌ Inventory Fetch Error:', err);
        res.status(500).json({ error: 'Failed to fetch inventory' });
    }
};

/**
 * GET /api/inventory/batches/:warehouseId/:productId
 */
exports.getProductBatches = async (req, res) => {
    try {
        const { warehouseId, productId } = req.params;
        const [rows] = await pool.execute(`
            SELECT id, batch_number, expiry_date, current_stock
            FROM warehouse_inventory
            WHERE warehouse_id = ? AND product_id = ? AND current_stock > 0
            ORDER BY expiry_date ASC
        `, [warehouseId, productId]);
        res.json(rows || []);
    } catch (err) {
        console.error('❌ Batch Fetch Error:', err);
        res.status(500).json({ error: 'Failed to fetch batches' });
    }
};

/**
 * PUT /api/inventory/:id
 * Updates a warehouse_inventory record (stock, batch, expiry).
 * This is the ONLY place where inventory records are modified.
 */
exports.updateInventoryRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const { current_stock, batch_number, expiry_date, qty_threshold, expiry_month_threshold } = req.body;

        console.log(`[UPDATE INVENTORY] id=${id}`);
        const [result] = await pool.execute(`
            UPDATE warehouse_inventory
            SET current_stock          = ?,
                batch_number           = ?,
                expiry_date            = ?,
                qty_threshold          = ?,
                expiry_month_threshold = ?
            WHERE id = ?
        `, [
            current_stock,
            batch_number  || null,
            expiry_date   || null,
            qty_threshold          !== undefined ? qty_threshold          : 20,
            expiry_month_threshold !== undefined ? expiry_month_threshold : 3,
            id
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Inventory record not found' });
        }
        res.json({ message: 'Inventory updated successfully' });
    } catch (err) {
        console.error('❌ Inventory Update Error:', err.sqlMessage || err.message);
        res.status(500).json({ error: 'Failed to update inventory record', details: err.sqlMessage || err.message });
    }
};

/**
 * DELETE /api/inventory/:id
 *
 * SOFT DELETE — sets is_active = 0 and is_deleted = 1 on the parent product.
 * The warehouse_inventory rows are intentionally kept intact to preserve
 * historical data (import_logs, order_items, transfer_logs all reference them).
 *
 * This endpoint is the SINGLE source of truth for product deactivation.
 * The /api/products DELETE route is intentionally blocked (see productRoutes.js).
 */
exports.deleteInventoryRecord = async (req, res) => {
    try {
        const { id } = req.params; // this is now product_id
        console.log(`[MASTER-MIRROR DELETE] ▶ Step 1: Initiating delete for product_id=${id}`);

        // ── STEP 1: Soft-delete the Master product record ──────────────────────
        // Sets is_active = 0 AND is_deleted = 1 so it is hidden from ALL queries.
        // FK-linked records (import_logs, order_items, transfer_logs) remain intact.
        const [result] = await pool.execute(
            'UPDATE products SET is_active = 0, is_deleted = 1 WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Product not found.' });
        }
        console.log(`[MASTER-MIRROR DELETE] ✅ Step 1 done: Product id=${id} soft-deleted (is_active=0, is_deleted=1)`);

        // ── STEP 2: Forced Backend Cleanup — wipe the Mirror (warehouse_inventory) ──
        // Even if the BroadcastChannel refresh fails on the frontend, the database
        // is immediately clean. Any surviving rows are also blocked by the JOIN
        // filter in warehouseController.getWarehouseInventory (the Double-Lock).
        const [wipeResult] = await pool.execute(
            'DELETE FROM warehouse_inventory WHERE product_id = ?',
            [id]
        );
        console.log(`[MASTER-MIRROR DELETE] ✅ Step 2 done: Wiped ${wipeResult.affectedRows} warehouse_inventory row(s) for product_id=${id}`);

        res.json({
            message: 'Product deactivated and warehouse inventory wiped successfully.',
            product_id: id,
            warehouse_rows_deleted: wipeResult.affectedRows
        });
    } catch (err) {
        console.error('❌ [MASTER-MIRROR DELETE] Error:', err.sqlMessage || err.message);
        res.status(500).json({ error: 'Failed to deactivate product', details: err.sqlMessage || err.message });
    }
};