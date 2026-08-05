const express = require('express');
const router = express.Router();
const organizationController = require('../controllers/organizationController');
const { authenticate: auth } = require('../middleware/auth');

router.get('/', auth, organizationController.getAll);
router.get('/:id', auth, organizationController.getById);
router.get('/:id/workflow', auth, organizationController.workflow);
router.get('/:id/related/:type', auth, organizationController.related);
router.post('/:id/activity', auth, organizationController.addActivity);
router.post('/', auth, organizationController.create);
router.put('/:id', auth, organizationController.update);
router.post('/:id/sync-partner', auth, organizationController.syncPartner);
router.post('/:id/addresses', auth, organizationController.addAddress);
router.delete('/:id', auth, organizationController.remove);

module.exports = router;
