const express = require('express');
const router = express.Router();
const shipmentSharingController = require('../controllers/shipmentSharingController');
const { authenticate: auth } = require('../middleware/auth');

router.get('/stats', auth, shipmentSharingController.getStats);
router.get('/', auth, shipmentSharingController.getAll);
router.get('/:id', auth, shipmentSharingController.getById);
router.post('/', auth, shipmentSharingController.create);
router.put('/:id', auth, shipmentSharingController.update);
router.patch('/:id/status', auth, shipmentSharingController.updateStatus);
router.patch('/:id/convert', auth, shipmentSharingController.convert);
router.delete('/:id', auth, shipmentSharingController.delete);

module.exports = router;
