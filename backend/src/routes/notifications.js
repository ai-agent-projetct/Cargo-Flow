const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', notificationController.getAll);
router.get('/unread-count', notificationController.getUnreadCount);
router.patch('/:id/read', notificationController.markRead);
router.patch('/mark-all-read', notificationController.markAllRead);
router.delete('/clear-read', notificationController.deleteAll);
router.delete('/:id', notificationController.delete);
router.post('/', authorize('admin'), notificationController.create);

module.exports = router;
