const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', companyController.getAll);
router.get('/:id', companyController.getById);
router.post('/', authorize('admin'), companyController.create);
router.put('/:id', authorize('admin'), companyController.update);
router.delete('/:id', authorize('admin'), companyController.delete);

module.exports = router;
