const express = require('express');
const router = express.Router();
const opportunityController = require('../controllers/opportunityController');
const { authenticate: auth } = require('../middleware/auth');

router.get('/kanban', auth, opportunityController.getKanban);
router.get('/stats', auth, opportunityController.getStats);
router.get('/', auth, opportunityController.getAll);
router.get('/:id', auth, opportunityController.getById);
router.post('/', auth, opportunityController.create);
router.put('/:id', auth, opportunityController.update);
router.patch('/:id/stage', auth, opportunityController.updateStage);
router.post('/:id/won', auth, opportunityController.markWon);
router.post('/:id/lost', auth, opportunityController.markLost);
router.delete('/:id', auth, opportunityController.delete);

module.exports = router;

