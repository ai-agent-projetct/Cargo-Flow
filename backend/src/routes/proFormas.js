const express = require('express');
const router = express.Router();
const c = require('../controllers/proFormaController');
const { authenticate: auth } = require('../middleware/auth');
const { requireAccess, attachPermissions } = require('../middleware/permissions');

router.use(auth, attachPermissions);

router.get('/facets', c.getFacets);

router.get('/', requireAccess('pro.forma.invoice', { action: 'read' }), c.getAll);
router.post('/', requireAccess('pro.forma.invoice', { action: 'create' }), c.create);
router.get('/:id', requireAccess('pro.forma.invoice', { action: 'read' }), c.getById);
router.put('/:id', requireAccess('pro.forma.invoice', { action: 'write' }), c.update);
router.delete('/:id', requireAccess('pro.forma.invoice', { action: 'delete' }), c.remove);

router.post('/:id/approve', requireAccess('pro.forma.invoice', { action: 'write' }), c.approve);
// Turning a pro forma into a real invoice needs create rights on the invoice too.
router.post('/:id/create-invoice',
  requireAccess('pro.forma.invoice', { action: 'write' }),
  requireAccess('invoice', { action: 'create' }),
  c.createInvoice);
router.post('/:id/cancel', requireAccess('pro.forma.invoice', { action: 'write' }), c.cancel);
router.post('/:id/reset-to-draft', requireAccess('pro.forma.invoice', { action: 'write' }), c.resetToDraft);
router.post('/:id/activity', c.addActivity);

module.exports = router;
