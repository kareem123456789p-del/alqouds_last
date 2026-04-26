const express = require('express');
const router = express.Router();
const importController = require('../controllers/importController');
const upload = require('../config/multer');

router.get('/suppliers', importController.getActiveSuppliers);
router.get('/', importController.getImports);
// invoiceImage is the field name used in the FormData from the frontend
router.post('/', upload.single('invoiceImage'), importController.createImport);
router.post('/:id/return', importController.processImportReturn);

module.exports = router;
