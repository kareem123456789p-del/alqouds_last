const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const { checkPermission } = require('../controllers/authController');

// GET all doctors (read-only, no permission needed)
router.get('/', doctorController.getAllDoctors);

// GET single doctor by ID (read-only)
router.get('/:id', doctorController.getDoctorById);

// GET doctor transactions (full ledger for modal)
router.get('/:id/transactions', doctorController.getDoctorTransactions);

// POST create new doctor — requires ADMIN or CREATE_DOCTOR
router.post('/', checkPermission('CREATE_DOCTOR'), doctorController.createDoctor);

// PUT update doctor — requires ADMIN or EDIT_DOCTOR
router.put('/:id', checkPermission('EDIT_DOCTOR'), doctorController.updateDoctor);

// GET doctor's orders (for profile panel)
router.get('/:id/orders', doctorController.getDoctorOrders);

// DELETE doctor — requires ADMIN or DELETE_DOCTOR
router.delete('/:id', checkPermission('DELETE_DOCTOR'), doctorController.deleteDoctor);

module.exports = router;
