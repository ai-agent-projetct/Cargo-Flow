const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', departmentController.getAll);
router.get('/:id', departmentController.getById);
router.post('/', authorize('admin'), departmentController.create);
router.put('/:id', authorize('admin'), departmentController.update);
router.delete('/:id', authorize('admin'), departmentController.delete);

module.exports = router;
