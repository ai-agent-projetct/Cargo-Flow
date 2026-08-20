const express = require('express');
const router = express.Router();
const c = require('../controllers/accountMoveController');
const { authenticate: auth } = require('../middleware/auth');
const { requireAccess, attachPermissions } = require('../middleware/permissions');
const { attachCompanyScope } = require('../middleware/companyScope');

router.use(auth, attachPermissions, attachCompanyScope);

router.get('/facets', c.getFacets);
router.get('/sources', c.allowedSources);

router.get('/', requireAccess('invoice', { action: 'read' }), c.getAll);
router.post('/', requireAccess('invoice', { action: 'create' }), c.create);
router.get('/:id', requireAccess('invoice', { action: 'read' }), c.getById);
router.put('/:id', requireAccess('invoice', { action: 'write' }), c.update);
router.delete('/:id', requireAccess('invoice', { action: 'delete' }), c.remove);

router.post('/:id/confirm', requireAccess('invoice', { action: 'write' }), c.confirm);
router.post('/:id/cancel', requireAccess('invoice', { action: 'write' }), c.cancel);
router.post('/:id/reset-to-draft', requireAccess('invoice', { action: 'write' }), c.resetToDraft);
router.post('/:id/pull-charges', requireAccess('invoice', { action: 'write' }), c.pullCharges);
router.post('/:id/activity', c.addActivity);

module.exports = router;
