const express = require('express');
const router = express.Router();
const { getPharmacies, getPharmacyById, createPharmacy, updatePharmacy, deletePharmacy } = require('../controllers/pharmacyController');
const { checkPermission } = require('../controllers/authController');

// GET routes (read-only, no permission needed)
router.get('/', getPharmacies);
router.get('/:id', getPharmacyById);

// POST create pharmacy — requires ADMIN or CREATE_PHARMACY
router.post('/', checkPermission('CREATE_PHARMACY'), createPharmacy);

// PUT update pharmacy — requires ADMIN or EDIT_PHARMACY
router.put('/:id', checkPermission('EDIT_PHARMACY'), updatePharmacy);

// DELETE pharmacy — requires ADMIN or DELETE_PHARMACY
router.delete('/:id', checkPermission('DELETE_PHARMACY'), deletePharmacy);

module.exports = router;
