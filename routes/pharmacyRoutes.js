const express = require('express');
const router = express.Router();
const { getPharmacies, getPharmacyById, createPharmacy, updatePharmacy, deletePharmacy } = require('../controllers/pharmacyController');

router.get('/', getPharmacies);
router.get('/:id', getPharmacyById);
router.post('/', createPharmacy);
router.put('/:id', updatePharmacy);
router.delete('/:id', deletePharmacy);

module.exports = router;
