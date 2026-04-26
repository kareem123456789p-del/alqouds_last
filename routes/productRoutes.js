const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

router.get('/',      productController.getAllProducts);
router.post('/',     productController.createProduct);
router.put('/:id',   productController.updateProduct);

/**
 * DELETE /api/products/:id is DISABLED.
 * All product deactivation must go through DELETE /api/inventory/:id
 * (inventoryController.deleteInventoryRecord) which is the single
 * source of truth and implements the safe soft-delete pattern.
 */
router.delete('/:id', (req, res) => {
    res.status(405).json({
        error: 'Method Not Allowed',
        message: 'Product deletion must be performed via the Inventory page (DELETE /api/inventory/:id).'
    });
});

module.exports = router;