const express = require('express');
const router = express.Router();
const cfsTariffController = require('../controllers/cfsTariffController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', cfsTariffController.getAll);
router.get('/:id', cfsTariffController.getById);
router.post('/', authorize('admin'), cfsTariffController.create);
router.put('/:id', authorize('admin'), cfsTariffController.update);
router.delete('/:id', authorize('admin'), cfsTariffController.delete);

module.exports = router;
