const express = require('express');
const router = express.Router();
const ffJobController = require('../controllers/ffJobController');
const { authenticate: auth } = require('../middleware/auth');

router.get('/stats', auth, ffJobController.getStats);
router.get('/user', auth, ffJobController.getUserJobs);
router.get('/', auth, ffJobController.getAll);
router.get('/:id', auth, ffJobController.getById);
router.post('/', auth, ffJobController.create);
router.put('/:id', auth, ffJobController.update);
router.patch('/:id/status', auth, ffJobController.updateStatus);
router.post('/:id/tracking', auth, ffJobController.addTrackingEvent);
router.get('/:id/tracking', auth, ffJobController.getTracking);
router.post('/:id/documents', auth, ffJobController.addDocument);
router.delete('/:id', auth, ffJobController.delete);

module.exports = router;

