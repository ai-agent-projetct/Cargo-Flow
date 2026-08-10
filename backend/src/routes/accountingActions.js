const express = require('express');
const router = express.Router();
const c = require('../controllers/accountingActionsController');
const { authenticate: auth } = require('../middleware/auth');
const { attachPermissions } = require('../middleware/permissions');

router.use(auth, attachPermissions);

router.get('/reconciliation', c.reconciliation);
router.post('/reconcile', c.reconcile);
router.get('/lock-dates', c.getLockDates);
router.put('/lock-dates', c.setLockDates);
router.post('/import-statement', c.importStatement);

module.exports = router;
