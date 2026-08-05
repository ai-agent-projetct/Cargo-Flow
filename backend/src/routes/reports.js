const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('admin', 'manager'));

router.get('/shipments', reportController.getShipmentReport);
router.get('/revenue', reportController.getRevenueReport);
router.get('/quotations', reportController.getQuotationReport);
router.get('/customers', reportController.getCustomerReport);
router.get('/carrier-performance', reportController.getCarrierPerformance);
router.get('/operations', reportController.getOperationsReport);
router.get('/aging', reportController.getAgingReport);

module.exports = router;
