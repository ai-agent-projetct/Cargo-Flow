const express = require('express');
const router = express.Router();
const tariffController = require('../controllers/tariffController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', tariffController.getAll);
router.get('/:id', tariffController.getById);
router.post('/', authorize('admin'), tariffController.create);
router.put('/:id', authorize('admin'), tariffController.update);
router.delete('/:id', authorize('admin'), tariffController.delete);
router.post('/:id/charges/remove-all', authorize('admin'), tariffController.removeAllCharges);
router.post('/:id/charges/upload', authorize('admin'), tariffController.uploadCharges);

module.exports = router;
