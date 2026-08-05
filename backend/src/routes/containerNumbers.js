const express = require('express');
const router = express.Router();
const containerNumberController = require('../controllers/containerNumberController');
const { authenticate: auth } = require('../middleware/auth');

router.get('/', auth, containerNumberController.getAll);
router.post('/', auth, containerNumberController.create);
router.post('/bulk', auth, containerNumberController.bulkCreate);
router.put('/:id', auth, containerNumberController.update);
router.delete('/:id', auth, containerNumberController.delete);

module.exports = router;
