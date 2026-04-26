const express = require('express');
const router = express.Router();
const collectionController = require('../controllers/collectionController');

router.post('/', collectionController.recordPayment);
router.get('/', collectionController.getRecentPayments);
router.get('/summary', collectionController.getSummary);
router.get('/client/:id/monthly', collectionController.getClientMonthly);

module.exports = router;
