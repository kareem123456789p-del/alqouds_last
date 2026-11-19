const express = require('express');
const router = express.Router();
const { checkPermission } = require('../controllers/authController');
const {
    getStats,
    getWarehouses,
    getWarehouseInventory,
    getMovements,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse
} = require('../controllers/warehouseController');

// Read-only routes (no special permission needed beyond auth+branchScope)
router.get('/stats', getStats);
router.get('/list', getWarehouses);
router.get('/movements', getMovements);
router.get('/:id/inventory', getWarehouseInventory);

// Write routes protected by RBAC permissions
router.post('/', checkPermission('MANAGE_WAREHOUSES_ADD'), createWarehouse);
router.put('/:id', checkPermission('MANAGE_WAREHOUSES_EDIT'), updateWarehouse);
router.delete('/:id', checkPermission('MANAGE_WAREHOUSES_DELETE'), deleteWarehouse);

module.exports = router;
