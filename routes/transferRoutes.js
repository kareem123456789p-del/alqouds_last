const express = require('express');
const router = express.Router();
const {
    getWarehouses,
    getWarehouseProducts,
    processTransfer,
    getTransferLogs
} = require('../controllers/transferController');

// GET all warehouses (for Step 1 cards)
router.get('/warehouses', getWarehouses);

// GET products available in a specific warehouse (for Step 2 table)
router.get('/products/:warehouseId', getWarehouseProducts);

// POST initiate a transfer (transactional)
router.post('/', processTransfer);

// GET transfer history logs
router.get('/logs', getTransferLogs);

module.exports = router;
