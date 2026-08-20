const express = require('express');
const router = express.Router();
const c = require('../controllers/accountingReportController');
const { authenticate: auth } = require('../middleware/auth');
const { attachPermissions } = require('../middleware/permissions');
const { attachCompanyScope } = require('../middleware/companyScope');

router.use(auth, attachPermissions, attachCompanyScope);

router.get('/', c.list);
router.get('/:id', c.run);

module.exports = router;
