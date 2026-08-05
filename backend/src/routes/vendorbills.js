const express = require('express');
const router = express.Router();
const vendorBillController = require('../controllers/vendorBillController');
const { authenticate: auth } = require('../middleware/auth');

router.get('/stats', auth, vendorBillController.getStats);
router.get('/', auth, vendorBillController.getAll);
router.get('/:id', auth, vendorBillController.getById);
router.post('/', auth, vendorBillController.create);
router.put('/:id', auth, vendorBillController.update);
router.post('/:id/post', auth, vendorBillController.post);
router.post('/:id/pay', auth, vendorBillController.markPaid);
router.post('/:id/cancel', auth, vendorBillController.cancel);
router.delete('/:id', auth, vendorBillController.delete);

module.exports = router;

