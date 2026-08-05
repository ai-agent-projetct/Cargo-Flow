const express = require('express');
const router = express.Router();
const rateController = require('../controllers/rateController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', rateController.getAll);
router.get('/search', rateController.search);
router.get('/:id', rateController.getById);
router.post('/', authorize('admin', 'manager'), rateController.create);
router.put('/:id', authorize('admin', 'manager'), rateController.update);
router.delete('/:id', authorize('admin', 'manager'), rateController.delete);

module.exports = router;
