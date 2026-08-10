const express = require('express');
const router = express.Router();
const c = require('../controllers/configController');
const { authenticate: auth } = require('../middleware/auth');
const { attachPermissions } = require('../middleware/permissions');

router.use(auth, attachPermissions);

router.get('/', c.list);
router.get('/:id', c.getAll);
router.post('/:id', c.create);
router.get('/:id/:recordId', c.getById);
router.put('/:id/:recordId', c.update);
router.delete('/:id/:recordId', c.remove);

module.exports = router;
