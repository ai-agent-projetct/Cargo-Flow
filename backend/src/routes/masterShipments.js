const express = require('express');
const router = express.Router();
const masterShipmentController = require('../controllers/masterShipmentController');
const { authenticate: auth } = require('../middleware/auth');

router.get('/stats', auth, masterShipmentController.getStats);
router.get('/', auth, masterShipmentController.getAll);
router.get('/:id', auth, masterShipmentController.getById);
router.get('/:id/houses', auth, masterShipmentController.getHouses);
router.get('/:id/available-houses', auth, masterShipmentController.getAvailableHouses);
router.post('/:id/attach-houses', auth, masterShipmentController.attachHouses);
router.post('/', auth, masterShipmentController.create);
router.put('/:id', auth, masterShipmentController.update);
router.patch('/:id/status', auth, masterShipmentController.updateStatus);
router.delete('/:id', auth, masterShipmentController.delete);

module.exports = router;
