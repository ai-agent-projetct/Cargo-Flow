const express = require('express');
const router = express.Router();
const c = require('../controllers/accountAssetController');
const { authenticate: auth } = require('../middleware/auth');
const { attachPermissions } = require('../middleware/permissions');

router.use(auth, attachPermissions);

router.get('/', c.getAll);
router.post('/', c.create);
router.get('/:id', c.getById);
router.put('/:id', c.update);
router.delete('/:id', c.remove);

router.post('/:id/confirm', c.confirm);
router.post('/:id/pause', c.pause);
router.post('/:id/resume', c.resume);
router.post('/:id/close', c.close);
router.post('/:id/cancel', c.cancel);
router.post('/:id/reset-to-draft', c.resetToDraft);

module.exports = router;
