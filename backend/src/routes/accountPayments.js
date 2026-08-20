const express = require('express');
const router = express.Router();
const c = require('../controllers/accountPaymentController');
const { authenticate: auth } = require('../middleware/auth');
const { requireAccess, attachPermissions } = require('../middleware/permissions');
const { attachCompanyScope } = require('../middleware/companyScope');

router.use(auth, attachPermissions, attachCompanyScope);

router.get('/facets', c.getFacets);

router.get('/', requireAccess('account.payment', { action: 'read' }), c.getAll);
router.post('/', requireAccess('account.payment', { action: 'create' }), c.create);
router.get('/:id', requireAccess('account.payment', { action: 'read' }), c.getById);
router.put('/:id', requireAccess('account.payment', { action: 'write' }), c.update);
router.delete('/:id', requireAccess('account.payment', { action: 'delete' }), c.remove);

router.post('/:id/confirm', requireAccess('account.payment', { action: 'write' }), c.confirm);
router.post('/:id/cancel', requireAccess('account.payment', { action: 'write' }), c.cancel);
router.post('/:id/reset-to-draft', requireAccess('account.payment', { action: 'write' }), c.resetToDraft);
router.post('/:id/activity', c.addActivity);

module.exports = router;
