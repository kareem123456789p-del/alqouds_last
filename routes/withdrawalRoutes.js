const express = require('express');
const router = express.Router();
const { getStats, getWithdrawals, createWithdrawal } = require('../controllers/withdrawalController');

router.get('/stats', getStats);
router.get('/', getWithdrawals);
router.post('/', createWithdrawal);

module.exports = router;
