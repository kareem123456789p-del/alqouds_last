const pool = require('../db');

/**
 * GET /api/imports/suppliers
 * Fetch active local suppliers filtered by the user's branch (strict branch isolation)
 */
const getActiveSuppliers = async (req, res, next) => {
    try {
        const [rows] = await pool.execute(
            'SELECT id, company_name, contact_person FROM local_suppliers WHERE branch_id = ? ORDER BY company_name',
            [req.branchId]
        );
        res.json(rows);
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/imports/warehouse-stock?warehouse_id=X
 * Fetch product stock levels for a specific warehouse within the user's branch.
 * Returns each active product with its aggregated stock in that warehouse.
 */
const getWarehouseStock = async (req, res, next) => {
    const warehouseId = req.query.warehouse_id;
    if (!warehouseId) {
        return res.status(400).json({ error: 'warehouse_id query parameter is required.' });
    }
    try {
        const [rows] = await pool.execute(`
            SELECT 
                p.id,
                p.name,
                p.sku,
                COALESCE(SUM(wi.current_stock), 0) AS warehouse_stock,
                bu.name  AS base_uom_name,
                blku.name AS bulk_uom_name,
                p.conversion_factor
            FROM products p
            LEFT JOIN warehouse_inventory wi 
                ON wi.product_id = p.id 
               AND wi.warehouse_id = ? 
               AND wi.branch_id = ?
            LEFT JOIN uom bu   ON p.base_uom_id = bu.id
            LEFT JOIN uom blku ON p.bulk_uom_id  = blku.id
            WHERE p.is_active = 1 AND p.is_deleted = 0
            GROUP BY p.id, p.name, p.sku, bu.name, blku.name, p.conversion_factor
            ORDER BY p.name
        `, [warehouseId, req.branchId]);
        res.json(rows);
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/imports
 * Fetch recent imports for the log table
 */
const getImports = async (req, res, next) => {
    try {
        const [rows] = await pool.execute(`
            SELECT 
                il.id,
                il.quantity,
                il.unit_price,
                il.status,
                il.created_at,
                il.invoice_image,
                il.shipment_id,
                p.name AS item_description,
                p.sku,
                ls.company_name AS supplier_name,
                w.name AS warehouse_name,
                bu.name AS base_uom_name,
                blku.name AS bulk_uom_name,
                p.conversion_factor
            FROM import_logs il
            JOIN products p ON p.id = il.product_id
            LEFT JOIN uom bu ON p.base_uom_id = bu.id
            LEFT JOIN uom blku ON p.bulk_uom_id = blku.id
            JOIN local_suppliers ls ON ls.id = il.supplier_id
            LEFT JOIN warehouses w ON w.id = il.warehouse_id
            WHERE il.branch_id = ?
            ORDER BY il.created_at DESC
            LIMIT 50
        `, [req.branchId]);
        res.json(rows);
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/imports
 * Register a new shipment (Batch), update inventory, log it, and optionally archive an invoice image.
 * Accepts multipart/form-data:
 *   - items       : JSON string of the shipment items array
 *   - invoiceImage: (optional) image file upload
 */
const createImport = async (req, res, next) => {
    // Parse items from JSON string (sent as a FormData field)
    let items;
    try {
        items = typeof req.body.items === 'string'
            ? JSON.parse(req.body.items)
            : req.body.items;
    } catch (e) {
        return res.status(400).json({ error: 'Invalid items payload — must be a valid JSON array.' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'No items provided for shipment.' });
    }

    // Invoice image path (null if no file uploaded)
    const invoiceImagePath = req.file
        ? `/uploads/invoices/${req.file.filename}`
        : null;

    // Unique shipment ID to group all items in this batch
    const shipmentId = `SHP-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    console.log(`=== INCOMING BATCH IMPORT | shipment_id=${shipmentId} | items=${items.length} | invoice=${invoiceImagePath || 'none'} ===`);

    try {
        // Start a transaction since we are affecting multiple tables
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            for (const item of items) {
                const { product_id, warehouse_id, supplier_id, quantity, unit_price, batch_number, expiry_date, qty_threshold, expiry_month_threshold } = item;

                if (!product_id || !warehouse_id || !supplier_id || !quantity || !unit_price) {
                    throw new Error('All fields are required for each item.');
                }

                // D-BUG-8: Validate warehouse belongs to caller's branch
                const [whCheck] = await connection.execute(
                    'SELECT id FROM warehouses WHERE id = ? AND branch_id = ?',
                    [warehouse_id, req.branchId]
                );
                if (!whCheck || whCheck.length === 0) {
                    const err = new Error('Warehouse not found in caller branch.');
                    err.statusCode = 400;
                    throw err;
                }

                const qty = parseInt(quantity, 10);
                const price = parseFloat(unit_price);
                const totalAmount = qty * price;

                // 1. Update overall product quantity and 'Last-In' Purchase Price (Cost), plus Master Selling Price
                await connection.execute(
                    'UPDATE products SET quantity = quantity + ?, purchase_price = ?, price = ? WHERE id = ?',
                    [qty, price, price, product_id]
                );

                // 2. Update warehouse inventory (Batch tracking)
                const expiryQueryValue = expiry_date ? expiry_date : null;
                const batchQueryValue = batch_number ? batch_number : null;

                let query = 'SELECT id FROM warehouse_inventory WHERE warehouse_id = ? AND product_id = ?';
                const queryParams = [warehouse_id, product_id];

                if (expiryQueryValue) {
                    query += ' AND expiry_date = ?';
                    queryParams.push(expiryQueryValue);
                } else {
                    query += ' AND expiry_date IS NULL';
                }

                if (batchQueryValue) {
                    query += ' AND batch_number = ?';
                    queryParams.push(batchQueryValue);
                } else {
                    query += ' AND batch_number IS NULL';
                }

                const [inventoryCheck] = await connection.execute(query, queryParams);

                if (inventoryCheck.length > 0) {
                    await connection.execute(
                        'UPDATE warehouse_inventory SET current_stock = current_stock + ?, qty_threshold = ?, expiry_month_threshold = ?, unit_price = ? WHERE id = ? AND branch_id = ?',
                        [qty, qty_threshold || 20, expiry_month_threshold || 3, price, inventoryCheck[0].id, req.branchId]
                    );
                } else {
                    await connection.execute(
                        `INSERT INTO warehouse_inventory
                        (warehouse_id, product_id, current_stock, batch_number, expiry_date, qty_threshold, expiry_month_threshold, unit_price, branch_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [warehouse_id, product_id, qty, batchQueryValue, expiryQueryValue, qty_threshold || 20, expiry_month_threshold || 3, price, req.branchId]
                    );
                }

                // 3. Log the import — includes shipment_id and invoice_image for archive
                const [importLogResult] = await connection.execute(
                    `INSERT INTO import_logs
                        (product_id, supplier_id, quantity, unit_price, warehouse_id, shipment_id, invoice_image, branch_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [product_id, supplier_id, qty, price, warehouse_id, shipmentId, invoiceImagePath, req.branchId]
                );

                const importLogId = importLogResult.insertId;

                // 4. Log the supplier transaction
                await connection.execute(
                    'INSERT INTO supplier_transactions (supplier_id, import_log_id, total_amount, transaction_type, branch_id) VALUES (?, ?, ?, ?, ?)',
                    [supplier_id, importLogId, totalAmount, 'IMPORT_CHARGE', req.branchId]
                );
            }

            await connection.commit();
            res.status(201).json({ success: true, message: 'Shipment registered successfully.' });

        } catch (txnError) {
            await connection.rollback();
            const status = txnError.statusCode || 400;
            return res.status(status).json({ error: txnError.message });
        } finally {
            connection.release();
        }

    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/imports/:id/return
 * Process a return to supplier for a specific import log
 */
const processImportReturn = async (req, res, next) => {
    const importLogId = req.params.id;
    const { return_qty, return_reason } = req.body;

    if (!return_qty || return_qty <= 0) {
        return res.status(400).json({ error: 'Valid return quantity is required.' });
    }

    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // 1. Get the import log strictly within caller's branch (D-BUG-6)
            const [[importLog]] = await connection.execute('SELECT * FROM import_logs WHERE id = ? AND branch_id = ?', [importLogId, req.branchId]);

            if (!importLog) {
                const err = new Error('Import log not found.');
                err.statusCode = 404;
                throw err;
            }

            const maxReturnable = importLog.quantity - (importLog.returned_qty || 0);
            const qty = parseInt(return_qty, 10);

            if (qty > maxReturnable) {
                throw new Error(`Cannot return ${qty}. Only ${maxReturnable} available to return.`);
            }

            const itemReturnValue = qty * parseFloat(importLog.unit_price);

            // 2. Decrease warehouse inventory (FEFO Logic across batches)
            if (importLog.warehouse_id) {
                const [batches] = await connection.execute(
                    'SELECT id, current_stock FROM warehouse_inventory WHERE warehouse_id = ? AND product_id = ? AND branch_id = ? AND current_stock > 0 ORDER BY expiry_date ASC',
                    [importLog.warehouse_id, importLog.product_id, req.branchId]
                );

                const totalStock = batches.reduce((sum, b) => sum + b.current_stock, 0);
                if (totalStock < qty) {
                    throw new Error('Insufficient current stock in warehouse to process this return.');
                }

                let remainingToDeduct = qty;
                for (const batch of batches) {
                    if (remainingToDeduct <= 0) break;
                    const deductAmount = Math.min(batch.current_stock, remainingToDeduct);
                    await connection.execute(
                        'UPDATE warehouse_inventory SET current_stock = current_stock - ? WHERE id = ?',
                        [deductAmount, batch.id]
                    );
                    remainingToDeduct -= deductAmount;
                }
            }

            // Optional: decrease total quantity in products table
            await connection.execute(
                'UPDATE products SET quantity = quantity - ? WHERE id = ?',
                [qty, importLog.product_id]
            );

            // 3. Update the import log
            await connection.execute(
                'UPDATE import_logs SET returned_qty = COALESCE(returned_qty, 0) + ?, return_reason = ? WHERE id = ?',
                [qty, return_reason || null, importLogId]
            );

            // 4. Log the supplier transaction (credit)
            await connection.execute(
                'INSERT INTO supplier_transactions (supplier_id, import_log_id, total_amount, transaction_type, branch_id) VALUES (?, ?, ?, ?, ?)',
                [importLog.supplier_id, importLogId, -itemReturnValue, 'RETURN_CREDIT', req.branchId]
            );

            // Check if fully returned (D-BUG-7)
            if (importLog.quantity === (importLog.returned_qty || 0) + qty) {
                await connection.execute("UPDATE import_logs SET status = 'Returned' WHERE id = ?", [importLogId]);
            }

            await connection.commit();
            res.json({ success: true, message: 'Return to supplier processed successfully.', refund_amount: itemReturnValue });
        } catch (txnError) {
            await connection.rollback();
            const status = txnError.statusCode || 400;
            res.status(status).json({ error: txnError.message });
        } finally {
            connection.release();
        }
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getActiveSuppliers,
    getWarehouseStock,
    getImports,
    createImport,
    processImportReturn
};
