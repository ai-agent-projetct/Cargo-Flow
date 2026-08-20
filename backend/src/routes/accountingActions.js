const express = require('express');
const router = express.Router();
const c = require('../controllers/accountingActionsController');
const { authenticate: auth } = require('../middleware/auth');
const { requireAccess, attachPermissions } = require('../middleware/permissions');

router.use(auth, attachPermissions);

// Reconciling alters invoice balances and importing raises payments, so both
// need write on the accounting documents. Lock dates are company-wide policy.
router.get('/reconciliation', requireAccess('invoice', { action: 'read' }), c.reconciliation);
router.post('/reconcile', requireAccess('invoice', { action: 'write' }), c.reconcile);
router.get('/lock-dates', requireAccess('app.settings', { action: 'read' }), c.getLockDates);
router.put('/lock-dates', requireAccess('app.settings', { action: 'write' }), c.setLockDates);
router.post('/import-statement', requireAccess('account.payment', { action: 'create' }), c.importStatement);

module.exports = router;
