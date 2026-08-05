const express = require('express');
const router = express.Router();
const freightBookingController = require('../controllers/freightBookingController');
const { authenticate: auth } = require('../middleware/auth');

router.get('/stats', auth, freightBookingController.getStats);
router.get('/', auth, freightBookingController.getAll);
router.get('/:id', auth, freightBookingController.getById);
router.post('/', auth, freightBookingController.create);
router.put('/:id', auth, freightBookingController.update);
router.post('/:id/submit', auth, freightBookingController.submit);
router.post('/:id/confirm', auth, freightBookingController.confirm);
router.post('/:id/cancel', auth, freightBookingController.cancel);
router.delete('/:id', auth, freightBookingController.delete);

module.exports = router;

