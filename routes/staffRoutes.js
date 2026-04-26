const express = require('express');
const router = express.Router();
const { getStaff, getStaffById, createStaff, updateStaff, deleteStaff, getStaffStats } = require('../controllers/staffController');

router.get('/stats', getStaffStats);
router.get('/', getStaff);
router.get('/:id', getStaffById);
router.post('/', createStaff);
router.put('/:id', updateStaff);
router.delete('/:id', deleteStaff);

module.exports = router;
