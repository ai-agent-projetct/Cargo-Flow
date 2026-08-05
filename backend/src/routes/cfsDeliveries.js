const express = require('express');
const router = express.Router();
const cfsDeliveryController = require('../controllers/cfsDeliveryController');
const { authenticate: auth } = require('../middleware/auth');

router.get('/', auth, cfsDeliveryController.getAll);
router.get('/:id', auth, cfsDeliveryController.getById);
router.post('/', auth, cfsDeliveryController.create);
router.put('/:id', auth, cfsDeliveryController.update);
router.patch('/:id/status', auth, cfsDeliveryController.updateStatus);
router.delete('/:id', auth, cfsDeliveryController.delete);

module.exports = router;
