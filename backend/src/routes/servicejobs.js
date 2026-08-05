const express = require('express');
const router = express.Router();
const serviceJobController = require('../controllers/serviceJobController');
const { authenticate: auth } = require('../middleware/auth');

router.get('/stats', auth, serviceJobController.getStats);
router.get('/user', auth, serviceJobController.getUserJobs);
router.get('/', auth, serviceJobController.getAll);
router.get('/:id', auth, serviceJobController.getById);
router.post('/', auth, serviceJobController.create);
router.put('/:id', auth, serviceJobController.update);
router.patch('/:id/status', auth, serviceJobController.updateStatus);
router.post('/:id/charges', auth, serviceJobController.addCharge);
router.delete('/:id', auth, serviceJobController.delete);

module.exports = router;

