const express = require('express');
const router = express.Router();
const { getAll, getOne, create, update, remove, getHistory } = require('../controllers/supplierController');

router.get('/', getAll);
router.get('/:id', getOne);
router.get('/:id/history', getHistory);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;
