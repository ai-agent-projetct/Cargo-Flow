const express = require('express');
const router = express.Router();
const c = require('../controllers/tmsRequestController');
const { authenticate: auth } = require('../middleware/auth');
const { requireAccess, attachPermissions } = require('../middleware/permissions');

// Read-only model: no POST/PUT/DELETE routes exist at all.
router.use(auth, attachPermissions, requireAccess('tms.request', { action: 'read' }));

router.get('/facets', c.getFacets);
router.get('/', c.getAll);
router.get('/:id', c.getById);
router.get('/:id/document', c.resolveDocument);

module.exports = router;
