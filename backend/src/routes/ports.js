const express = require('express');
const router = express.Router();
const portController = require('../controllers/portController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', portController.getAll);
router.get('/countries', portController.getCountries);
router.get('/:id', portController.getById);
router.post('/', authorize('admin', 'manager'), portController.create);
router.put('/:id', authorize('admin', 'manager'), portController.update);
router.delete('/:id', authorize('admin'), portController.delete);

module.exports = router;
