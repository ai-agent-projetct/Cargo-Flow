const express = require('express');
const router = express.Router();
const trackingController = require('../controllers/trackingController');
const { authenticate, authorize } = require('../middleware/auth');

// Public tracking endpoint (no auth required)
router.get('/public/:shipmentNumber', trackingController.getPublicTracking);

router.use(authenticate);

router.get('/shipment/:shipmentId', trackingController.getByShipment);
router.post('/shipment/:shipmentId', trackingController.addEvent);
router.put('/:id', trackingController.updateEvent);
router.delete('/:id', authorize('admin', 'manager'), trackingController.deleteEvent);

module.exports = router;
