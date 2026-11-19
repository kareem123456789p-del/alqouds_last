const pool = require('../db');
const returnsController = require('../controllers/returnsController');
const analyticsController = require('../controllers/analyticsController');

async function runTests() {
    console.log('🚀 Starting Tests for Returns Management System...');
    let passed = 0;
    let failed = 0;

    function assert(cond, msg) {
        if (cond) {
            console.log(`  ✅ PASS: ${msg}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${msg}`);
            failed++;
        }
    }

    try {
        // Test 1: Invoices Tree Query
        console.log('\n--- 1. Testing GET /api/returns/invoices-tree ---');
        const mockReqTree = {
            user: { role: 'ADMIN', active_branch_id: 2 },
            branchId: 2,
            query: { branch_id: '2' }
        };
        let treeResult = null;
        const mockResTree = {
            json(data) { treeResult = data; },
            status(code) { return this; }
        };

        await returnsController.getInvoicesTree(mockReqTree, mockResTree, (err) => { throw err; });

        assert(treeResult && treeResult.success === true, 'getInvoicesTree returns success: true');
        assert(Array.isArray(treeResult.tree), 'tree is an array of Month folders');
        console.log(`     Found ${treeResult.total_invoices_count} invoices in branch 2 across ${treeResult.tree.length} month folder(s)`);
        
        if (treeResult.tree.length > 0) {
            const firstMonth = treeResult.tree[0];
            assert(firstMonth.monthLabel && firstMonth.monthKey, `Month folder has label: ${firstMonth.monthLabel} (${firstMonth.monthKey})`);
            assert(Array.isArray(firstMonth.days) && firstMonth.days.length > 0, `Month folder contains ${firstMonth.days.length} day list(s)`);
            const firstDay = firstMonth.days[0];
            assert(firstDay.dayLabel && Array.isArray(firstDay.invoices), `Day folder has label: ${firstDay.dayLabel} with ${firstDay.invoices.length} invoice(s)`);
            const firstInv = firstDay.invoices[0];
            assert(firstInv.id && firstInv.order_number && Array.isArray(firstInv.items), `Invoice has order_number: ${firstInv.order_number} and items`);
        }

        // Test 2: Invoice Details Lookup
        console.log('\n--- 2. Testing GET /api/returns/invoice/:id ---');
        const [anyOrder] = await pool.query("SELECT id, order_number FROM orders WHERE branch_id = 2 ORDER BY id ASC LIMIT 1");
        if (anyOrder.length > 0) {
            const targetOrder = anyOrder[0];
            let invDetails = null;
            const mockReqInv = {
                params: { id: targetOrder.order_number },
                user: { role: 'ADMIN' },
                branchId: 2
            };
            const mockResInv = {
                json(data) { invDetails = data; },
                status(code) { return this; }
            };
            await returnsController.getInvoiceDetails(mockReqInv, mockResInv, (err) => { throw err; });
            assert(invDetails && invDetails.success === true, `Invoice lookup by order_number (${targetOrder.order_number}) succeeds`);
            assert(invDetails.invoice && invDetails.invoice.items.length > 0, 'Invoice contains items list');
        }

        // Test 3: Process Return with Transaction, Inventory Restock, and Debt deduction
        console.log('\n--- 3. Testing POST /api/returns/process ---');
        // Let's create a test order in branch 2 to safely process returns against
        const testOrderConn = await pool.getConnection();
        await testOrderConn.beginTransaction();

        // Find a test product and warehouse in branch 2
        const [prods] = await testOrderConn.query("SELECT id, name, price, quantity FROM products WHERE is_deleted = 0 LIMIT 1");
        const [whs] = await testOrderConn.query("SELECT id FROM warehouses WHERE branch_id = 2 LIMIT 1");
        const [pharms] = await testOrderConn.query("SELECT id, name, total_debt FROM pharmacies WHERE branch_id = 2 LIMIT 1");

        const testProd = prods[0];
        const testWh = whs[0];
        const testPharm = pharms[0];

        const initialProductQty = parseInt(testProd.quantity || 0, 10);
        const initialPharmDebt = parseFloat(testPharm.total_debt || 0);

        // Record 1 batch in warehouse_inventory if not present
        const [batchRows] = await testOrderConn.query(
            "SELECT id, current_stock FROM warehouse_inventory WHERE product_id = $1 AND warehouse_id = $2 AND branch_id = 2 LIMIT 1",
            [testProd.id, testWh.id]
        );
        let batchId;
        if (batchRows.length > 0) {
            batchId = batchRows[0].id;
        } else {
            const [newBatch] = await testOrderConn.query(
                "INSERT INTO warehouse_inventory (product_id, warehouse_id, branch_id, current_stock) VALUES ($1, $2, 2, 50) RETURNING id",
                [testProd.id, testWh.id]
            );
            batchId = newBatch[0].id;
        }

        const [initialBatchStockRows] = await testOrderConn.query(
            "SELECT current_stock FROM warehouse_inventory WHERE id = $1", [batchId]
        );
        const initialBatchStock = parseInt(initialBatchStockRows[0].current_stock, 10);

        // Create test order
        const [orderInsert] = await testOrderConn.query(
            "INSERT INTO orders (order_number, pharmacy_id, warehouse_id, total_amount, status, branch_id, created_at) VALUES ('#ORD-TEST-RET-01', $1, $2, 200.00, 'Dispatched', 2, NOW()) RETURNING id",
            [testPharm.id, testWh.id]
        );
        const testOrderId = orderInsert[0].id;

        // Add 2 items to test order
        const [oiInsert] = await testOrderConn.query(
            "INSERT INTO order_items (order_id, product_id, warehouse_id, inventory_id, qty, returned_qty, base_price, unit_price, subtotal, branch_id) VALUES ($1, $2, $3, $4, 4, 0, 20.00, 50.00, 200.00, 2) RETURNING id",
            [testOrderId, testProd.id, testWh.id, batchId]
        );
        const testOrderItemId = oiInsert[0].id;

        // Set customer debt
        await testOrderConn.query("UPDATE pharmacies SET total_debt = total_debt + 200.00 WHERE id = $1", [testPharm.id]);

        await testOrderConn.commit();
        testOrderConn.release();

        console.log(`     Created test order #${testOrderId} (#ORD-TEST-RET-01) with 4 units of product #${testProd.id}`);

        // Try returning 10 units (which exceeds 4!) -> Should fail with 400
        let overReturnFailed = false;
        const mockReqOver = {
            user: { id: 1, role: 'ADMIN' },
            branchId: 2,
            body: {
                original_invoice_id: '#ORD-TEST-RET-01',
                branch_id: 2,
                items: [{ product_id: testProd.id, item_id: testOrderItemId, return_qty: 10 }]
            }
        };
        const mockResOver = {
            status(code) {
                if (code === 400) overReturnFailed = true;
                return this;
            },
            json(d) { /* ignore */ }
        };
        await returnsController.processReturn(mockReqOver, mockResOver, (err) => { overReturnFailed = true; });
        assert(overReturnFailed, 'Validation: Prevents returning quantity exceeding originally sold units (10 > 4)');

        // Now return valid quantity: 2 units
        let returnSuccessData = null;
        const mockReqValid = {
            user: { id: 1, role: 'ADMIN' },
            branchId: 2,
            body: {
                original_invoice_id: '#ORD-TEST-RET-01',
                branch_id: 2,
                items: [{ product_id: testProd.id, item_id: testOrderItemId, batch_id: batchId, return_qty: 2 }]
            }
        };
        const mockResValid = {
            status(code) { return this; },
            json(d) { returnSuccessData = d; }
        };
        await returnsController.processReturn(mockReqValid, mockResValid, (err) => { throw err; });

        assert(returnSuccessData && returnSuccessData.success === true, 'processReturn successfully returned 2 units');
        assert(returnSuccessData.total_refund === 100, `Total refund is 2 * $50 = $100 (got $${returnSuccessData.total_refund})`);

        // Check Inventory Restock in warehouse_inventory
        const [updatedBatch] = await pool.query("SELECT current_stock FROM warehouse_inventory WHERE id = $1", [batchId]);
        const newBatchStock = parseInt(updatedBatch[0].current_stock, 10);
        assert(newBatchStock === initialBatchStock + 2, `warehouse_inventory restocked: ${initialBatchStock} -> ${newBatchStock}`);

        // Check Inventory Restock in products table
        const [updatedProd] = await pool.query("SELECT quantity FROM products WHERE id = $1", [testProd.id]);
        const newProdQty = parseInt(updatedProd[0].quantity || 0, 10);
        assert(newProdQty === initialProductQty + 2, `products table restocked: ${initialProductQty} -> ${newProdQty}`);

        // Check return record in `returns` and `return_items`
        const [retRecord] = await pool.query("SELECT * FROM returns WHERE id = $1", [returnSuccessData.return_id]);
        assert(retRecord.length > 0 && parseFloat(retRecord[0].total_amount) === 100, 'returns table has matching voucher record with total_amount = 100');
        const [retItems] = await pool.query("SELECT * FROM return_items WHERE return_id = $1", [returnSuccessData.return_id]);
        assert(retItems.length > 0 && retItems[0].qty === 2 && parseFloat(retItems[0].total) === 100, 'return_items table has matching item row');

        // Check customer debt deduction in pharmacies and client_transactions
        const [updatedPharm] = await pool.query("SELECT total_debt FROM pharmacies WHERE id = $1", [testPharm.id]);
        const expectedDebt = initialPharmDebt + 200 - 100;
        assert(Math.abs(parseFloat(updatedPharm[0].total_debt) - expectedDebt) < 0.01, `Customer ledger: total debt deducted by $100 (${updatedPharm[0].total_debt} vs expected ${expectedDebt})`);

        const [clientTx] = await pool.query("SELECT * FROM client_transactions WHERE pharmacy_id = $1 AND type = 'RETURN' ORDER BY id DESC LIMIT 1", [testPharm.id]);
        assert(clientTx.length > 0 && parseFloat(clientTx[0].amount) === -100, 'client_transactions recorded RETURN ledger entry with amount -100');

        // Test 4: Analytics Deduction Verification
        console.log('\n--- 4. Testing Analytics Real-time Returns Deduction ---');
        let summaryResult = null;
        const mockReqAnalytics = {
            user: { role: 'ADMIN' },
            branchId: 2,
            query: { period: 'this_month', branch_id: '2' }
        };
        const mockResAnalytics = {
            json(d) { summaryResult = d; },
            status(code) { return this; }
        };
        await analyticsController.getSummary(mockReqAnalytics, mockResAnalytics, (err) => { throw err; });
        assert(summaryResult && typeof summaryResult.total_sales.value === 'number', 'analytics getSummary returned successfully with total_sales');

        let topProdsResult = null;
        const mockResTop = {
            json(d) { topProdsResult = d; },
            status(code) { return this; }
        };
        await analyticsController.getTopProducts(mockReqAnalytics, mockResTop, (err) => { throw err; });
        assert(topProdsResult && Array.isArray(topProdsResult.products), 'analytics getTopProducts returned top products array with net units and revenue');

        // Clean up test order
        await pool.query("DELETE FROM return_items WHERE return_id = $1", [returnSuccessData.return_id]);
        await pool.query("DELETE FROM returns WHERE id = $1", [returnSuccessData.return_id]);
        await pool.query("DELETE FROM client_transactions WHERE id = $1", [clientTx[0].id]);
        await pool.query("DELETE FROM order_items WHERE order_id = $1", [testOrderId]);
        await pool.query("DELETE FROM orders WHERE id = $1", [testOrderId]);
        await pool.query("UPDATE pharmacies SET total_debt = $1 WHERE id = $2", [initialPharmDebt, testPharm.id]);
        await pool.query("UPDATE products SET quantity = $1 WHERE id = $2", [initialProductQty, testProd.id]);
        await pool.query("UPDATE warehouse_inventory SET current_stock = $1 WHERE id = $2", [initialBatchStock, batchId]);

        console.log('\n========================================');
        console.log(`Results: ${passed} Passed, ${failed} Failed`);
        console.log('========================================');
        process.exit(failed > 0 ? 1 : 0);

    } catch (err) {
        console.error('❌ Test execution error:', err);
        process.exit(1);
    }
}

runTests();
