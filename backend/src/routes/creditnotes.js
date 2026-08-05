const express = require('express');
const router = express.Router();
const creditNoteController = require('../controllers/creditNoteController');
const { authenticate: auth } = require('../middleware/auth');

router.get('/stats', auth, creditNoteController.getStats);
router.get('/user', auth, creditNoteController.getUserCreditNotes);
router.get('/', auth, creditNoteController.getAll);
router.get('/:id', auth, creditNoteController.getById);
router.post('/', auth, creditNoteController.create);
router.put('/:id', auth, creditNoteController.update);
router.post('/:id/post', auth, creditNoteController.post);
router.post('/:id/issue', auth, creditNoteController.issue);
router.post('/:id/apply', auth, creditNoteController.apply);
router.post('/:id/cancel', auth, creditNoteController.cancel);
router.delete('/:id', auth, creditNoteController.delete);

module.exports = router;

