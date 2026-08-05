const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { authenticate: auth } = require('../middleware/auth');

router.get('/entity/:entityType/:entityId', auth, eventController.getByEntity);
router.get('/', auth, eventController.getAll);
router.get('/:id', auth, eventController.getById);
router.post('/', auth, eventController.create);
router.put('/:id', auth, eventController.update);
router.delete('/:id', auth, eventController.delete);

module.exports = router;

