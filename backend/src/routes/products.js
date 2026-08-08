const express = require('express');
const router = express.Router();
const c = require('../controllers/productController');
const { authenticate: auth } = require('../middleware/auth');
const { requireAccess, attachPermissions } = require('../middleware/permissions');

router.use(auth, attachPermissions);

// The line-editor picker is open to anyone who can edit a document.
router.get('/lookup', c.lookup);
router.get('/facets', c.getFacets);

router.get('/', requireAccess('product', { action: 'read' }), c.getAll);
router.post('/', requireAccess('product', { action: 'create' }), c.create);
router.get('/:id', requireAccess('product', { action: 'read' }), c.getById);
router.put('/:id', requireAccess('product', { action: 'write' }), c.update);
router.delete('/:id', requireAccess('product', { action: 'delete' }), c.remove);

module.exports = router;
