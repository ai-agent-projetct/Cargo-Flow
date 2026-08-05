const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', jobController.getAll);
router.get('/:id', jobController.getById);
router.post('/', jobController.create);
router.put('/:id', jobController.update);
router.delete('/:id', authorize('admin', 'manager'), jobController.delete);
router.patch('/:id/status', jobController.updateStatus);
router.patch('/:id/assign', authorize('admin', 'manager'), jobController.assign);

module.exports = router;
