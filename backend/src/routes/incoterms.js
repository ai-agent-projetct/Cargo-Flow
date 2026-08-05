const express = require('express');
const router = express.Router();
const incotermController = require('../controllers/incotermController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', incotermController.getAll);
router.get('/:id', incotermController.getById);
router.post('/', authorize('admin'), incotermController.create);
router.put('/:id', authorize('admin'), incotermController.update);
router.delete('/:id', authorize('admin'), incotermController.delete);

module.exports = router;
