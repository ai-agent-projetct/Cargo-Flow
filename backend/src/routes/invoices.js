const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', invoiceController.getAll);
router.get('/:id', invoiceController.getById);
router.post('/', invoiceController.create);
router.put('/:id', invoiceController.update);
router.delete('/:id', authorize('admin', 'manager'), invoiceController.delete);
router.post('/:id/send', invoiceController.send);
router.post('/:id/payment', invoiceController.recordPayment);
router.post('/:id/credit-note', authorize('admin', 'manager'), invoiceController.createCreditNote);
router.patch('/:id/status', authorize('admin', 'manager'), invoiceController.updateStatus);

module.exports = router;
