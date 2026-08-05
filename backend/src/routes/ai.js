const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticate: auth } = require('../middleware/auth');

router.get('/status', auth, aiController.status);
router.post('/chat', auth, aiController.chat);
router.get('/insights', auth, aiController.insights);
router.get('/insights/:type', auth, aiController.insightsByType);
router.post('/extract-document', auth, aiController.extractDocument);

module.exports = router;
