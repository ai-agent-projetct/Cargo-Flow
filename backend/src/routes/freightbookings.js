const express = require('express');
const router = express.Router();
const c = require('../controllers/freightBookingController');
const { authenticate: auth } = require('../middleware/auth');

router.get('/facets', auth, c.getFacets);

router.get('/', auth, c.getAll);
router.post('/', auth, c.create);
router.get('/:id', auth, c.getById);
router.put('/:id', auth, c.update);
router.delete('/:id', auth, c.remove);

// AIR workflow
router.post('/:id/direct-book', auth, c.directBook);
router.post('/:id/book-now', auth, c.bookNow);
router.post('/:id/check-status', auth, c.checkStatusAir);
router.post('/:id/cancel', auth, c.cancelBookingAir);
router.post('/:id/house-shipment', auth, c.createHouseShipment);
router.post('/:id/master-shipment', auth, c.createMasterShipment);

// SEA workflow
router.post('/:id/book', auth, c.book);
router.post('/:id/check-status-sea', auth, c.checkStatusSea);
router.post('/:id/update-booking', auth, c.updateBooking);
router.post('/:id/cancel-sea', auth, c.cancelBookingSea);
router.post('/:id/amend', auth, c.amendDetails);

// Rates
router.post('/:id/search-freight', auth, c.searchFreight);
router.post('/:id/select-flight', auth, c.selectFlight);

router.post('/:id/activity', auth, c.addActivity);

module.exports = router;
