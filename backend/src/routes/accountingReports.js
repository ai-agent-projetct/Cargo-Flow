const express = require('express');
const router = express.Router();
const c = require('../controllers/accountingReportController');
const { authenticate: auth } = require('../middleware/auth');
const { requireAccess, attachPermissions } = require('../middleware/permissions');
const { attachCompanyScope } = require('../middleware/companyScope');

router.use(auth, attachPermissions, attachCompanyScope);

// A financial report exposes the same figures as the documents behind it,
// so it is gated on the same model rather than left open.
router.get('/', c.list);
router.get('/:id', requireAccess('invoice', { action: 'read' }), c.run);

module.exports = router;
