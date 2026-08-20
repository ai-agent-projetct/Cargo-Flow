const express = require('express');
const router = express.Router();
const c = require('../controllers/accountAssetController');
const { authenticate: auth } = require('../middleware/auth');
const { requireAccess, attachPermissions } = require('../middleware/permissions');
const { attachCompanyScope } = require('../middleware/companyScope');

router.use(auth, attachPermissions, attachCompanyScope);

router.get('/', requireAccess('invoice', { action: 'read' }), c.getAll);
router.post('/', requireAccess('invoice', { action: 'create' }), c.create);
router.get('/:id', c.getById);
router.put('/:id', c.update);
router.delete('/:id', c.remove);

router.post('/:id/confirm', c.confirm);
router.post('/:id/pause', c.pause);
router.post('/:id/resume', c.resume);
router.post('/:id/close', c.close);
router.post('/:id/cancel', c.cancel);
router.post('/:id/reset-to-draft', c.resetToDraft);

module.exports = router;
