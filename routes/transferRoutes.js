const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const {
    createTransfer,
    getTransfers,
    updateStatus,
    getAuditLogs
} = require('../controllers/transferController');

// ── Warehouse list for Transfer Console (Step 1 + Step 3 dropdowns) ──
// GET /api/transfers/warehouses
router.get('/warehouses', async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT 
                w.id,
                w.name,
                w.location,
                w.capacity,
                COALESCE(SUM(CASE WHEN p.is_active = 1 AND p.is_deleted = 0 THEN wi.current_stock ELSE 0 END), 0) AS total_stock,
                COUNT(DISTINCT CASE WHEN p.is_active = 1 AND p.is_deleted = 0 THEN wi.product_id END) AS product_count
            FROM warehouses w
            LEFT JOIN warehouse_inventory wi ON wi.warehouse_id = w.id AND wi.branch_id = ?
            LEFT JOIN products p ON wi.product_id = p.id
            WHERE w.branch_id = ?
            GROUP BY w.id, w.name, w.location, w.capacity
            ORDER BY w.id
        `, [req.branchId, req.branchId]);
        res.json(rows);
    } catch (err) {
        console.error('Error loading warehouses for transfer:', err);
        res.status(500).json({ error: 'Failed to load warehouses', details: err.message });
    }
});

// ── Products in a specific warehouse (Step 2 items table) ──
// GET /api/transfers/products/:warehouseId
router.get('/products/:warehouseId', async (req, res) => {
    const { warehouseId } = req.params;
    try {
        const [rows] = await pool.execute(`
            SELECT 
                p.id,
                p.name,
                p.sku,
                wi.current_stock AS available_qty
            FROM warehouse_inventory wi
            JOIN products p ON p.id = wi.product_id
            WHERE wi.warehouse_id = ? 
              AND wi.branch_id = ?
              AND wi.current_stock > 0
              AND p.is_active = 1 
              AND p.is_deleted = 0
            ORDER BY p.name
        `, [warehouseId, req.branchId]);
        res.json(rows);
    } catch (err) {
        console.error('Error loading products for transfer:', err);
        res.status(500).json({ error: 'Failed to load products', details: err.message });
    }
});

router.post('/', createTransfer);
router.get('/', getTransfers);
router.patch('/:id/status', updateStatus);
router.get('/audit-logs', getAuditLogs);

module.exports = router;
