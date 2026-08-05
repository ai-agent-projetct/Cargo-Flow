const express = require('express');
const router = express.Router();
const shipmentController = require('../controllers/shipmentController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', shipmentController.getAll);
router.get('/stats', shipmentController.getStats);
router.get('/:id', shipmentController.getById);
router.post('/', shipmentController.create);
router.put('/:id', shipmentController.update);
router.delete('/:id', authorize('admin', 'manager'), shipmentController.delete);
router.patch('/:id/status', shipmentController.updateStatus);
router.patch('/:id/assign', authorize('admin', 'manager'), shipmentController.assign);

module.exports = router;
