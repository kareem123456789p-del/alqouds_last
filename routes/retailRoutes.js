const express = require('express');
const router = express.Router();
const retailController = require('../controllers/retailController');

router.get('/products/search', retailController.searchProducts);
router.get('/shifts/current', retailController.getCurrentShift);
router.post('/shifts/open', retailController.openShift);
router.post('/shifts/close', retailController.closeShift);
router.get('/shifts/:id/report', retailController.getShiftReport);
router.post('/sales', retailController.recordSale);
router.get('/sales/:id', retailController.getSaleInvoice);
router.post('/returns', retailController.processReturn);

// Admin maintenance routes
router.get('/admin/zero-cost-products', retailController.listZeroCostProducts);
router.post('/admin/fix-price', retailController.fixProductPrice);

module.exports = router;
