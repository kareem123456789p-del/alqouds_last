const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');

// Define routes directly
router.get('/', inventoryController.getFullInventory);
router.get('/batches/:warehouseId/:productId', inventoryController.getProductBatches);
router.put('/:id', inventoryController.updateInventoryRecord);
router.delete('/:id', inventoryController.deleteInventoryRecord);

module.exports = router;