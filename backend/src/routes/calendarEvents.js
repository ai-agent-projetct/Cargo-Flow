const express = require('express');
const router = express.Router();
const c = require('../controllers/calendarEventController');
const { authenticate: auth } = require('../middleware/auth');

// Static paths first so they aren't shadowed by /:id.
router.get('/picklists', auth, c.getPicklists);
router.get('/people', auth, c.getCalendarPeople);
router.get('/attendees/search', auth, c.searchAttendees);

router.get('/', auth, c.getAll);
router.post('/', auth, c.create);
router.get('/:id', auth, c.getById);
router.put('/:id', auth, c.update);
router.delete('/:id', auth, c.remove);

router.post('/:id/reschedule', auth, c.reschedule);
router.post('/:id/duplicate', auth, c.duplicate);
router.post('/:id/invitations', auth, c.sendInvitations);
router.post('/:id/attendee-status', auth, c.setAttendeeStatus);
router.post('/:id/activity', auth, c.addActivity);
router.get('/:id/document', auth, c.resolveDocument);

module.exports = router;
