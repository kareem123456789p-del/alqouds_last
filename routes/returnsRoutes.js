const express = require('express');
const router = express.Router();
const returnsController = require('../controllers/returnsController');

// GET /api/returns/invoices-tree
router.get('/invoices-tree', returnsController.getInvoicesTree);

// GET /api/returns/invoice/:id
router.get('/invoice/:id', returnsController.getInvoiceDetails);

// POST /api/returns/process
router.post('/process', returnsController.processReturn);

// GET /api/returns/history
router.get('/history', returnsController.getReturnsHistory);

module.exports = router;
