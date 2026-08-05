const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { authenticate, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

router.use(authenticate);

router.get('/', documentController.getAll);
router.get('/:id', documentController.getById);
router.get('/:id/download', documentController.download);

router.post('/', (req, res, next) => {
  req.uploadSubDir = 'documents';
  next();
}, upload.single('file'), documentController.upload);

router.put('/:id', documentController.update);
router.delete('/:id', documentController.delete);

module.exports = router;
