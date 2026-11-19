const pool = require('../db');

// ── Branch Configuration Dictionary (fallback when DB branch data is incomplete) ──
const BRANCH_CONFIG = {
    1: {
        name: 'مركز القدس 1 للمستلزمات والاجهزة الطبية',
        address: 'اسوان - النفق - عماره الدكتور عبد الحميد',
        phones: '01114459296 - 01152950806'
    },
    2: {
        name: 'مركز القدس 2 للمستلزمات والأجهزة الطبية',
        address: 'اسوان - السيل - شارع المشرحه بجوار مستشفي اسوان الجامعي - مركز القدس 2',
        phones: '01155675246- 01221884709- 01220212028 - 01227831253'
    }
};

// Generate Next Order Code
async function nextOrderCode() {
    const [[{ maxCode }]] = await pool.execute(
        `SELECT MAX(CAST(SPLIT_PART(order_number, '-', 3) AS INTEGER)) AS "maxCode" FROM orders`
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
            'SELECT id, name, COALESCE(credit_limit, 60000) as credit_limit, COALESCE(total_debt, 0) as total_debt FROM doctors WHERE id = ?',
            [numId]
        );
        client = doc;
        isDoctor = true;
        dbClientId = numId;
    } else if (typeClean === 'pharm') {
        const [[pharm]] = await connection.execute(
            'SELECT id, name, COALESCE(credit_limit, 20000) as credit_limit, COALESCE(total_debt, 0) as total_debt FROM pharmacies WHERE id = ?',
            [numId]
        );
        client = pharm;
        isDoctor = false;
        dbPharmacyId = numId;
    }

    return { client, isDoctor, dbClientId, dbPharmacyId };
}

// ── Helper: update client debt and log transaction ────────────────────────────
async function updateClientDebt(connection, client, isDoctor, amount, type, orderId, branchId) {
    if (isDoctor) {
        await connection.execute(
            'UPDATE doctors SET total_debt = COALESCE(total_debt, 0) + ? WHERE id = ?',
            [amount, client.id]
        );
        await connection.execute(
            'INSERT INTO client_transactions (client_id, type, amount, reference_id, branch_id) VALUES (?, ?, ?, ?, ?)',
            [client.id, type, amount, orderId, branchId]
        );
    } else {
        await connection.execute(
            'UPDATE pharmacies SET total_debt = COALESCE(total_debt, 0) + ? WHERE id = ?',
            [amount, client.id]
        );
        await connection.execute(
            'INSERT INTO client_transactions (pharmacy_id, type, amount, reference_id, branch_id) VALUES (?, ?, ?, ?, ?)',
            [client.id, type, amount, orderId, branchId]
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

        const role = req.user?.role ? req.user.role.toUpperCase() : '';
        const isAdmin = (role === 'ADMIN' || role === 'SUPER ADMIN');
        let branchId = req.branchId;
        if (isAdmin && req.query.branch_id) {
            const parsed = parseInt(req.query.branch_id);
            if (!isNaN(parsed) && parsed > 0) branchId = parsed;
        }
        if (!branchId && req.user) {
            branchId = req.user.active_branch_id || req.user.assigned_branch_id;
        }

        let clientQuery = '';
        let txQuery = '';
        let clientParams = [id];
        let txParams = [id];

        if (type === 'doc') {
            if (branchId) {
                clientQuery = 'SELECT *, location as address, COALESCE(credit_limit, 60000) as credit_limit, COALESCE(total_debt, 0) as total_debt FROM doctors WHERE id = ? AND branch_id = ?';
                clientParams.push(branchId);
                txQuery = 'SELECT type, amount, date, reference_id FROM client_transactions WHERE client_id = ? AND branch_id = ? ORDER BY date DESC LIMIT 5';
                txParams.push(branchId);
            } else {
                clientQuery = 'SELECT *, location as address, COALESCE(credit_limit, 60000) as credit_limit, COALESCE(total_debt, 0) as total_debt FROM doctors WHERE id = ?';
                txQuery = 'SELECT type, amount, date, reference_id FROM client_transactions WHERE client_id = ? ORDER BY date DESC LIMIT 5';
            }
        } else if (type === 'pharm') {
            if (branchId) {
                clientQuery = 'SELECT *, area as address, COALESCE(credit_limit, 20000) as credit_limit, COALESCE(total_debt, 0) as total_debt FROM pharmacies WHERE id = ? AND branch_id = ?';
                clientParams.push(branchId);
                txQuery = 'SELECT type, amount, date, reference_id FROM client_transactions WHERE pharmacy_id = ? AND branch_id = ? ORDER BY date DESC LIMIT 5';
                txParams.push(branchId);
            } else {
                clientQuery = 'SELECT *, area as address, COALESCE(credit_limit, 20000) as credit_limit, COALESCE(total_debt, 0) as total_debt FROM pharmacies WHERE id = ?';
                txQuery = 'SELECT type, amount, date, reference_id FROM client_transactions WHERE pharmacy_id = ? ORDER BY date DESC LIMIT 5';
            }
        } else {
            return res.status(400).json({ error: 'Invalid client prefix format' });
        }

        const [[client]] = await pool.execute(clientQuery, clientParams);
        if (!client) return res.status(404).json({ error: 'Client not found in the active branch' });

        const [transactions] = await pool.execute(txQuery, txParams);

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
                COALESCE(o.client_id, o.pharmacy_id) as client_id
            FROM orders o
            LEFT JOIN doctors d ON o.client_id = d.id
            LEFT JOIN pharmacies p ON o.pharmacy_id = p.id
            ORDER BY o.created_at DESC
            LIMIT ${limit} OFFSET ${offset}
        `);

        res.json({ orders, total, limit, offset });
    } catch (err) { next(err); }
};

// GET /api/orders/:id/details — full order with client info + items + branch + employee (for PDF export)
const getOrderById = async (req, res, next) => {
    try {
        const orderId = req.params.id;

        const [[order]] = await pool.execute(`
            SELECT o.*,
                   COALESCE(d.name, p.name) AS client_name,
                   COALESCE(d.phone, p.phone, '') AS client_phone,
                   COALESCE(d.email, '') AS client_email,
                   COALESCE(d.location, p.area, '') AS client_address,
                   b.name AS branch_db_name,
                   b.address AS branch_db_address,
                   b.phone AS branch_db_phones,
                   s.name AS employee_name
            FROM orders o
            LEFT JOIN doctors d ON o.client_id = d.id
            LEFT JOIN pharmacies p ON o.pharmacy_id = p.id
            LEFT JOIN branches b ON o.branch_id = b.id
            LEFT JOIN staff s ON o.created_by = s.id
            WHERE o.id = ?
        `, [orderId]);

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Resolve branch metadata: prefer DB values, fall back to config dictionary
        const branchId = order.branch_id || 1;
        const fallback = BRANCH_CONFIG[branchId] || BRANCH_CONFIG[2];
        order.branch_display_name = order.branch_db_name || fallback.name;
        order.branch_display_address = order.branch_db_address || fallback.address;
        order.branch_display_phones = order.branch_db_phones || fallback.phones;
        order.employee_display_name = order.employee_name || '';

        const [items] = await pool.execute(`
            SELECT oi.*, p.name as product_name
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        `, [orderId]);

        order.items = items;
        res.json({ success: true, order });
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
            `INSERT INTO orders (order_number, client_id, pharmacy_id, warehouse_id, expected_delivery, total_amount, status, branch_id) VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?)`,
            [orderNumber, dbClientId, dbPharmacyId, warehouse_id, expected_delivery || null, totalAmount, req.branchId || 1]
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
                `INSERT INTO order_items (order_id, product_id, warehouse_id, qty, base_price, unit_price, profit_margin, subtotal, inventory_id, branch_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    orderId,
                    item.product_id,
                    item.warehouse_id || warehouse_id,
                    qty,
                    basePrice,
                    unitPrice,
                    margin,
                    subtotal,
                    item.inventory_id || null,
                    req.branchId || 1
                ]
            );
        }

        // Update customer ledger immediately on order creation (Pending status)
        await updateClientDebt(connection, client, isDoctor, totalAmount, 'ORDER', orderId, req.branchId);

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
        await connection.execute("UPDATE orders SET status = 'Dispatched' WHERE id = ?", [orderId]);

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
                'UPDATE order_items SET returned_qty = COALESCE(returned_qty, 0) + ?, return_reason = ? WHERE id = ?',
                [returnQty, returnItem.return_reason || null, orderItem.id]
            );
        }

        if (totalReturnAmount > 0) {
            // Negative amount = debt reduction
            await updateClientDebt(connection, client, isDoctor, -totalReturnAmount, 'RETURN', orderId, req.branchId);

            const [allItems] = await connection.execute(
                'SELECT qty, COALESCE(returned_qty, 0) as returned_qty FROM order_items WHERE order_id = ?',
                [orderId]
            );
            if (allItems.every(i => i.qty === i.returned_qty)) {
                await connection.execute("UPDATE orders SET status = 'Returned' WHERE id = ?", [orderId]);
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
            await updateClientDebt(connection, client, isDoctor, -parseFloat(order.total_amount), 'CANCEL', orderId, req.branchId);
        }

        await connection.execute("UPDATE orders SET status = 'Cancelled' WHERE id = ?", [orderId]);

        await connection.commit();
        res.json({ success: true, message: 'Order cancelled and debt reversed successfully.' });
    } catch (err) {
        await connection.rollback();
        res.status(400).json({ error: err.message });
    } finally {
        connection.release();
    }
};



// ── GET /api/orders/history/:clientType/:clientId ─────────────────────────
// clientType: 'doctor' | 'pharmacy'
// Returns orders grouped by month, plus aggregate totals.
// Response shape mirrors the supplier /history endpoint for UI reuse.
async function getClientHistory(req, res, next) {
    try {
        const { clientType, clientId } = req.params;
        const id = parseInt(clientId);
        if (!id || !['doctor', 'pharmacy'].includes(clientType)) {
            return res.status(400).json({ error: 'Invalid clientType or clientId' });
        }

        // Build WHERE clause
        const whereCol = clientType === 'doctor' ? 'o.client_id' : 'o.pharmacy_id';

        const [orders] = await pool.execute(`
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
            WHERE ${whereCol} = ${id}
            ORDER BY o.created_at DESC
        `);

        // ── Outstanding balance (sum of non-cancelled orders) ──────────────
        const totalBalance = orders
            .filter(o => o.status !== 'Cancelled')
            .reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);

        // ── Group by Month Year ────────────────────────────────────────────
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
            total_transactions_count: orders.length,
            total_outstanding_balance: totalBalance,
            monthGroups: Array.from(monthMap.values())
        });
    } catch (err) { next(err); }
}

module.exports = { getClients, getOrders, getOrderItems, getOrderById, getCostPrice, createOrder, dispatchOrder, getClientSummary, processReturn, cancelOrder, getClientHistory };
