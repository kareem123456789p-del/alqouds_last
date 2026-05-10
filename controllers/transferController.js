const pool = require('../db');

/**
 * GET /api/transfer/warehouses
 * Returns all warehouses with their total stock fill level.
 */
const getWarehouses = async (req, res, next) => {
    try {
        const [rows] = await pool.execute(`
            SELECT 
                w.id,
                w.name,
                w.location,
                w.capacity,
                COALESCE(SUM(wi.current_stock), 0) AS total_stock
            FROM warehouses w
            LEFT JOIN warehouse_inventory wi ON wi.warehouse_id = w.id
            GROUP BY w.id, w.name, w.location, w.capacity
            ORDER BY w.id
        `);
        res.json(rows);
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/transfer/products/:warehouseId
 * Returns products available in a specific warehouse with stock > 0.
 */
const getWarehouseProducts = async (req, res, next) => {
    const { warehouseId } = req.params;
    try {
        const [rows] = await pool.execute(`
            SELECT 
                p.id,
                p.name,
                p.sku,
                p.price,
                SUM(wi.current_stock) AS available_qty
            FROM warehouse_inventory wi
            JOIN products p ON p.id = wi.product_id
            WHERE wi.warehouse_id = ?
            GROUP BY p.id, p.name, p.sku, p.price
            HAVING SUM(wi.current_stock) > 0
            ORDER BY p.name
        `, [warehouseId]);
        res.json(rows);
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/transfer
 * Uses a MySQL transaction to:
 *  1. Verify target warehouse capacity
 *  2. Verify source stock is sufficient for each item
 *  3. Deduct from source
 *  4. Add to destination (INSERT or UPDATE)
 *  5. Log into transfer_logs
 */
const processTransfer = async (req, res, next) => {
    const { from_warehouse_id, to_warehouse_id, items } = req.body;

    // --- Validation ---
    if (!from_warehouse_id || !to_warehouse_id || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Missing required fields: from_warehouse_id, to_warehouse_id, items[]' });
    }
    if (Number(from_warehouse_id) === Number(to_warehouse_id)) {
        return res.status(400).json({ error: 'Source and destination warehouses cannot be the same.' });
    }
    
    let totalTransferQty = 0;
    for (const item of items) {
        const qty = Number(item.quantity);
        if (!item.product_id || isNaN(qty) || qty <= 0) {
            return res.status(400).json({ error: 'Each item must have a valid product_id and quantity > 0.' });
        }
        totalTransferQty += qty;
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Check Target Warehouse capacity — subquery avoids GROUP BY + FOR UPDATE conflict
        const [targetRows] = await conn.execute(
            `SELECT w.capacity,
                    COALESCE((SELECT SUM(wi2.current_stock) FROM warehouse_inventory wi2 WHERE wi2.warehouse_id = w.id), 0) AS total_stock
             FROM warehouses w
             WHERE w.id = ?
             FOR UPDATE`,
            [to_warehouse_id]
        );

        if (targetRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ error: 'Target warehouse not found.' });
        }

        const { capacity, total_stock } = targetRows[0];
        const remainingCapacity = (capacity || 10000) - Number(total_stock);

        if (remainingCapacity < totalTransferQty) {
            await conn.rollback();
            return res.status(400).json({ 
                error: `Transfer exceeds target warehouse capacity. Target has ${remainingCapacity} units of space remaining.` 
            });
        }

        // Process each item sequentially (FIFO Batch Allocation)
        for (const item of items) {
            const { product_id, quantity } = item;
            let qtyRemainingToTransfer = Number(quantity);
            const totalRequested = qtyRemainingToTransfer;

            // 2. Lock ALL source batches for this product & check total stock (FIFO: expire ASC)
            const [sourceBatches] = await conn.execute(
                `SELECT id, current_stock, batch_number, expiry_date, qty_threshold, expiry_month_threshold 
                 FROM warehouse_inventory 
                 WHERE warehouse_id = ? AND product_id = ? AND current_stock > 0
                 ORDER BY expiry_date ASC FOR UPDATE`,
                [from_warehouse_id, product_id]
            );

            const totalAvailable = sourceBatches.reduce((acc, row) => acc + row.current_stock, 0);

            if (totalAvailable < qtyRemainingToTransfer) {
                await conn.rollback();
                return res.status(400).json({
                    error: `Insufficient stock for product ID ${product_id}. Available: ${totalAvailable}, Requested: ${qtyRemainingToTransfer}`
                });
            }

            // 3. FIFO Deductions & Migrations
            for (const batch of sourceBatches) {
                if (qtyRemainingToTransfer <= 0) break; // Fully transferred

                const amountToTransferFromThisBatch = Math.min(qtyRemainingToTransfer, batch.current_stock);

                // Deduct from THIS specific batch in source warehouse
                await conn.execute(
                    `UPDATE warehouse_inventory 
                     SET current_stock = current_stock - ? 
                     WHERE id = ?`,
                    [amountToTransferFromThisBatch, batch.id]
                );

                // Lock destination warehouse to prevent race conditions on `batch_number/expiry_date` duplicate matching
                const [existingDestBatch] = await conn.execute(
                    `SELECT id FROM warehouse_inventory 
                     WHERE warehouse_id = ? AND product_id = ?
                       AND (batch_number = ? OR (batch_number IS NULL AND ? IS NULL))
                       AND (expiry_date = ? OR (expiry_date IS NULL AND ? IS NULL))
                     FOR UPDATE`,
                    [
                        to_warehouse_id, product_id, 
                        batch.batch_number, batch.batch_number, 
                        batch.expiry_date, batch.expiry_date
                    ]
                );

                // Add to destination warehouse (Merge if exact batch exists, else Insert pristine copy)
                if (existingDestBatch.length > 0) {
                    await conn.execute(
                        `UPDATE warehouse_inventory 
                         SET current_stock = current_stock + ? 
                         WHERE id = ?`,
                        [amountToTransferFromThisBatch, existingDestBatch[0].id]
                    );
                } else {
                    await conn.execute(
                        `INSERT INTO warehouse_inventory (warehouse_id, product_id, batch_number, expiry_date, current_stock, qty_threshold, expiry_month_threshold)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [to_warehouse_id, product_id, batch.batch_number, batch.expiry_date, amountToTransferFromThisBatch, batch.qty_threshold, batch.expiry_month_threshold]
                    );
                }

                qtyRemainingToTransfer -= amountToTransferFromThisBatch;
            }

            // 4. Log the transfer accurately (Total across all batches transferred)
            await conn.execute(
                `INSERT INTO transfer_logs (from_warehouse_id, to_warehouse_id, product_id, quantity)
                 VALUES (?, ?, ?, ?)`,
                [from_warehouse_id, to_warehouse_id, product_id, totalRequested]
            );
        }

        await conn.commit();
        res.status(200).json({
            success: true,
            message: `Transfer completed successfully. ${items.length} item type(s) moved.`
        });
    } catch (err) {
        await conn.rollback();
        console.error('❌ Transfer Transaction Error:', err.message);
        
        // Handle specific MySQL constraints
        if (err.errno === 1213 || err.code === 'ER_LOCK_DEADLOCK') {
            return res.status(500).json({ error: 'Deadlock encountered during transfer. Please try again.' });
        }
        if (err.errno === 1452 || err.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({ error: 'Foreign Key constraints failed. Invalid product or warehouse ID.' });
        }
        
        res.status(500).json({ error: 'Internal server error during transfer processing.' });
    } finally {
        conn.release();
    }
};

/**
 * GET /api/transfer/logs
 * Returns recent transfer history.
 */
const getTransferLogs = async (req, res, next) => {
    try {
        const [rows] = await pool.execute(`
            SELECT 
                tl.id,
                fw.name AS from_warehouse,
                tw.name AS to_warehouse,
                p.name AS product_name,
                p.sku,
                tl.quantity,
                tl.transferred_at
            FROM transfer_logs tl
            JOIN warehouses fw ON fw.id = tl.from_warehouse_id
            JOIN warehouses tw ON tw.id = tl.to_warehouse_id
            JOIN products p ON p.id = tl.product_id
            ORDER BY tl.transferred_at DESC
            LIMIT 100
        `);
        res.json(rows);
    } catch (err) {
        next(err);
    }
};

module.exports = { getWarehouses, getWarehouseProducts, processTransfer, getTransferLogs };
