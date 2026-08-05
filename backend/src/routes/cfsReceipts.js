const express = require('express');
const router = express.Router();
const cfsReceiptController = require('../controllers/cfsReceiptController');
const { authenticate: auth } = require('../middleware/auth');

router.get('/', auth, cfsReceiptController.getAll);
router.get('/:id', auth, cfsReceiptController.getById);
router.post('/', auth, cfsReceiptController.create);
router.put('/:id', auth, cfsReceiptController.update);
router.patch('/:id/status', auth, cfsReceiptController.updateStatus);
router.delete('/:id', auth, cfsReceiptController.delete);

module.exports = router;
