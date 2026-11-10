const express = require('express');
const router = express.Router();
const c = require('../controllers/chargeLineController');
const { authenticate: auth } = require('../middleware/auth');
const { requireAccess, attachPermissions } = require('../middleware/permissions');
const { attachCompanyScope } = require('../middleware/companyScope');

router.use(auth, attachPermissions, attachCompanyScope);

// Serves the charge tabs on every record and the six
// Settings > Technical > Charge Lines views, which are filters on
// ?parentType=&side=.
router.get('/', requireAccess('charge.line', { action: 'read' }), c.getAll);
router.get('/cost-sheet', requireAccess('charge.line', { action: 'read' }), c.costSheet);
router.post('/', requireAccess('charge.line', { action: 'create' }), c.create);
router.post('/recalculate', requireAccess('charge.line', { action: 'write' }), c.recalculate);
router.post('/copy-from-quote', requireAccess('charge.line', { action: 'create' }), c.copyFromQuote);
router.get('/:id', requireAccess('charge.line', { action: 'read' }), c.getById);
router.put('/:id', requireAccess('charge.line', { action: 'write' }), c.update);
router.delete('/:id', requireAccess('charge.line', { action: 'delete' }), c.remove);

module.exports = router;
