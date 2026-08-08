const express = require('express');
const router = express.Router();
const c = require('../controllers/accountJournalController');
const { authenticate: auth } = require('../middleware/auth');

router.get('/dashboard', auth, c.dashboard);
router.get('/', auth, c.getAll);
router.post('/', auth, c.create);
router.get('/:id', auth, c.getById);
router.put('/:id', auth, c.update);
router.post('/:id/connect', auth, c.connect);
router.post('/:id/reconcile', auth, c.reconcile);

module.exports = router;
