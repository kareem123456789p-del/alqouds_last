const express = require('express');
const router = express.Router();
const {
    getStats,
    getWarehouses,
    getWarehouseInventory,
    getMovements,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse
} = require('../controllers/warehouseController');

router.get('/stats', getStats);
router.get('/list', getWarehouses);
router.get('/movements', getMovements);
router.get('/:id/inventory', getWarehouseInventory);

router.post('/', createWarehouse);
router.put('/:id', updateWarehouse);
router.delete('/:id', deleteWarehouse);

module.exports = router;
