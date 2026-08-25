const express = require('express');
const router = express.Router();
const {
    createTransfer,
    getTransfers,
    updateStatus,
    getAuditLogs
} = require('../controllers/transferController');

router.post('/', createTransfer);
router.get('/', getTransfers);
router.patch('/:id/status', updateStatus);
router.get('/audit-logs', getAuditLogs);

module.exports = router;
