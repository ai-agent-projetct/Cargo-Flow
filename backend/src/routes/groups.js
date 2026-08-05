const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', groupController.getAll);
router.get('/:id', groupController.getById);
router.post('/', authorize('admin'), groupController.create);
router.put('/:id', authorize('admin'), groupController.update);
router.delete('/:id', authorize('admin'), groupController.delete);
router.post('/:id/users', authorize('admin'), groupController.addUser);
router.delete('/:id/users', authorize('admin'), groupController.removeUser);

module.exports = router;
