const express = require('express');
const router = express.Router();
const {
    getSummary, getBranches, getBranchPerformance, getSalesPurchasesTimeline,
    getTopProducts, getCategoryDistribution, getCriticalAlerts,
    getSuppliersPayables, processSupplierPayment
} = require('../controllers/analyticsController');
const { checkPermission } = require('../controllers/authController');

// All analytics routes require ADMIN role or 'can_manage_analytics' permission
router.use(checkPermission('can_manage_analytics'));

// GET /api/analytics/summary?period=this_month&branch_id=all
router.get('/summary', getSummary);

// GET /api/analytics/branches — list branches for filter dropdown
router.get('/branches', getBranches);

// GET /api/analytics/branch-performance?period=this_month&branch_id=all
router.get('/branch-performance', getBranchPerformance);

// GET /api/analytics/sales-purchases-timeline?period=this_month&branch_id=all
router.get('/sales-purchases-timeline', getSalesPurchasesTimeline);

// GET /api/analytics/top-products?period=this_month&branch_id=1
router.get('/top-products', getTopProducts);

// GET /api/analytics/category-distribution?period=this_month&branch_id=1
router.get('/category-distribution', getCategoryDistribution);

// GET /api/analytics/critical-alerts?period=this_month&branch_id=1
router.get('/critical-alerts', getCriticalAlerts);

// GET /api/analytics/suppliers-payables?branch_id=1
router.get('/suppliers-payables', getSuppliersPayables);

// POST /api/analytics/suppliers/pay — process supplier payment
router.post('/suppliers/pay', processSupplierPayment);

module.exports = router;
