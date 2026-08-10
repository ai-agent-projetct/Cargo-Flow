const express = require('express');
const router = express.Router();
const c = require('../controllers/accountingReportController');
const { authenticate: auth } = require('../middleware/auth');
const { attachPermissions } = require('../middleware/permissions');

router.use(auth, attachPermissions);

router.get('/', c.list);
router.get('/:id', c.run);

module.exports = router;
