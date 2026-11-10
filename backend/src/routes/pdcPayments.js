const express = require('express');
const router = express.Router();
const c = require('../controllers/pdcPaymentController');
const { authenticate: auth } = require('../middleware/auth');
const { requireAccess, attachPermissions } = require('../middleware/permissions');
const { attachCompanyScope } = require('../middleware/companyScope');

router.use(auth, attachPermissions, attachCompanyScope);

// Declared before `/:id` so "maturity" is never read as an id.
router.get('/maturity', requireAccess('pdc.payment', { action: 'read' }), c.maturitySchedule);

router.get('/', requireAccess('pdc.payment', { action: 'read' }), c.getAll);
router.post('/', requireAccess('pdc.payment', { action: 'create' }), c.create);
router.get('/:id', requireAccess('pdc.payment', { action: 'read' }), c.getById);
router.put('/:id', requireAccess('pdc.payment', { action: 'write' }), c.update);
router.delete('/:id', requireAccess('pdc.payment', { action: 'delete' }), c.remove);

router.post('/:id/deposit', requireAccess('pdc.payment', { action: 'write' }), c.deposit);
// Clearing posts an AccountPayment, so it needs create rights there too.
router.post(
  '/:id/clear',
  requireAccess('pdc.payment', { action: 'write' }),
  requireAccess('account.payment', { action: 'create' }),
  c.markCleared,
);
router.post('/:id/bounce', requireAccess('pdc.payment', { action: 'write' }), c.markBounced);
router.post('/:id/return', requireAccess('pdc.payment', { action: 'write' }), c.markReturned);
router.post('/:id/reopen', requireAccess('pdc.payment', { action: 'write' }), c.reopen);

module.exports = router;
