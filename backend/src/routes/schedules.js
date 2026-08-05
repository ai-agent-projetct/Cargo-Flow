const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', scheduleController.getAll);
router.get('/search', scheduleController.search);
router.get('/:id', scheduleController.getById);
router.post('/', authorize('admin', 'manager'), scheduleController.create);
router.put('/:id', authorize('admin', 'manager'), scheduleController.update);
router.delete('/:id', authorize('admin', 'manager'), scheduleController.delete);

module.exports = router;
