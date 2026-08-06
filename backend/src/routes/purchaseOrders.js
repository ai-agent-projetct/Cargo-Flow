const express = require('express');
const router = express.Router();
const c = require('../controllers/purchaseOrderController');
const { authenticate: auth } = require('../middleware/auth');

router.get('/', auth, c.getAll);
router.post('/', auth, c.create);
router.get('/:id', auth, c.getById);
router.put('/:id', auth, c.update);
router.delete('/:id', auth, c.remove);

router.post('/:id/duplicate', auth, c.duplicate);
router.post('/:id/priority', auth, c.setPriority);
router.post('/:id/activity', auth, c.addActivity);

// Workflow buttons on the form header.
router.post('/:id/send-for-approval', auth, c.sendForApproval);
router.post('/:id/approve', auth, c.approve);
router.post('/:id/reject', auth, c.reject);
router.post('/:id/cancel', auth, c.cancel);
router.post('/:id/vendor-bill', auth, c.createVendorBill);
router.get('/:id/bills', auth, c.getBills);

module.exports = router;
