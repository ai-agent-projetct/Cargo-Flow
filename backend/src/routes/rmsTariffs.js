const express = require('express');
const router = express.Router();
const c = require('../controllers/rmsTariffController');
const { authenticate: auth } = require('../middleware/auth');

router.get('/', auth, c.getAll);
router.post('/import', auth, c.importTariffs);
router.get('/:id', auth, c.getById);
router.post('/', auth, c.create);
router.put('/:id', auth, c.update);
router.post('/:id/duplicate', auth, c.duplicate);
router.post('/:id/activity', auth, c.addActivity);
router.delete('/:id', auth, c.remove);

module.exports = router;
