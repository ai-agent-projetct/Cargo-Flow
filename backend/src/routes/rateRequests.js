const express = require('express');
const router = express.Router();
const c = require('../controllers/rateRequestController');
const { authenticate: auth } = require('../middleware/auth');
const { requireAccess, attachPermissions } = require('../middleware/permissions');
const { attachCompanyScope } = require('../middleware/companyScope');

// --- vendor-facing, token authenticated ------------------------------------
// A vendor has no ERP login, so these routes authenticate on the rate
// request's own `accessToken` and are mounted before the `auth` middleware.
// Each token grants access to exactly one request, and the payload is
// deliberately narrow: the vendor never sees our sell rates, margin or
// customer.
router.get('/portal/:token', c.portalGet);
router.post('/portal/:token/submit', c.portalSubmit);
router.post('/portal/:token/decline', c.portalDecline);

// --- staff-facing ----------------------------------------------------------
router.use(auth, attachPermissions, attachCompanyScope);

// The vendor's own overview, for a signed-in portal user scoped to their
// organization.
router.get('/my-requests', c.portalOverview);

router.get('/compare', requireAccess('rate.request', { action: 'read' }), c.compare);
router.get('/', requireAccess('rate.request', { action: 'read' }), c.getAll);
router.post('/', requireAccess('rate.request', { action: 'create' }), c.create);
router.get('/:id', requireAccess('rate.request', { action: 'read' }), c.getById);
router.put('/:id', requireAccess('rate.request', { action: 'write' }), c.update);
router.delete('/:id', requireAccess('rate.request', { action: 'delete' }), c.remove);

router.post('/:id/send', requireAccess('rate.request', { action: 'write' }), c.send);
router.post('/:id/submit-rates', requireAccess('rate.request', { action: 'write' }), c.submitRates);
router.post('/:id/renegotiate', requireAccess('rate.request', { action: 'write' }), c.requestRenegotiation);
router.post('/:id/renegotiate/resolve', requireAccess('rate.request', { action: 'write' }), c.resolveRenegotiation);
// Awarding writes buy rates onto the quotation's charge lines.
router.post(
  '/:id/select',
  requireAccess('rate.request', { action: 'write' }),
  requireAccess('charge.line', { action: 'write' }),
  c.selectRates,
);
router.post('/:id/unselect', requireAccess('rate.request', { action: 'write' }), c.unselectRates);
router.post('/:id/cancel', requireAccess('rate.request', { action: 'write' }), c.cancel);

module.exports = router;
