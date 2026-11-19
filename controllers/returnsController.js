const pool = require('../db');

// Helper: Arabic month names
const ARABIC_MONTHS = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

/**
 * Format a Date object into Arabic readable labels
 */
function formatDateLabels(dateObj) {
    const year = dateObj.getFullYear();
    const monthIdx = dateObj.getMonth();
    const day = dateObj.getDate();
    const monthPad = String(monthIdx + 1).padStart(2, '0');
    const dayPad = String(day).padStart(2, '0');

    const monthKey = `${year}-${monthPad}`;
    const dayKey = `${year}-${monthPad}-${dayPad}`;
    const monthLabel = `${ARABIC_MONTHS[monthIdx]} ${year}`;
    const dayLabel = `${day} ${ARABIC_MONTHS[monthIdx]} ${year}`;

    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const timeFormatted = `${hours}:${minutes}`;

    return { monthKey, dayKey, monthLabel, dayLabel, timeFormatted };
}

/**
 * GET /api/returns/invoices-tree
 * Query params: branch_id
 * Returns: Hierarchical tree of completed invoices grouped by Month -> Day -> Invoices
 */
exports.getInvoicesTree = async (req, res, next) => {
    try {
        const role = (req.user?.role || '').toUpperCase();
        const isAdmin = (role === 'ADMIN' || role === 'SUPER ADMIN');

        let effectiveBranch = req.branchId;
        if (isAdmin && req.query.branch_id) {
            const parsed = parseInt(req.query.branch_id, 10);
            if (!isNaN(parsed) && parsed > 0) {
                effectiveBranch = parsed;
            }
        }

        if (!effectiveBranch) {
            effectiveBranch = req.user?.active_branch_id || req.user?.assigned_branch_id || 1;
        }

        // 1. Fetch completed wholesale / POS orders
        const ordersSql = `
            SELECT 
                o.id,
                o.order_number,
                'order' AS invoice_type,
                o.total_amount,
                o.status,
                o.created_at,
                o.branch_id,
                COALESCE(d.name, p.name, 'عميل غير مسجل') AS client_name,
                o.client_id,
                o.pharmacy_id,
                o.warehouse_id
            FROM orders o
            LEFT JOIN doctors d ON o.client_id = d.id
            LEFT JOIN pharmacies p ON o.pharmacy_id = p.id
            WHERE LOWER(o.status) IN ('dispatched', 'completed', 'delivered', 'paid', 'approved', 'confirmed')
              AND (o.branch_id = $1 OR o.warehouse_id IN (SELECT id FROM warehouses WHERE branch_id = $1))
            ORDER BY o.created_at DESC
        `;
        const [ordersRows] = await pool.execute(ordersSql, [effectiveBranch]);

        // 2. Fetch retail POS sales
        const retailSql = `
            SELECT 
                rs.id,
                '#RET-' || rs.id AS order_number,
                'retail' AS invoice_type,
                rs.total_amount,
                'Completed' AS status,
                rs.created_at,
                rs.branch_id,
                'مبيعات التجزئة (نقدي)' AS client_name,
                NULL AS client_id,
                NULL AS pharmacy_id,
                NULL AS warehouse_id
            FROM retail_sales rs
            WHERE rs.total_amount > 0
              AND rs.branch_id = $1
            ORDER BY rs.created_at DESC
        `;
        const [retailRows] = await pool.execute(retailSql, [effectiveBranch]);

        // Gather all order IDs and retail sale IDs to batch-fetch items
        const orderIds = ordersRows.map(o => o.id);
        const retailIds = retailRows.map(r => r.id);

        let orderItemsMap = {};
        if (orderIds.length > 0) {
            const placeholders = orderIds.map((_, i) => `$${i + 1}`).join(',');
            const [oItems] = await pool.execute(`
                SELECT 
                    oi.id AS item_id,
                    oi.order_id,
                    oi.product_id,
                    oi.warehouse_id,
                    oi.inventory_id AS batch_id,
                    oi.qty AS sold_qty,
                    COALESCE(oi.returned_qty, 0) AS already_returned_qty,
                    GREATEST(0, oi.qty - COALESCE(oi.returned_qty, 0)) AS returnable_qty,
                    oi.unit_price,
                    COALESCE(oi.base_price, 0) AS cost_price,
                    p.name AS product_name,
                    p.sku,
                    'وحدة' AS unit,
                    wi.batch_number,
                    wi.expiry_date
                FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                LEFT JOIN warehouse_inventory wi ON oi.inventory_id = wi.id
                WHERE oi.order_id IN (${placeholders})
                ORDER BY oi.id ASC
            `, orderIds);

            for (const item of oItems) {
                if (!orderItemsMap[item.order_id]) orderItemsMap[item.order_id] = [];
                orderItemsMap[item.order_id].push({
                    item_id: item.item_id,
                    product_id: item.product_id,
                    product_name: item.product_name,
                    sku: item.sku || '',
                    unit: item.unit || 'وحدة',
                    batch_id: item.batch_id || null,
                    batch_number: item.batch_number || '—',
                    expiry_date: item.expiry_date || null,
                    warehouse_id: item.warehouse_id,
                    sold_qty: parseInt(item.sold_qty, 10),
                    already_returned_qty: parseInt(item.already_returned_qty, 10),
                    returnable_qty: parseInt(item.returnable_qty, 10),
                    unit_price: parseFloat(item.unit_price) || 0,
                    cost_price: parseFloat(item.cost_price) || 0
                });
            }
        }

        let retailItemsMap = {};
        if (retailIds.length > 0) {
            const placeholders = retailIds.map((_, i) => `$${i + 1}`).join(',');
            const [rItems] = await pool.execute(`
                SELECT 
                    rsi.id AS item_id,
                    rsi.sale_id,
                    rsi.product_id,
                    NULL AS batch_id,
                    rsi.qty AS sold_qty,
                    COALESCE(rsi.returned_qty, 0) AS already_returned_qty,
                    GREATEST(0, rsi.qty - COALESCE(rsi.returned_qty, 0)) AS returnable_qty,
                    rsi.selling_price AS unit_price,
                    COALESCE(rsi.cost_price, 0) AS cost_price,
                    p.name AS product_name,
                    p.sku,
                    'وحدة' AS unit,
                    NULL AS batch_number,
                    NULL AS expiry_date
                FROM retail_sale_items rsi
                JOIN products p ON rsi.product_id = p.id
                WHERE rsi.sale_id IN (${placeholders}) AND rsi.qty > 0
                ORDER BY rsi.id ASC
            `, retailIds);

            for (const item of rItems) {
                if (!retailItemsMap[item.sale_id]) retailItemsMap[item.sale_id] = [];
                retailItemsMap[item.sale_id].push({
                    item_id: item.item_id,
                    product_id: item.product_id,
                    product_name: item.product_name,
                    sku: item.sku || '',
                    unit: item.unit || 'وحدة',
                    batch_id: null,
                    batch_number: '—',
                    expiry_date: null,
                    warehouse_id: null,
                    sold_qty: parseInt(item.sold_qty, 10),
                    already_returned_qty: parseInt(item.already_returned_qty, 10),
                    returnable_qty: parseInt(item.returnable_qty, 10),
                    unit_price: parseFloat(item.unit_price) || 0,
                    cost_price: parseFloat(item.cost_price) || 0
                });
            }
        }

        // Combine all invoices
        const allInvoices = [];

        for (const order of ordersRows) {
            const items = orderItemsMap[order.id] || [];
            allInvoices.push({
                id: order.id,
                order_number: order.order_number,
                invoice_type: 'order',
                total_amount: parseFloat(order.total_amount) || 0,
                status: order.status,
                created_at: order.created_at,
                branch_id: order.branch_id,
                client_name: order.client_name,
                client_id: order.client_id,
                pharmacy_id: order.pharmacy_id,
                warehouse_id: order.warehouse_id,
                items
            });
        }

        for (const ret of retailRows) {
            const items = retailItemsMap[ret.id] || [];
            allInvoices.push({
                id: ret.id,
                order_number: ret.order_number,
                invoice_type: 'retail',
                total_amount: parseFloat(ret.total_amount) || 0,
                status: ret.status,
                created_at: ret.created_at,
                branch_id: ret.branch_id,
                client_name: ret.client_name,
                client_id: null,
                pharmacy_id: null,
                warehouse_id: null,
                items
            });
        }

        // Sort descending by created_at
        allInvoices.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // 3. Build hierarchical tree: Month Folders -> Day Folders -> Invoices
        const monthsMap = new Map();

        for (const inv of allInvoices) {
            const dateObj = new Date(inv.created_at);
            const { monthKey, dayKey, monthLabel, dayLabel, timeFormatted } = formatDateLabels(dateObj);

            if (!monthsMap.has(monthKey)) {
                monthsMap.set(monthKey, {
                    monthKey,
                    monthLabel,
                    totalInvoices: 0,
                    totalAmount: 0,
                    daysMap: new Map()
                });
            }

            const monthEntry = monthsMap.get(monthKey);
            monthEntry.totalInvoices++;
            monthEntry.totalAmount += inv.total_amount;

            if (!monthEntry.daysMap.has(dayKey)) {
                monthEntry.daysMap.set(dayKey, {
                    dayKey,
                    dayLabel,
                    totalInvoices: 0,
                    totalAmount: 0,
                    invoices: []
                });
            }

            const dayEntry = monthEntry.daysMap.get(dayKey);
            dayEntry.totalInvoices++;
            dayEntry.totalAmount += inv.total_amount;

            dayEntry.invoices.push({
                ...inv,
                time: timeFormatted,
                dayLabel,
                monthLabel
            });
        }

        // Convert nested maps to array structure
        const tree = Array.from(monthsMap.values()).map(m => ({
            monthKey: m.monthKey,
            monthLabel: m.monthLabel,
            totalInvoices: m.totalInvoices,
            totalAmount: Math.round(m.totalAmount * 100) / 100,
            days: Array.from(m.daysMap.values()).map(d => ({
                dayKey: d.dayKey,
                dayLabel: d.dayLabel,
                totalInvoices: d.totalInvoices,
                totalAmount: Math.round(d.totalAmount * 100) / 100,
                invoices: d.invoices
            }))
        }));

        res.json({
            success: true,
            branch_id: effectiveBranch,
            total_invoices_count: allInvoices.length,
            tree,
            invoices: allInvoices // Also include flat list for quick search lookup
        });

    } catch (err) {
        console.error('❌ Invoices Tree Error:', err);
        next(err);
    }
};

/**
 * GET /api/returns/invoice/:id
 * Lookup a specific invoice by order_number or ID
 */
exports.getInvoiceDetails = async (req, res, next) => {
    try {
        const rawId = req.params.id ? String(req.params.id).trim() : '';
        const role = (req.user?.role || '').toUpperCase();
        const isAdmin = (role === 'ADMIN' || role === 'SUPER ADMIN');
        const effectiveBranch = req.branchId || (req.user?.active_branch_id || req.user?.assigned_branch_id || 1);

        if (!rawId) {
            return res.status(400).json({ error: 'يرجى تحديد رقم الفاتورة للبحث' });
        }

        // 1. Try search in orders table
        const isPureNumber = /^\d+$/.test(rawId);
        const numId = isPureNumber ? parseInt(rawId, 10) : null;
        let order = null;

        let orderSql = 'SELECT o.*, COALESCE(d.name, p.name, \'عميل غير مسجل\') AS client_name, COALESCE(d.phone, p.phone, \'\') AS client_phone, b.name AS branch_name FROM orders o LEFT JOIN doctors d ON o.client_id = d.id LEFT JOIN pharmacies p ON o.pharmacy_id = p.id LEFT JOIN branches b ON o.branch_id = b.id WHERE o.order_number = $1 OR o.order_number ILIKE $1';
        let orderParams = [rawId];
        if (numId !== null) {
            orderSql += ' OR o.id = $2 OR o.order_number ILIKE $3';
            orderParams.push(numId, `%-${numId}`);
        }
        orderSql += ' LIMIT 1';

        let [orderRows] = await pool.execute(orderSql, orderParams);

        if (orderRows.length > 0) {
            order = orderRows[0];
            // Check branch scoping
            if (!isAdmin && order.branch_id && order.branch_id !== effectiveBranch) {
                return res.status(403).json({ error: 'هذه الفاتورة تنتمي لفرع آخر غير الفرع النشط حالياً' });
            }

            const [items] = await pool.execute(`
                SELECT 
                    oi.id AS item_id,
                    oi.product_id,
                    oi.warehouse_id,
                    oi.inventory_id AS batch_id,
                    oi.qty AS sold_qty,
                    COALESCE(oi.returned_qty, 0) AS already_returned_qty,
                    GREATEST(0, oi.qty - COALESCE(oi.returned_qty, 0)) AS returnable_qty,
                    oi.unit_price,
                    COALESCE(oi.base_price, 0) AS cost_price,
                    p.name AS product_name,
                    p.sku,
                    'وحدة' AS unit,
                    wi.batch_number,
                    wi.expiry_date
                FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                LEFT JOIN warehouse_inventory wi ON oi.inventory_id = wi.id
                WHERE oi.order_id = $1
                ORDER BY oi.id ASC
            `, [order.id]);

            return res.json({
                success: true,
                invoice_type: 'order',
                invoice: {
                    id: order.id,
                    order_number: order.order_number,
                    created_at: order.created_at,
                    total_amount: parseFloat(order.total_amount),
                    status: order.status,
                    client_name: order.client_name,
                    client_phone: order.client_phone,
                    branch_id: order.branch_id,
                    warehouse_id: order.warehouse_id,
                    items
                }
            });
        }

        // 2. Try search in retail_sales table
        if (!isNaN(numId) && numId > 0) {
            const [retailRows] = await pool.execute(`
                SELECT rs.*, b.name AS branch_name
                FROM retail_sales rs
                LEFT JOIN branches b ON rs.branch_id = b.id
                WHERE rs.id = $1 AND rs.total_amount > 0
                LIMIT 1
            `, [numId]);

            if (retailRows.length > 0) {
                const sale = retailRows[0];
                if (!isAdmin && sale.branch_id && sale.branch_id !== effectiveBranch) {
                    return res.status(403).json({ error: 'هذه الفاتورة تنتمي لفرع آخر غير الفرع النشط حالياً' });
                }

                const [items] = await pool.execute(`
                    SELECT 
                        rsi.id AS item_id,
                        rsi.product_id,
                        NULL AS batch_id,
                        rsi.qty AS sold_qty,
                        COALESCE(rsi.returned_qty, 0) AS already_returned_qty,
                        GREATEST(0, rsi.qty - COALESCE(rsi.returned_qty, 0)) AS returnable_qty,
                        rsi.selling_price AS unit_price,
                        COALESCE(rsi.cost_price, 0) AS cost_price,
                        p.name AS product_name,
                        p.sku,
                        'وحدة' AS unit
                    FROM retail_sale_items rsi
                    JOIN products p ON rsi.product_id = p.id
                    WHERE rsi.sale_id = $1 AND rsi.qty > 0
                    ORDER BY rsi.id ASC
                `, [sale.id]);

                return res.json({
                    success: true,
                    invoice_type: 'retail',
                    invoice: {
                        id: sale.id,
                        order_number: `#RET-${sale.id}`,
                        created_at: sale.created_at,
                        total_amount: parseFloat(sale.total_amount),
                        status: 'Completed',
                        client_name: 'مبيعات التجزئة (نقدي)',
                        client_phone: '',
                        branch_id: sale.branch_id,
                        warehouse_id: null,
                        items
                    }
                });
            }
        }

        return res.status(404).json({ error: 'لم يتم العثور على الفاتورة بالرقم المحدد' });

    } catch (err) {
        console.error('❌ Get Invoice Details Error:', err);
        next(err);
    }
};

/**
 * POST /api/returns/process
 * Payload: { original_invoice_id, branch_id, items: [{ product_id, batch_id, return_qty }] }
 * Logic:
 *  1. Validation: Ensure return qty does not exceed originally sold / remaining returnable qty.
 *  2. Inventory Restock: Automatically return quantities back to warehouse inventory & products table.
 *  3. Financial & Analytics Adjustment: Record in `returns` & `return_items` tables.
 *  4. Customer Ledger: If order was on credit, deduct from client debt & log transaction.
 */
exports.processReturn = async (req, res, next) => {
    let connection;
    try {
        const { original_invoice_id, branch_id: payloadBranchId, items, return_reason } = req.body;

        if (!original_invoice_id) {
            return res.status(400).json({ error: 'رقم الفاتورة الأصلية مطلوب' });
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'يرجى تحديد صنف واحد على الأقل للإرجاع' });
        }

        const role = (req.user?.role || '').toUpperCase();
        const isAdmin = (role === 'ADMIN' || role === 'SUPER ADMIN');

        let effectiveBranch = req.branchId;
        if (isAdmin && payloadBranchId) {
            const parsed = parseInt(payloadBranchId, 10);
            if (!isNaN(parsed) && parsed > 0) effectiveBranch = parsed;
        }
        if (!effectiveBranch) {
            effectiveBranch = req.user?.active_branch_id || req.user?.assigned_branch_id || 1;
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // ── 1. Find original invoice (orders or retail_sales) ───────────
        const rawId = String(original_invoice_id).trim();
        const isPureNumber = /^\d+$/.test(rawId);
        const numId = isPureNumber ? parseInt(rawId, 10) : null;

        let order = null;
        let retailSale = null;

        // Try orders first
        let orderSql = 'SELECT * FROM orders WHERE order_number = $1 OR order_number ILIKE $1';
        let orderParams = [rawId];
        if (numId !== null) {
            orderSql += ' OR id = $2 OR order_number ILIKE $3';
            orderParams.push(numId, `%-${numId}`);
        }
        orderSql += ' LIMIT 1';

        const [orderRows] = await connection.execute(orderSql, orderParams);

        if (orderRows.length > 0) {
            order = orderRows[0];
        } else if (!isNaN(numId) && numId > 0) {
            const [rsRows] = await connection.execute(`
                SELECT * FROM retail_sales WHERE id = $1 LIMIT 1
            `, [numId]);
            if (rsRows.length > 0) {
                retailSale = rsRows[0];
            }
        }

        if (!order && !retailSale) {
            throw new Error(`لم يتم العثور على الفاتورة رقم ${rawId}`);
        }

        const invoiceBranch = order ? (order.branch_id || effectiveBranch) : retailSale.branch_id;
        if (!isAdmin && invoiceBranch !== effectiveBranch) {
            throw new Error('لا يمكن إرجاع فاتورة خاصة بفرع آخر عن الفرع النشط للمستخدم');
        }

        // Branch to record return against
        const finalBranchId = invoiceBranch || effectiveBranch;

        let totalRefundAmount = 0;
        let totalRefundProfit = 0;
        const processedItems = [];

        // ── Case A: WHOLESALE ORDER RETURN ─────────────────────────────
        if (order) {
            // Fetch current order items
            const [orderItems] = await connection.execute(
                'SELECT * FROM order_items WHERE order_id = $1',
                [order.id]
            );

            if (orderItems.length === 0) {
                throw new Error('لا توجد أصناف في هذا الطلب');
            }

            // Map order items by product_id or id
            for (const reqItem of items) {
                const returnQty = parseInt(reqItem.return_qty, 10) || 0;
                if (returnQty <= 0) continue;

                // Match by item_id or product_id
                let matchedItem = null;
                if (reqItem.item_id) {
                    matchedItem = orderItems.find(oi => oi.id === parseInt(reqItem.item_id, 10));
                }
                if (!matchedItem && reqItem.product_id) {
                    matchedItem = orderItems.find(oi => oi.product_id === parseInt(reqItem.product_id, 10));
                }

                if (!matchedItem) {
                    throw new Error(`الصنف رقم ${reqItem.product_id || reqItem.item_id} غير موجود في الفاتورة الأصلية`);
                }

                // Validation: ensure return qty <= max returnable
                const alreadyReturned = parseInt(matchedItem.returned_qty, 10) || 0;
                const maxReturnable = matchedItem.qty - alreadyReturned;

                if (returnQty > maxReturnable) {
                    throw new Error(
                        `الكمية المطلوب إرجاعها (${returnQty}) تتجاوز الكمية المتبقية القابلة للإرجاع (${maxReturnable}) للصنف #${matchedItem.product_id}`
                    );
                }

                const unitPrice = parseFloat(matchedItem.unit_price) || 0;
                const costPrice = parseFloat(matchedItem.base_price) || 0;
                const itemRefund = returnQty * unitPrice;
                const itemProfit = (unitPrice - costPrice) * returnQty;

                totalRefundAmount += itemRefund;
                totalRefundProfit += itemProfit;

                // Inventory restock: return quantity back to warehouse
                const targetWarehouseId = matchedItem.warehouse_id || order.warehouse_id;
                const targetBatchId = reqItem.batch_id || matchedItem.inventory_id;

                if (targetWarehouseId) {
                    if (targetBatchId) {
                        // Restock exact batch if it exists
                        const [batchCheck] = await connection.execute(
                            'SELECT id FROM warehouse_inventory WHERE id = $1',
                            [targetBatchId]
                        );
                        if (batchCheck.length > 0) {
                            await connection.execute(
                                'UPDATE warehouse_inventory SET current_stock = current_stock + $1 WHERE id = $2',
                                [returnQty, targetBatchId]
                            );
                        } else {
                            await connection.execute(
                                'INSERT INTO warehouse_inventory (product_id, warehouse_id, branch_id, current_stock) VALUES ($1, $2, $3, $4)',
                                [matchedItem.product_id, targetWarehouseId, finalBranchId, returnQty]
                            );
                        }
                    } else {
                        // Find recent inventory entry or create restocked row
                        const [invRows] = await connection.execute(
                            'SELECT id FROM warehouse_inventory WHERE product_id = $1 AND warehouse_id = $2 AND branch_id = $3 ORDER BY id DESC LIMIT 1',
                            [matchedItem.product_id, targetWarehouseId, finalBranchId]
                        );
                        if (invRows.length > 0) {
                            await connection.execute(
                                'UPDATE warehouse_inventory SET current_stock = current_stock + $1 WHERE id = $2',
                                [returnQty, invRows[0].id]
                            );
                        } else {
                            await connection.execute(
                                'INSERT INTO warehouse_inventory (product_id, warehouse_id, branch_id, current_stock) VALUES ($1, $2, $3, $4)',
                                [matchedItem.product_id, targetWarehouseId, finalBranchId, returnQty]
                            );
                        }
                    }
                }

                // Global products stock increment
                await connection.execute(
                    'UPDATE products SET quantity = COALESCE(quantity, 0) + $1 WHERE id = $2',
                    [returnQty, matchedItem.product_id]
                );

                // Update order_items returned_qty
                await connection.execute(
                    'UPDATE order_items SET returned_qty = COALESCE(returned_qty, 0) + $1, return_reason = $2 WHERE id = $3',
                    [returnQty, return_reason || 'مرتجع POS', matchedItem.id]
                );

                processedItems.push({
                    order_item_id: matchedItem.id,
                    retail_sale_item_id: null,
                    product_id: matchedItem.product_id,
                    batch_id: targetBatchId || null,
                    qty: returnQty,
                    unit_price: unitPrice,
                    cost_price: costPrice,
                    total: itemRefund,
                    profit_amount: itemProfit,
                    branch_id: finalBranchId
                });
            }

            if (processedItems.length === 0) {
                throw new Error('يرجى إدخال كمية إرجاع صالحة أكبر من صفر');
            }

            // Generate unique return voucher code
            const [[{ maxRetCode }]] = await connection.execute(
                `SELECT MAX(id) AS "maxRetCode" FROM returns`
            );
            const nextRetNum = (maxRetCode || 1000) + 1;
            const returnNumber = `RET-${new Date().getFullYear()}-${nextRetNum}`;

            // Record in `returns` table
            const [retRes] = await connection.execute(`
                INSERT INTO returns (
                    return_number, order_id, retail_sale_id, branch_id, 
                    client_id, pharmacy_id, total_amount, total_profit, 
                    return_reason, created_by, created_at
                ) VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9, NOW())
                RETURNING id
            `, [
                returnNumber,
                order.id,
                finalBranchId,
                order.client_id || null,
                order.pharmacy_id || null,
                totalRefundAmount,
                totalRefundProfit,
                return_reason || 'إرجاع مبيعات POS',
                req.user?.id || null
            ]);

            const returnId = retRes.insertId || (retRes[0] && retRes[0].id);

            // Record items in `return_items` table
            for (const pItem of processedItems) {
                await connection.execute(`
                    INSERT INTO return_items (
                        return_id, order_item_id, retail_sale_item_id, product_id,
                        batch_id, qty, unit_price, cost_price, total, profit_amount,
                        branch_id, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
                `, [
                    returnId,
                    pItem.order_item_id,
                    pItem.retail_sale_item_id,
                    pItem.product_id,
                    pItem.batch_id,
                    pItem.qty,
                    pItem.unit_price,
                    pItem.cost_price,
                    pItem.total,
                    pItem.profit_amount,
                    pItem.branch_id
                ]);
            }

            // Customer Ledger Adjustment: If order was on credit, deduct returned amount from client debt
            if (order.client_id) {
                await connection.execute(
                    'UPDATE doctors SET total_debt = GREATEST(0, COALESCE(total_debt, 0) - $1) WHERE id = $2',
                    [totalRefundAmount, order.client_id]
                );
                await connection.execute(
                    'INSERT INTO client_transactions (client_id, type, amount, reference_id, branch_id, date) VALUES ($1, $2, $3, $4, $5, NOW())',
                    [order.client_id, 'RETURN', -totalRefundAmount, order.id, finalBranchId]
                );
            } else if (order.pharmacy_id) {
                await connection.execute(
                    'UPDATE pharmacies SET total_debt = GREATEST(0, COALESCE(total_debt, 0) - $1) WHERE id = $2',
                    [totalRefundAmount, order.pharmacy_id]
                );
                await connection.execute(
                    'INSERT INTO client_transactions (pharmacy_id, type, amount, reference_id, branch_id, date) VALUES ($1, $2, $3, $4, $5, NOW())',
                    [order.pharmacy_id, 'RETURN', -totalRefundAmount, order.id, finalBranchId]
                );
            }

            // Check if entire order is fully returned
            const [allCurrentItems] = await connection.execute(
                'SELECT qty, COALESCE(returned_qty, 0) AS returned_qty FROM order_items WHERE order_id = $1',
                [order.id]
            );
            if (allCurrentItems.every(i => i.qty <= i.returned_qty)) {
                await connection.execute("UPDATE orders SET status = 'Returned' WHERE id = $1", [order.id]);
            }

            await connection.commit();

            return res.json({
                success: true,
                message: 'تم إتمام عملية الإرجاع بنجاح، وإعادة الأصناف للمخزون، وتحديث الحسابات والتقارير',
                return_id: returnId,
                return_number: returnNumber,
                invoice_number: order.order_number,
                total_refund: Math.round(totalRefundAmount * 100) / 100,
                items_returned_count: processedItems.length
            });
        }

        // ── Case B: RETAIL SALE RETURN ──────────────────────────────────
        if (retailSale) {
            const [saleItems] = await connection.execute(
                'SELECT * FROM retail_sale_items WHERE sale_id = $1 AND qty > 0',
                [retailSale.id]
            );

            if (saleItems.length === 0) {
                throw new Error('لا توجد أصناف في فاتورة التجزئة المحددة');
            }

            // Find warehouse for restocking
            const [whRows] = await connection.execute(
                'SELECT id FROM warehouses WHERE branch_id = $1 ORDER BY id ASC LIMIT 1',
                [finalBranchId]
            );
            const defaultWhId = whRows.length > 0 ? whRows[0].id : 1;

            for (const reqItem of items) {
                const returnQty = parseInt(reqItem.return_qty, 10) || 0;
                if (returnQty <= 0) continue;

                let matchedItem = null;
                if (reqItem.item_id) {
                    matchedItem = saleItems.find(si => si.id === parseInt(reqItem.item_id, 10));
                }
                if (!matchedItem && reqItem.product_id) {
                    matchedItem = saleItems.find(si => si.product_id === parseInt(reqItem.product_id, 10));
                }

                if (!matchedItem) {
                    throw new Error(`الصنف رقم ${reqItem.product_id || reqItem.item_id} غير موجود في فاتورة التجزئة`);
                }

                const alreadyReturned = parseInt(matchedItem.returned_qty, 10) || 0;
                const maxReturnable = matchedItem.qty - alreadyReturned;

                if (returnQty > maxReturnable) {
                    throw new Error(
                        `الكمية المطلوب إرجاعها (${returnQty}) تتجاوز الكمية المتبقية القابلة للإرجاع (${maxReturnable}) للصنف #${matchedItem.product_id}`
                    );
                }

                const unitPrice = parseFloat(matchedItem.selling_price) || 0;
                const costPrice = parseFloat(matchedItem.cost_price) || 0;
                const itemRefund = returnQty * unitPrice;
                const itemProfit = (unitPrice - costPrice) * returnQty;

                totalRefundAmount += itemRefund;
                totalRefundProfit += itemProfit;

                // Restock warehouse inventory
                const [invRows] = await connection.execute(
                    'SELECT id FROM warehouse_inventory WHERE product_id = $1 AND warehouse_id = $2 AND branch_id = $3 ORDER BY id DESC LIMIT 1',
                    [matchedItem.product_id, defaultWhId, finalBranchId]
                );
                if (invRows.length > 0) {
                    await connection.execute(
                        'UPDATE warehouse_inventory SET current_stock = current_stock + $1 WHERE id = $2',
                        [returnQty, invRows[0].id]
                    );
                } else {
                    await connection.execute(
                        'INSERT INTO warehouse_inventory (product_id, warehouse_id, branch_id, current_stock) VALUES ($1, $2, $3, $4)',
                        [matchedItem.product_id, defaultWhId, finalBranchId, returnQty]
                    );
                }

                // Global products stock increment
                await connection.execute(
                    'UPDATE products SET quantity = COALESCE(quantity, 0) + $1 WHERE id = $2',
                    [returnQty, matchedItem.product_id]
                );

                // Update retail_sale_items returned_qty
                await connection.execute(
                    'UPDATE retail_sale_items SET returned_qty = COALESCE(returned_qty, 0) + $1 WHERE id = $2',
                    [returnQty, matchedItem.id]
                );

                processedItems.push({
                    order_item_id: null,
                    retail_sale_item_id: matchedItem.id,
                    product_id: matchedItem.product_id,
                    batch_id: null,
                    qty: returnQty,
                    unit_price: unitPrice,
                    cost_price: costPrice,
                    total: itemRefund,
                    profit_amount: itemProfit,
                    branch_id: finalBranchId
                });
            }

            if (processedItems.length === 0) {
                throw new Error('يرجى إدخال كمية إرجاع صالحة أكبر من صفر');
            }

            const [[{ maxRetCode }]] = await connection.execute(
                `SELECT MAX(id) AS "maxRetCode" FROM returns`
            );
            const nextRetNum = (maxRetCode || 1000) + 1;
            const returnNumber = `RET-${new Date().getFullYear()}-${nextRetNum}`;

            // Record in `returns` table
            const [retRes] = await connection.execute(`
                INSERT INTO returns (
                    return_number, order_id, retail_sale_id, branch_id, 
                    client_id, pharmacy_id, total_amount, total_profit, 
                    return_reason, created_by, created_at
                ) VALUES ($1, NULL, $2, $3, NULL, NULL, $4, $5, $6, $7, NOW())
                RETURNING id
            `, [
                returnNumber,
                retailSale.id,
                finalBranchId,
                totalRefundAmount,
                totalRefundProfit,
                return_reason || 'إرجاع مبيعات تجزئة POS',
                req.user?.id || null
            ]);

            const returnId = retRes.insertId || (retRes[0] && retRes[0].id);

            // Record items in `return_items` table
            for (const pItem of processedItems) {
                await connection.execute(`
                    INSERT INTO return_items (
                        return_id, order_item_id, retail_sale_item_id, product_id,
                        batch_id, qty, unit_price, cost_price, total, profit_amount,
                        branch_id, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
                `, [
                    returnId,
                    pItem.order_item_id,
                    pItem.retail_sale_item_id,
                    pItem.product_id,
                    pItem.batch_id,
                    pItem.qty,
                    pItem.unit_price,
                    pItem.cost_price,
                    pItem.total,
                    pItem.profit_amount,
                    pItem.branch_id
                ]);
            }

            await connection.commit();

            return res.json({
                success: true,
                message: 'تم إتمام عملية الإرجاع بنجاح، وإعادة الأصناف للمخزون، وتحديث الحسابات والتقارير',
                return_id: returnId,
                return_number: returnNumber,
                invoice_number: `#RET-${retailSale.id}`,
                total_refund: Math.round(totalRefundAmount * 100) / 100,
                items_returned_count: processedItems.length
            });
        }

    } catch (err) {
        if (connection) await connection.rollback();
        console.error('❌ Returns Process Error:', err);
        res.status(400).json({ error: err.message || 'فشلت معالجة عملية الإرجاع' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * GET /api/returns/history
 * List completed returns
 */
exports.getReturnsHistory = async (req, res, next) => {
    try {
        const role = (req.user?.role || '').toUpperCase();
        const isAdmin = (role === 'ADMIN' || role === 'SUPER ADMIN');
        let branchId = req.branchId;

        if (isAdmin && req.query.branch_id && req.query.branch_id !== 'all') {
            branchId = parseInt(req.query.branch_id, 10);
        }

        let sql = `
            SELECT 
                r.*,
                COALESCE(o.order_number, '#RET-' || r.retail_sale_id) AS original_order_number,
                COALESCE(d.name, p.name, 'مبيعات التجزئة') AS client_name,
                b.name AS branch_name,
                (SELECT COUNT(*) FROM return_items ri WHERE ri.return_id = r.id) AS items_count
            FROM returns r
            LEFT JOIN orders o ON r.order_id = o.id
            LEFT JOIN doctors d ON r.client_id = d.id
            LEFT JOIN pharmacies p ON r.pharmacy_id = p.id
            LEFT JOIN branches b ON r.branch_id = b.id
        `;
        let params = [];

        if (branchId && (!isAdmin || req.query.branch_id !== 'all')) {
            sql += ` WHERE r.branch_id = $1`;
            params.push(branchId);
        }

        sql += ` ORDER BY r.created_at DESC LIMIT 50`;

        const [rows] = await pool.execute(sql, params);
        res.json({ success: true, returns: rows });
    } catch (err) {
        next(err);
    }
};
