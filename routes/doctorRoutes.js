const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');

// GET all doctors
router.get('/', doctorController.getAllDoctors);

// GET single doctor by ID
router.get('/:id', doctorController.getDoctorById);

// POST create new doctor
router.post('/', doctorController.createDoctor);

// PUT update doctor
router.put('/:id', doctorController.updateDoctor);

// DELETE doctor
router.delete('/:id', doctorController.deleteDoctor);

module.exports = router;
