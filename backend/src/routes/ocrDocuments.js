const express = require('express');
const router = express.Router();
const ocrDocumentController = require('../controllers/ocrDocumentController');
const { authenticate: auth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

router.get('/', auth, ocrDocumentController.getAll);
router.get('/:id', auth, ocrDocumentController.getById);

router.post('/', auth, (req, res, next) => {
  req.uploadSubDir = 'ocr';
  next();
}, upload.single('file'), ocrDocumentController.upload);

router.put('/:id', auth, ocrDocumentController.update);
router.delete('/:id', auth, ocrDocumentController.delete);

module.exports = router;
