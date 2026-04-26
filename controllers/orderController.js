const pool = require('../db');

// Generate Next Order Code
async function nextOrderCode() {
    const [[{ maxCode }]] = await pool.execute(
        `SELECT MAX(CAST(SUBSTRING_INDEX(order_number, '-', -1) AS UNSIGNED)) AS maxCode FROM orders`
    );
    const next = (maxCode || 1000) + 1;
    const year = new Date().getFullYear();
    return `#ORD-${year}-${next}`;
}

// ── Helper: resolve client from rawId (e.g. "doc-5", "pharm-3") ──────────────
async function resolveClient(connection, rawClientId) {
    const [type, actualId] = rawClientId.split(/[-_]/);
    const typeClean = type ? type.trim() : '';
    const numId = actualId ? actualId.trim() : null;

    let client = null;
    let isDoctor = false;
    let dbClientId = null;
    let dbPharmacyId = null;

    if (typeClean === 'doc') {
        const [[doc]] = await connection.execute(
            'SELECT id, name, IFNULL(credit_limit, 60000) as credit_limit, IFNULL(total_debt, 0) as total_debt FROM doctors WHERE id = ?',
            [numId]
        );
        client = doc;
        isDoctor = true;
        dbClientId = numId;
    } else if (typeClean === 'pharm') {
        const [[pharm]] = await connection.execute(
            'SELECT id, name, IFNULL(credit_limit, 20000) as credit_limit, IFNULL(total_debt, 0) as total_debt FROM pharmacies WHERE id = ?',
            [numId]
        );
        client = pharm;
        isDoctor = false;
        dbPharmacyId = numId;
    }

    return { client, isDoctor, dbClientId, dbPharmacyId };
}

// ── Helper: update client debt and log transaction ────────────────────────────
async function updateClientDebt(connection, client, isDoctor, amount, type, orderId) {
    if (isDoctor) {
        await connection.execute(
            'UPDATE doctors SET total_debt = IFNULL(total_debt, 0) + ? WHERE id = ?',
            [amount, client.id]
        );
        await connection.execute(
            'INSERT INTO client_transactions (client_id, type, amount, reference_id) VALUES (?, ?, ?, ?)',
            [client.id, type, amount, orderId]
        );
    } else {
        await connection.execute(
            'UPDATE pharmacies SET total_debt = IFNULL(total_debt, 0) + ? WHERE id = ?',
            [amount, client.id]
        );
        await connection.execute(
            'INSERT INTO client_transactions (pharmacy_id, type, amount, reference_id) VALUES (?, ?, ?, ?)',
            [client.id, type, amount, orderId]
        );
    }
}

// ── GET /api/orders/product/:id/cost-price ─────────────────────────────────────
// Returns the supplier (purchase) price for a product.
const getCostPrice = async (req, res, next) => {
    try {
        const { id } = req.params;
        const [[product]] = await pool.execute(
            'SELECT id, name, purchase_price, price FROM products WHERE id = ? AND is_deleted = 0',
            [id]
        );
        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json({
            product_id: product.id,
            name: product.name,
            cost_price: parseFloat(product.purchase_price) || 0,
            selling_price: parseFloat(product.price) || 0
        });
    } catch (err) { next(err); }
};

// GET /api/orders/clients
const getClients = async (req, res, next) => {
    try {
        const [clients] = await pool.execute('SELECT id, name FROM clients ORDER BY name ASC');
        res.json(clients);
    } catch (err) { next(err); }
};

// GET /api/clients/:id/summary
const getClientSummary = async (req, res, next) => {
    try {
        const rawId = req.params.id;
        const [type, id] = rawId.split(/[-_]/);

        let clientQuery = '';
        let txQuery = '';

        if (type === 'doc') {
            clientQuery = 'SELECT *, location as address, IFNULL(credit_limit, 60000) as credit_limit, IFNULL(total_debt, 0) as total_debt FROM doctors WHERE id = ?';
            txQuery = 'SELECT type, amount, date, reference_id FROM client_transactions WHERE client_id = ? ORDER BY date DESC LIMIT 5';
        } else if (type === 'pharm') {
            clientQuery = 'SELECT *, area as address, IFNULL(credit_limit, 20000) as credit_limit, IFNULL(total_debt, 0) as total_debt FROM pharmacies WHERE id = ?';
            txQuery = 'SELECT type, amount, date, reference_id FROM client_transactions WHERE pharmacy_id = ? ORDER BY date DESC LIMIT 5';
        } else {
            return res.status(400).json({ error: 'Invalid client prefix format' });
        }

        const [[client]] = await pool.execute(clientQuery, [id]);
        if (!client) return res.status(404).json({ error: 'Client not found' });

        const [transactions] = await pool.execute(txQuery, [id]);

        res.json({ client, transactions });
    } catch (err) { next(err); }
};

// GET /api/orders
const getOrders = async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const offset = Math.max(parseInt(req.query.offset) || 0, 0);

        const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM orders`);

        const [orders] = await pool.execute(`
            SELECT 
                o.id, o.order_number, o.created_at, o.total_amount, o.status,
                COALESCE(d.name, p.name) as client_name,
                IF(o.client_id IS NOT NULL, o.client_id, o.pharmacy_id) as client_id
            FROM orders o
            LEFT JOIN doctors d ON o.client_id = d.id
            LEFT JOIN pharmacies p ON o.pharmacy_id = p.id
            ORDER BY o.created_at DESC
            LIMIT ? OFFSET ?
        `, [limit, offset]);

        res.json({ orders, total, limit, offset });
    } catch (err) { next(err); }
};

// GET /api/orders/:id/items
const getOrderItems = async (req, res, next) => {
    try {
        const orderId = req.params.id;
        const [items] = await pool.execute(`
            SELECT oi.*, p.name as product_name
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        `, [orderId]);
        res.json(items);
    } catch (err) { next(err); }
};

// POST /api/orders
// Creates the order, inserts items, and immediately records debt on the customer ledger.
const createOrder = async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { client_id: rawClientId, warehouse_id, expected_delivery, items } = req.body;

        if (!rawClientId || !warehouse_id || !items || items.length === 0) {
            return res.status(400).json({ error: 'Client, warehouse, and items are required.' });
        }

        // Resolve client
        const { client, isDoctor, dbClientId, dbPharmacyId } = await resolveClient(connection, rawClientId);
        if (!client) {
            return res.status(404).json({ error: 'Client not found in database.' });
        }

        const orderNumber = await nextOrderCode();

        // Calculate total from the immutable per-item prices sent by the frontend
        let totalAmount = 0;
        for (const item of items) {
            totalAmount += parseFloat(item.unit_price) * parseInt(item.qty);
        }

        // Credit limit check BEFORE creating the order
        const newDebt = parseFloat(client.total_debt) + totalAmount;
        if (newDebt > parseFloat(client.credit_limit)) {
            throw new Error(
                `Credit Limit Exceeded. ` +
                `Limit: $${Number(client.credit_limit).toFixed(2)}, ` +
                `Current Debt: $${Number(client.total_debt).toFixed(2)}, ` +
                `This Order: $${totalAmount.toFixed(2)}. ` +
                `New Total Would Be: $${newDebt.toFixed(2)}.`
            );
        }

        // Insert order
        const [orderResult] = await connection.execute(
            `INSERT INTO orders (order_number, client_id, pharmacy_id, warehouse_id, expected_delivery, total_amount, status) VALUES (?, ?, ?, ?, ?, ?, 'Pending')`,
            [orderNumber, dbClientId, dbPharmacyId, warehouse_id, expected_delivery || null, totalAmount]
        );
        const orderId = orderResult.insertId;

        // Insert order items — base_price is the cost price (purchase_price), unit_price is the selling price
        for (const item of items) {
            const qty = parseInt(item.qty);
            const unitPrice = parseFloat(item.unit_price);
            const basePrice = parseFloat(item.base_price) || 0;
            const margin = parseFloat(item.profit_margin) || 0;
            const subtotal = qty * unitPrice;
            await connection.execute(
                `INSERT INTO order_items (order_id, product_id, warehouse_id, qty, base_price, unit_price, profit_margin, subtotal, inventory_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    orderId,
                    item.product_id,
                    item.warehouse_id || warehouse_id,
                    qty,
                    basePrice,
                    unitPrice,
                    margin,
                    subtotal,
                    item.inventory_id || null
                ]
            );
        }

        // Update customer ledger immediately on order creation (Pending status)
        await updateClientDebt(connection, client, isDoctor, totalAmount, 'ORDER', orderId);

        await connection.commit();
        res.status(201).json({ success: true, order_id: orderId, order_number: orderNumber, total_amount: totalAmount });
    } catch (err) {
        await connection.rollback();
        // Use 400 for business logic errors so frontend can display the message
        res.status(400).json({ error: err.message });
    } finally {
        connection.release();
    }
};

// PUT /api/orders/:id/dispatch
// Dispatches order: deducts stock only (debt was already recorded on creation).
const dispatchOrder = async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const orderId = req.params.id;

        const [[order]] = await connection.execute('SELECT * FROM orders WHERE id = ?', [orderId]);
        if (!order) throw new Error('Order not found');
        if (order.status !== 'Pending') throw new Error('Order is not in Pending status');

        // Inventory deduction (FEFO or strict batch)
        const [items] = await connection.execute('SELECT * FROM order_items WHERE order_id = ?', [orderId]);

        for (const item of items) {
            const reqWarehouseId = item.warehouse_id || order.warehouse_id;
            if (!reqWarehouseId) throw new Error('Order item does not have an assigned warehouse_id for dispatch.');

            if (item.inventory_id) {
                // Strict batch mode
                const [[batch]] = await connection.execute(
                    'SELECT id, current_stock FROM warehouse_inventory WHERE id = ? AND warehouse_id = ? AND product_id = ?',
                    [item.inventory_id, reqWarehouseId, item.product_id]
                );
                if (!batch) throw new Error(`Batch ID ${item.inventory_id} not found for Product ${item.product_id}.`);
                if (batch.current_stock < item.qty) throw new Error(`Insufficient stock in batch ID ${item.inventory_id}. Requested: ${item.qty}, Available: ${batch.current_stock}.`);
                await connection.execute(
                    'UPDATE warehouse_inventory SET current_stock = current_stock - ? WHERE id = ?',
                    [item.qty, batch.id]
                );
            } else {
                // AUTO FEFO
                const [batches] = await connection.execute(
                    'SELECT id, current_stock FROM warehouse_inventory WHERE warehouse_id = ? AND product_id = ? AND current_stock > 0 ORDER BY expiry_date ASC',
                    [reqWarehouseId, item.product_id]
                );
                const totalStock = batches.reduce((s, b) => s + b.current_stock, 0);
                if (totalStock < item.qty) throw new Error(`Insufficient stock for Product ID ${item.product_id}. Missing ${item.qty - totalStock} units.`);

                let remaining = item.qty;
                for (const batch of batches) {
                    if (remaining <= 0) break;
                    const deduct = Math.min(batch.current_stock, remaining);
                    await connection.execute(
                        'UPDATE warehouse_inventory SET current_stock = current_stock - ? WHERE id = ?',
                        [deduct, batch.id]
                    );
                    remaining -= deduct;
                }
            }

            if (!item.warehouse_id) {
                await connection.execute('UPDATE order_items SET warehouse_id = ? WHERE id = ?', [reqWarehouseId, item.id]);
            }
        }

        // Mark as dispatched — debt was already added at order creation, no double-count
        await connection.execute('UPDATE orders SET status = "Dispatched" WHERE id = ?', [orderId]);

        await connection.commit();
        res.json({ success: true, message: 'Order dispatched successfully.' });
    } catch (err) {
        await connection.rollback();
        res.status(400).json({ error: err.message });
    } finally {
        connection.release();
    }
};

// POST /api/orders/:id/return
const processReturn = async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const orderId = req.params.id;
        const { items } = req.body;

        if (!items || items.length === 0) throw new Error('No items provided for return.');

        const [[order]] = await connection.execute('SELECT * FROM orders WHERE id = ?', [orderId]);
        if (!order) throw new Error('Order not found');
        if (order.status !== 'Dispatched') throw new Error('Only dispatched orders can be returned');

        const { client, isDoctor } = await resolveClient(
            connection,
            order.client_id ? `doc-${order.client_id}` : `pharm-${order.pharmacy_id}`
        );
        if (!client) throw new Error('Linked client/pharmacy no longer exists in database.');

        let totalReturnAmount = 0;

        for (const returnItem of items) {
            const returnQty = parseInt(returnItem.return_qty) || 0;
            if (returnQty <= 0) continue;

            const [[orderItem]] = await connection.execute(
                'SELECT * FROM order_items WHERE id = ? AND order_id = ?',
                [returnItem.item_id, orderId]
            );
            if (!orderItem) throw new Error(`Order item ID ${returnItem.item_id} not found.`);

            const maxReturnable = orderItem.qty - (orderItem.returned_qty || 0);
            if (returnQty > maxReturnable) throw new Error(`Cannot return ${returnQty} for item ID ${returnItem.item_id}. Max returnable: ${maxReturnable}.`);

            const itemReturnValue = returnQty * parseFloat(orderItem.unit_price);
            totalReturnAmount += itemReturnValue;

            const itemWarehouseId = orderItem.warehouse_id || order.warehouse_id;
            if (itemWarehouseId) {
                const [check] = await connection.execute(
                    'SELECT id FROM warehouse_inventory WHERE warehouse_id = ? AND product_id = ? AND expiry_date IS NULL AND batch_number IS NULL',
                    [itemWarehouseId, orderItem.product_id]
                );
                if (check.length > 0) {
                    await connection.execute(
                        'UPDATE warehouse_inventory SET current_stock = current_stock + ? WHERE id = ?',
                        [returnQty, check[0].id]
                    );
                } else {
                    await connection.execute(
                        'INSERT INTO warehouse_inventory (warehouse_id, product_id, current_stock, expiry_date, batch_number) VALUES (?, ?, ?, NULL, NULL)',
                        [itemWarehouseId, orderItem.product_id, returnQty]
                    );
                }
            }

            await connection.execute(
                'UPDATE order_items SET returned_qty = IFNULL(returned_qty, 0) + ?, return_reason = ? WHERE id = ?',
                [returnQty, returnItem.return_reason || null, orderItem.id]
            );
        }

        if (totalReturnAmount > 0) {
            // Negative amount = debt reduction
            await updateClientDebt(connection, client, isDoctor, -totalReturnAmount, 'RETURN', orderId);

            const [allItems] = await connection.execute(
                'SELECT qty, IFNULL(returned_qty, 0) as returned_qty FROM order_items WHERE order_id = ?',
                [orderId]
            );
            if (allItems.every(i => i.qty === i.returned_qty)) {
                await connection.execute('UPDATE orders SET status = "Returned" WHERE id = ?', [orderId]);
            }
        }

        await connection.commit();
        res.json({ success: true, message: 'Return processed successfully.', refund_amount: totalReturnAmount });
    } catch (err) {
        await connection.rollback();
        res.status(400).json({ error: err.message });
    } finally {
        connection.release();
    }
};

// PUT /api/orders/:id/cancel
// Cancels a Pending order and reverses the debt that was added on creation.
const cancelOrder = async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const orderId = req.params.id;

        const [[order]] = await connection.execute('SELECT * FROM orders WHERE id = ?', [orderId]);
        if (!order) throw new Error('Order not found');
        if (order.status !== 'Pending') throw new Error('Only Pending orders can be cancelled. Dispatched orders must be returned instead.');

        // Resolve client to reverse the debt
        const rawId = order.client_id ? `doc-${order.client_id}` : `pharm-${order.pharmacy_id}`;
        const { client, isDoctor } = await resolveClient(connection, rawId);

        // Reverse the debt that was charged on order creation
        if (client && parseFloat(order.total_amount) > 0) {
            await updateClientDebt(connection, client, isDoctor, -parseFloat(order.total_amount), 'CANCEL', orderId);
        }

        await connection.execute('UPDATE orders SET status = "Cancelled" WHERE id = ?', [orderId]);

        await connection.commit();
        res.json({ success: true, message: 'Order cancelled and debt reversed successfully.' });
    } catch (err) {
        await connection.rollback();
        res.status(400).json({ error: err.message });
    } finally {
        connection.release();
    }
};

module.exports = { getClients, getOrders, getOrderItems, getCostPrice, createOrder, dispatchOrder, getClientSummary, processReturn, cancelOrder };
