const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', customerController.getAll);
router.get('/:id', customerController.getById);
router.post('/', customerController.create);
router.put('/:id', customerController.update);
router.delete('/:id', authorize('admin', 'manager'), customerController.delete);
router.get('/:id/shipments', customerController.getShipments);
router.get('/:id/invoices', customerController.getInvoices);
router.get('/:id/quotations', customerController.getQuotations);

module.exports = router;
