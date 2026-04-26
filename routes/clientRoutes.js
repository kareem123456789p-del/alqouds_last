const express = require('express');
const router = express.Router();
const { getClientSummary } = require('../controllers/orderController');

// GET /api/clients/:id/summary
router.get('/:id/summary', getClientSummary);

module.exports = router;
