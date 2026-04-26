const express = require('express');
const router = express.Router();
const { getClients, getOrders, getOrderItems, getCostPrice, createOrder, dispatchOrder, processReturn, cancelOrder } = require('../controllers/orderController');

// Client related
router.get('/clients', getClients);

// Product cost-price lookup (must be before /:id routes)
router.get('/product/:id/cost-price', getCostPrice);

// Order CRUD
router.get('/', getOrders);
router.get('/:id/items', getOrderItems);
router.post('/', createOrder);
router.put('/:id/dispatch', dispatchOrder);
router.put('/:id/cancel', cancelOrder);
router.post('/:id/return', processReturn);

module.exports = router;
