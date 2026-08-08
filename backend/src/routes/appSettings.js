const express = require('express');
const router = express.Router();
const c = require('../controllers/appSettingController');
const { authenticate: auth } = require('../middleware/auth');

router.get('/', auth, c.getAll);
router.put('/', auth, c.bulkUpdate);
router.post('/:category/:key/toggle', auth, c.toggleIntegration);

module.exports = router;
