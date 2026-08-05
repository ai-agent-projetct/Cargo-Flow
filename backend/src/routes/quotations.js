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
router.post('/:id/convert', authorize('admin', 'manager'), quotationController.convertToShipment);
router.post('/:id/duplicate', quotationController.duplicate);

module.exports = router;
