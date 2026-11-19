const express = require('express');
const router = express.Router();
const collectionController = require('../controllers/collectionController');
const { checkPermission } = require('../controllers/authController');

// All collection routes require ADMIN role or 'can_manage_collections' permission
router.use(checkPermission('can_manage_collections'));

router.post('/', collectionController.recordPayment);
router.get('/', collectionController.getRecentPayments);
router.get('/transactions', collectionController.getRecentPayments);
router.get('/debts', collectionController.getCustomerDebts);
router.get('/summary', collectionController.getSummary);
router.get('/client/:id/monthly', collectionController.getClientMonthly);

module.exports = router;
