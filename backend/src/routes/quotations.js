const express = require('express');
const router = express.Router();
const quotationController = require('../controllers/quotationController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', quotationController.getAll);
router.get('/:id', quotationController.getById);
router.post('/', quotationController.create);
router.put('/:id', quotationController.update);
router.delete('/:id', authorize('admin', 'manager'), quotationController.delete);
router.patch('/:id/status', quotationController.updateStatus);
router.post('/:id/send', quotationController.send);
// Approve / Reject / Cancel and the conversions had controller methods and
// front-end buttons but were never routed, so every one of those buttons
// failed with a 404.
router.post('/:id/approve', quotationController.approve);
router.post('/:id/reject', quotationController.reject);
router.post('/:id/cancel', quotationController.cancel);
router.post('/:id/convert', authorize('admin', 'manager'), quotationController.convertToShipment);
router.post('/:id/convert-to-ffjob', authorize('admin', 'manager'), quotationController.convertToFFJob);
router.post('/:id/convert-to-service-job', authorize('admin', 'manager'), quotationController.convertToServiceJob);
router.post('/:id/duplicate', quotationController.duplicate);

module.exports = router;
