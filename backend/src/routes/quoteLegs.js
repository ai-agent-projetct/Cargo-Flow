const express = require('express');
const router = express.Router();
const c = require('../controllers/quoteLegController');
const { authenticate: auth } = require('../middleware/auth');
const { requireAccess, attachPermissions } = require('../middleware/permissions');
const { attachCompanyScope } = require('../middleware/companyScope');

router.use(auth, attachPermissions, attachCompanyScope);

// Legs belong to a quotation, so they are read and written under it.
router.get('/quotation/:quotationId', requireAccess('quotation', { action: 'read' }), c.getAll);
router.get('/quotation/:quotationId/routing', requireAccess('quotation', { action: 'read' }), c.routing);
router.post('/quotation/:quotationId', requireAccess('quotation', { action: 'write' }), c.create);
router.post('/quotation/:quotationId/enable', requireAccess('quotation', { action: 'write' }), c.enableMultimodal);
router.post('/quotation/:quotationId/reorder', requireAccess('quotation', { action: 'write' }), c.reorder);

router.get('/:id', requireAccess('quotation', { action: 'read' }), c.getById);
router.put('/:id', requireAccess('quotation', { action: 'write' }), c.update);
router.delete('/:id', requireAccess('quotation', { action: 'write' }), c.remove);
router.post('/:id/schedule', requireAccess('quotation', { action: 'write' }), c.attachSchedule);
// Converting a leg creates a house shipment, so it needs create rights there.
router.post(
  '/:id/convert',
  requireAccess('quotation', { action: 'write' }),
  requireAccess('house.shipment', { action: 'create' }),
  c.convertToShipment,
);

module.exports = router;
