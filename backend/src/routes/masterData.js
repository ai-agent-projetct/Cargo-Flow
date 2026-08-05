const express = require('express');
const router = express.Router();
const masterDataController = require('../controllers/masterDataController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/:category', masterDataController.getAll);
router.get('/:category/:id', masterDataController.getById);
router.post('/:category', authorize('admin'), masterDataController.create);
router.put('/:category/:id', authorize('admin'), masterDataController.update);
router.delete('/:category/:id', authorize('admin'), masterDataController.delete);

module.exports = router;
