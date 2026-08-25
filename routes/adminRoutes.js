const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAdmin } = require('../controllers/authController');

router.use(requireAdmin);

router.get('/branches', adminController.getBranches);
router.get('/permissions', adminController.getPermissions);
router.get('/staff', adminController.getStaffList);
router.post('/staff', adminController.createStaff);
router.put('/staff/:id', adminController.updateStaff);

module.exports = router;
