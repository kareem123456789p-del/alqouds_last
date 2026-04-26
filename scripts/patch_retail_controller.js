const fs = require('fs');
let code = fs.readFileSync('controllers/retailController.js', 'utf8');

const targetStr = '// --- ADMIN: Products with Missing Cost ---';
const splitIdx = code.indexOf(targetStr);

if (splitIdx === -1) {
    console.error("Could not find insertion point.");
    process.exit(1);
}

const before = code.substring(0, splitIdx);
const after = code.substring(splitIdx);

const newCode = `
// --- Sales Returns ---
exports.getSaleInvoice = async (req, res, next) => {
    try {
        const saleId = req.params.id;
        const [[sale]] = await pool.execute("SELECT * FROM retail_sales WHERE id = ?", [saleId]);
        
        if (!sale) {
            return res.status(404).json({ error: 'Invoice not found.' });
        }

        const [items] = await pool.execute(\`
            SELECT rsi.*, p.name as product_name
            FROM retail_sale_items rsi
            JOIN products p ON p.id = rsi.product_id
            WHERE rsi.sale_id = ?
        \`, [saleId]);

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

`;

fs.writeFileSync('controllers/retailController.js', before + newCode + after);
console.log("retailController.js updated.");
