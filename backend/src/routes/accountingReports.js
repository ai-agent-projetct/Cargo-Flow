const express = require('express');
const router = express.Router();
const c = require('../controllers/accountingReportController');
const { authenticate: auth } = require('../middleware/auth');
const { requireAccess, attachPermissions } = require('../middleware/permissions');
const { attachCompanyScope } = require('../middleware/companyScope');
const { aclFor } = require('../services/reportEngine');

router.use(auth, attachPermissions, attachCompanyScope);

// A report exposes the same figures as the records behind it, so it is gated
// on the model it reads: accounting reports on journal entries, shipment
// reports on house shipments, sales reports on quotations and the CRM. That
// lets an operations user read operations reports without invoice rights.
const requireReportAccess = (req, res, next) =>
  requireAccess(aclFor(req.params.id), { action: 'read' })(req, res, next);

router.get('/', c.list);
router.get('/:id', requireReportAccess, c.run);

module.exports = router;
