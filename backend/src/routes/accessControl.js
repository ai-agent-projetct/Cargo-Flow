const express = require('express');
const router = express.Router();
const c = require('../controllers/accessControlController');
const { authenticate: auth } = require('../middleware/auth');
const { requireAccess } = require('../middleware/permissions');

// Any signed-in user may read their own permissions.
router.get('/me', auth, c.me);

// Managing access itself requires the Settings/Access Rights ACL.
router.get('/groups', auth, requireAccess('app.settings', { action: 'read' }), c.listGroups);
router.get('/matrix', auth, requireAccess('app.settings', { action: 'read' }), c.matrix);
router.put('/rules/:id', auth, requireAccess('app.settings', { action: 'write' }), c.updateRule);
router.get('/users', auth, requireAccess('app.settings', { action: 'read' }), c.listUsersWithGroups);
router.get('/users/:userId/groups', auth, requireAccess('app.settings', { action: 'read' }), c.userGroups);
router.put('/users/:userId/groups', auth, requireAccess('app.settings', { action: 'write' }), c.setUserGroups);

module.exports = router;
