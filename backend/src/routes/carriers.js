const express = require('express');
const router = express.Router();
const carrierController = require('../controllers/carrierController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', carrierController.getAll);
router.get('/:id', carrierController.getById);
router.get('/:id/schedules', carrierController.getSchedules);
router.post('/', authorize('admin', 'manager'), carrierController.create);
router.put('/:id', authorize('admin', 'manager'), carrierController.update);
router.delete('/:id', authorize('admin'), carrierController.delete);

module.exports = router;
