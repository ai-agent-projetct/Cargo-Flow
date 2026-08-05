const express = require('express');
const router = express.Router();
const consolidationController = require('../controllers/consolidationController');
const { authenticate: auth } = require('../middleware/auth');

router.get('/stats', auth, consolidationController.getStats);
router.get('/', auth, consolidationController.getAll);
router.get('/:id', auth, consolidationController.getById);
router.post('/', auth, consolidationController.create);
router.put('/:id', auth, consolidationController.update);
router.patch('/:id/status', auth, consolidationController.updateStatus);
router.delete('/:id', auth, consolidationController.delete);

module.exports = router;
