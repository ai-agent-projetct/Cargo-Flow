const express = require('express');
const router = express.Router();
const c = require('../controllers/configController');
const { authenticate: auth } = require('../middleware/auth');
const { requireAccess, attachPermissions } = require('../middleware/permissions');

router.use(auth, attachPermissions);

// Chart of accounts, tax rates and the rest are configuration, not data:
// changing them re-prices every future document, so they follow Settings.
const readCfg = requireAccess('app.settings', { action: 'read' });
const writeCfg = requireAccess('app.settings', { action: 'write' });

router.get('/', c.list);
router.get('/:id', readCfg, c.getAll);
router.post('/:id', writeCfg, c.create);
router.get('/:id/:recordId', readCfg, c.getById);
router.put('/:id/:recordId', writeCfg, c.update);
router.delete('/:id/:recordId', writeCfg, c.remove);

module.exports = router;
