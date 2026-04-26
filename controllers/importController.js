const pool = require('../db');

/**
 * GET /api/imports/suppliers
 * Fetch all active local suppliers for the dropdown
 */
const getActiveSuppliers = async (req, res, next) => {
    try {
        const [rows] = await pool.execute(
            'SELECT id, company_name, contact_person FROM local_suppliers ORDER BY company_name'
        );
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
            ORDER BY il.created_at DESC
            LIMIT 50
        `);
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
                        'UPDATE warehouse_inventory SET current_stock = current_stock + ?, qty_threshold = ?, expiry_month_threshold = ?, unit_price = ? WHERE id = ?',
                        [qty, qty_threshold || 20, expiry_month_threshold || 3, price, inventoryCheck[0].id]
                    );
                } else {
                    await connection.execute(
                        'INSERT INTO warehouse_inventory (warehouse_id, product_id, current_stock, batch_number, expiry_date, qty_threshold, expiry_month_threshold, unit_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        [warehouse_id, product_id, qty, batchQueryValue, expiryQueryValue, qty_threshold || 20, expiry_month_threshold || 3, price]
                    );
                }

                // 3. Log the import — includes shipment_id and invoice_image for archive
                const [importLogResult] = await connection.execute(
                    `INSERT INTO import_logs
                        (product_id, supplier_id, quantity, unit_price, warehouse_id, shipment_id, invoice_image)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [product_id, supplier_id, qty, price, warehouse_id, shipmentId, invoiceImagePath]
                );

                const importLogId = importLogResult.insertId;

                // 4. Log the supplier transaction
                await connection.execute(
                    'INSERT INTO supplier_transactions (supplier_id, import_log_id, total_amount, transaction_type) VALUES (?, ?, ?, ?)',
                    [supplier_id, importLogId, totalAmount, 'IMPORT_CHARGE']
                );
            }

            await connection.commit();
            res.status(201).json({ success: true, message: 'Shipment registered successfully.' });

        } catch (txnError) {
            await connection.rollback();
            throw txnError;
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
            // 1. Get the import log
            const [[importLog]] = await connection.execute('SELECT * FROM import_logs WHERE id = ?', [importLogId]);

            if (!importLog) {
                throw new Error('Import log not found.');
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
                    'SELECT id, current_stock FROM warehouse_inventory WHERE warehouse_id = ? AND product_id = ? AND current_stock > 0 ORDER BY expiry_date ASC',
                    [importLog.warehouse_id, importLog.product_id]
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
                'UPDATE import_logs SET returned_qty = IFNULL(returned_qty, 0) + ?, return_reason = ? WHERE id = ?',
                [qty, return_reason || null, importLogId]
            );

            // 4. Log the supplier transaction (credit)
            await connection.execute(
                'INSERT INTO supplier_transactions (supplier_id, import_log_id, total_amount, transaction_type) VALUES (?, ?, ?, ?)',
                [importLog.supplier_id, importLogId, -itemReturnValue, 'RETURN_CREDIT']
            );

            // Check if fully returned
            if (importLog.quantity === (importLog.returned_qty || 0) + qty) {
                await connection.execute('UPDATE import_logs SET status = "Returned" WHERE id = ?', [importLogId]);
            }

            await connection.commit();
            res.json({ success: true, message: 'Return to supplier processed successfully.', refund_amount: itemReturnValue });
        } catch (txnError) {
            await connection.rollback();
            res.status(400).json({ error: txnError.message });
        } finally {
            connection.release();
        }
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getActiveSuppliers,
    getImports,
    createImport,
    processImportReturn
};
