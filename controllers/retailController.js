const pool = require('../db');

// --- Products Fetch for POS ---
exports.searchProducts = async (req, res, next) => {
    try {
        const query = req.query.q || '';
        const warehouseId = parseInt(req.query.warehouse_id) || 6;
        const searchPattern = `%${query}%`;
        
        // Fetch products matching name or sku, get stock only for specified warehouse_id.
        // Also fetch nearest_expiry.
        // Include products even if current_stock is 0 or NULL in this warehouse, to show to user.
        const [products] = await pool.execute(`
            SELECT 
                p.id, p.name, p.sku, p.price, p.purchase_price,
                COALESCE((
                    SELECT SUM(current_stock) 
                    FROM warehouse_inventory 
                    WHERE product_id = p.id AND warehouse_id = ?
                ), 0) as total_stock,
                (
                    SELECT expiry_date 
                    FROM warehouse_inventory 
                    WHERE product_id = p.id AND warehouse_id = ? AND current_stock > 0 
                    ORDER BY expiry_date ASC LIMIT 1
                ) as nearest_expiry
            FROM products p
            WHERE p.is_deleted = 0 AND p.is_active = 1
            AND (p.name LIKE ? OR p.sku LIKE ?)
            LIMIT 50
        `, [warehouseId, warehouseId, searchPattern, searchPattern]);

        res.json(products);
    } catch (err) { next(err); }
};

// Shift Management
exports.getCurrentShift = async (req, res, next) => {
    try {
        const [shifts] = await pool.execute("SELECT * FROM retail_shifts WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1");
        if (shifts.length === 0) {
            return res.json({ shift: null });
        }
        res.json({ shift: shifts[0] });
    } catch (err) { next(err); }
};

exports.openShift = async (req, res, next) => {
    try {
        const [shifts] = await pool.execute("SELECT * FROM retail_shifts WHERE status = 'OPEN'");
        if (shifts.length > 0) return res.status(400).json({ error: 'A shift is already open.' });

        const [result] = await pool.execute("INSERT INTO retail_shifts (status) VALUES ('OPEN')");
        res.json({ success: true, shift_id: result.insertId });
    } catch (err) { next(err); }
};

exports.closeShift = async (req, res, next) => {
    try {
        const [shifts] = await pool.execute("SELECT * FROM retail_shifts WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1");
        if (shifts.length === 0) return res.status(400).json({ error: 'No open shift to close.' });

        const shiftId = shifts[0].id;
        await pool.execute("UPDATE retail_shifts SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP WHERE id = ?", [shiftId]);

        res.json({ success: true, shift_id: shiftId });
    } catch (err) { next(err); }
};

exports.getShiftReport = async (req, res, next) => {
    try {
        const shiftId = req.params.id;
        const [[shift]] = await pool.execute("SELECT * FROM retail_shifts WHERE id = ?", [shiftId]);
        if (!shift) return res.status(404).json({ error: 'Shift not found.' });

        const [sales] = await pool.execute("SELECT * FROM retail_sales WHERE shift_id = ?", [shiftId]);
        
        // Explicit column selection — include product_id + products.purchase_price as fallback
        const [items] = await pool.execute(`
            SELECT 
                rsi.product_id,
                rsi.qty,
                rsi.selling_price,
                rsi.profit_amount,
                p.name AS product_name,
                p.purchase_price AS current_purchase_price,
                rs.created_at AS sale_time
            FROM retail_sale_items rsi
            LEFT JOIN products p ON rsi.product_id = p.id
            LEFT JOIN retail_sales rs ON rsi.sale_id = rs.id
            WHERE rs.shift_id = ?
            ORDER BY rs.created_at ASC
        `, [shiftId]);

        let totalRevenue = 0;
        let totalCostOfSoldItems = 0;

        const rawReportItems = items.map(item => {
            const qty = parseInt(item.qty, 10) || 0;
            const unitPrice = parseFloat(item.selling_price) || 0;

            // Strict rule: Always compare against the 'CURRENT' purchase price from products table
            let costPrice = parseFloat(item.current_purchase_price) || 0;
            let costMissing = false;
            
            if (costPrice <= 0) {
                costMissing = true;
            }

            const itemRevenue = unitPrice * qty;
            const itemCost = costPrice * qty;
            
            totalRevenue += itemRevenue;
            // Only count cost if we actually have a real cost — stay honest
            totalCostOfSoldItems += costMissing ? 0 : itemCost;
            
            // Profit calculation: ((selling_price - purchase_price) / purchase_price) * 100
            let profitPercentage = null;  // null = unknown
            if (!costMissing && costPrice > 0 && unitPrice > 0) {
                profitPercentage = ((unitPrice - costPrice) / costPrice) * 100;
            }

            return {
                product_name: item.product_name || 'غير محدد',
                qty,
                unit_price: unitPrice,
                cost_price: costPrice,
                cost_missing: costMissing,
                line_total: itemRevenue,
                profit_percentage: profitPercentage,
                sale_time: new Date(item.sale_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            };
        });

        // Net Profit: items with missing cost contribute 0 profit (honest accounting)
        const netProfit = totalRevenue - totalCostOfSoldItems;

        res.json({ 
            shift, 
            sales_count: sales.length, 
            total_revenue: totalRevenue, 
            total_profit: netProfit, 
            items: rawReportItems 
        });
    } catch (err) { next(err); }
};


exports.recordSale = async (req, res, next) => {
    let connection;
    try {
        const { items, warehouse_id } = req.body;
        const sourceWarehouseId = parseInt(warehouse_id) || 6;
        if (!items || items.length === 0) return res.status(400).json({ error: 'No items in sale.' });

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [shifts] = await connection.execute("SELECT * FROM retail_shifts WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1");
        if (shifts.length === 0) {
            throw new Error('Shift is closed. Please open a shift first.');
        }
        const shiftId = shifts[0].id;

        let totalAmount = 0;
        let totalProfit = 0;
        const itemInserts = [];

        for (const item of items) {
            const { product_id, qty, cost_price: frontendCost, unit_price } = item;
            if (qty <= 0) throw new Error('Quantity must be greater than zero.');

            const validSellingPrice = parseFloat(unit_price) || 0.00;
            if (validSellingPrice <= 0) throw new Error('Selling price must be greater than zero.');

            // Get product info — use frontend cost_price if provided, otherwise fetch from DB
            const [[prod]] = await connection.execute("SELECT name, purchase_price, quantity as total_stock FROM products WHERE id = ?", [product_id]);
            if (!prod) throw new Error(`Product ${product_id} not found.`);

            const costPrice = (frontendCost !== undefined && frontendCost !== null && parseFloat(frontendCost) > 0)
                ? parseFloat(frontendCost)
                : (parseFloat(prod.purchase_price) || 0.00);

            const itemProfit = (validSellingPrice - costPrice) * qty;

            totalAmount += validSellingPrice * qty;
            totalProfit += itemProfit;

            itemInserts.push({
                product_id,
                qty,
                costPrice,
                sellingPrice: validSellingPrice,
                itemProfit
            });

            // FEFO Deduction from the selected warehouse
            const [batches] = await connection.execute(
                'SELECT id, current_stock FROM warehouse_inventory WHERE product_id = ? AND warehouse_id = ? AND current_stock > 0 ORDER BY expiry_date ASC',
                [product_id, sourceWarehouseId]
            );

            const availableStock = batches.reduce((sum, b) => sum + b.current_stock, 0);
            if (availableStock < qty) {
                throw new Error(`Insufficient stock for ${prod.name} in the selected warehouse. Need ${qty}, but only ${availableStock} available.`);
            }

            let remainingToDeduct = qty;
            for (const batch of batches) {
                if (remainingToDeduct <= 0) break;
                const deduct = Math.min(batch.current_stock, remainingToDeduct);
                await connection.execute('UPDATE warehouse_inventory SET current_stock = current_stock - ? WHERE id = ?', [deduct, batch.id]);
                remainingToDeduct -= deduct;
            }

            // Sync total stock on products table
            await connection.execute('UPDATE products SET quantity = quantity - ? WHERE id = ?', [qty, product_id]);
        }

        // Insert Sale
        const [saleRes] = await connection.execute(
            "INSERT INTO retail_sales (shift_id, total_amount, profit_amount) VALUES (?, ?, ?)",
            [shiftId, totalAmount, totalProfit]
        );
        const saleId = saleRes.insertId;

        for (const ins of itemInserts) {
            await connection.execute(
                "INSERT INTO retail_sale_items (sale_id, product_id, qty, cost_price, selling_price, profit_amount) VALUES (?, ?, ?, ?, ?, ?)",
                [saleId, ins.product_id, ins.qty, ins.costPrice, ins.sellingPrice, ins.itemProfit]
            );
        }

        await connection.commit();
        res.status(201).json({ success: true, sale_id: saleId });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Retail Sale Error:", err);
        res.status(500).json({ error: err.message || 'Error recording sale' });
    } finally {
        if (connection) connection.release();
    }
};


// --- Sales Returns ---
exports.getSaleInvoice = async (req, res, next) => {
    try {
        const saleId = req.params.id;
        const [[sale]] = await pool.execute("SELECT * FROM retail_sales WHERE id = ?", [saleId]);
        
        if (!sale) {
            return res.status(404).json({ error: 'Invoice not found.' });
        }

        const [items] = await pool.execute(`
            SELECT rsi.*, p.name as product_name
            FROM retail_sale_items rsi
            JOIN products p ON p.id = rsi.product_id
            WHERE rsi.sale_id = ?
        `, [saleId]);

        res.json({ sale, items });
    } catch (err) {
        next(err);
    }
};

exports.processReturn = async (req, res, next) => {
    let connection;
    try {
        const { original_sale_id, items } = req.body;
        // Default warehouse for returns (Main Warehouse or Shop)
        const warehouseId = parseInt(req.body.warehouse_id) || 6; 

        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'No items to return.' });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Ensure there's an OPEN shift to deduct the return from
        const [shifts] = await connection.execute("SELECT * FROM retail_shifts WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1");
        if (shifts.length === 0) {
            throw new Error('Shift is closed. Please open a shift to process returns.');
        }
        const shiftId = shifts[0].id;

        let refundTotal = 0;
        let refundProfit = 0;
        const returnInserts = [];

        for (const item of items) {
            const { product_id, return_qty, unit_price, cost_price } = item;
            const qty = parseInt(return_qty, 10);
            
            if (qty <= 0) continue; // Skip if 0

            const sellingPrice = parseFloat(unit_price) || 0;
            const cost = parseFloat(cost_price) || 0;

            const itemRefundAmount = sellingPrice * qty;
            const itemRefundProfit = (sellingPrice - cost) * qty;

            refundTotal += itemRefundAmount;
            refundProfit += itemRefundProfit;

            returnInserts.push({
                product_id,
                qty: -qty, // Negative quantity for the report
                costPrice: cost,
                sellingPrice,
                itemProfit: -itemRefundProfit
            });

            // 1. Restore global stock in products table
            await connection.execute('UPDATE products SET quantity = quantity + ? WHERE id = ?', [qty, product_id]);

            // 2. Restore warehouse_inventory (Find the most recent batch or create one)
            const [batches] = await connection.execute(
                'SELECT id FROM warehouse_inventory WHERE product_id = ? AND warehouse_id = ? ORDER BY id DESC LIMIT 1',
                [product_id, warehouseId]
            );

            if (batches.length > 0) {
                await connection.execute('UPDATE warehouse_inventory SET current_stock = current_stock + ? WHERE id = ?', [qty, batches[0].id]);
            } else {
                await connection.execute(
                    'INSERT INTO warehouse_inventory (product_id, warehouse_id, current_stock) VALUES (?, ?, ?)',
                    [product_id, warehouseId, qty]
                );
            }
        }

        if (returnInserts.length === 0) {
            throw new Error('No valid quantities to return.');
        }

        // Insert Negative Sale Record
        const [saleRes] = await connection.execute(
            "INSERT INTO retail_sales (shift_id, total_amount, profit_amount) VALUES (?, ?, ?)",
            [shiftId, -refundTotal, -refundProfit]
        );
        const returnSaleId = saleRes.insertId;

        // Insert Negative Sale Items
        for (const ins of returnInserts) {
            await connection.execute(
                "INSERT INTO retail_sale_items (sale_id, product_id, qty, cost_price, selling_price, profit_amount) VALUES (?, ?, ?, ?, ?, ?)",
                [returnSaleId, ins.product_id, ins.qty, ins.costPrice, ins.sellingPrice, ins.itemProfit]
            );
        }

        await connection.commit();
        res.json({ success: true, refund_total: refundTotal, return_sale_id: returnSaleId });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Retail Return Error:", err);
        res.status(500).json({ error: err.message || 'Error processing return' });
    } finally {
        if (connection) connection.release();
    }
};

// --- ADMIN: Products with Missing Cost ---
exports.listZeroCostProducts = async (req, res, next) => {
    try {
        const [products] = await pool.execute(`
            SELECT id, name, sku, purchase_price, price 
            FROM products 
            WHERE (purchase_price IS NULL OR purchase_price <= 0) 
              AND is_deleted = 0 AND is_active = 1
            ORDER BY name ASC
        `);
        res.json({ count: products.length, products });
    } catch (err) { next(err); }
};

exports.fixProductPrice = async (req, res, next) => {
    try {
        const { product_id, purchase_price } = req.body;
        if (!product_id || !purchase_price) {
            return res.status(400).json({ error: 'product_id and purchase_price are required.' });
        }
        const cost = parseFloat(purchase_price);
        if (isNaN(cost) || cost <= 0) {
            return res.status(400).json({ error: 'purchase_price must be a positive number.' });
        }

        // Update the product's purchase_price
        await pool.execute('UPDATE products SET purchase_price = ? WHERE id = ?', [cost, product_id]);

        // Also backfill any retail_sale_items that have cost_price = 0 for this product
        const [result] = await pool.execute(
            'UPDATE retail_sale_items SET cost_price = ? WHERE product_id = ? AND (cost_price IS NULL OR cost_price <= 0)',
            [cost, product_id]
        );

        res.json({ 
            success: true, 
            message: `Updated product ${product_id} cost to ${cost}. Backfilled ${result.affectedRows} sale records.` 
        });
    } catch (err) { next(err); }
};
