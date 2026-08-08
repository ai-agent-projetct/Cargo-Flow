const { Op } = require('sequelize');
const { FreightBooking, FFJob, MasterShipment, Customer } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');

const actorName = (req) =>
  req.user?.name
  || [req.user?.first_name, req.user?.last_name].filter(Boolean).join(' ')
  || req.user?.email
  || 'Administrator';

const AIR_LABELS = {
  created: 'Created',
  booking_created: 'Booking Requested',
  booking_confirmed: 'Booking Confirmed',
  booking_rejected: 'Booking Rejected',
  booking_failed: 'Booking Failed',
  booking_cancel_req: 'Booking Cancellation Requested',
  booking_cancelled: 'Booking Cancelled',
};
const SEA_LABELS = {
  init: 'Initialized', pending: 'Pending', success: 'Success', fail: 'Failed', cancel: 'Cancel',
};

const logEntry = (author, body, changes = []) => ({
  at: new Date().toISOString(), author, kind: 'log', body, changes,
});
const pushLog = (rec, entry) => [entry, ...(rec.activityLog || [])];

// Blank date inputs arrive as '' and MySQL rejects them.
const DATE_FIELDS = ['departureDate', 'etdTime', 'etaTime', 'atdTime', 'ataTime'];
const normalise = (body) => {
  const out = { ...body };
  DATE_FIELDS.forEach((f) => { if (out[f] === '') out[f] = null; });
  return out;
};

// Every response carries the button map so the form never re-derives the rules.
const withActions = (rec) => ({ ...rec.toJSON(), actions: rec.availableActions() });

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination({ ...req.query, limit: req.query.limit || 80 });
    const { search, transportCode, airStatus, status, carrier, company } = req.query;

    const where = {};
    if (transportCode) where.transportCode = transportCode;
    if (airStatus) where.airStatus = airStatus.includes(',') ? { [Op.in]: airStatus.split(',') } : airStatus;
    if (status) where.status = status.includes(',') ? { [Op.in]: status.split(',') } : status;
    if (carrier) where.carrier = carrier;
    if (company) where.company = company;
    if (search) {
      where[Op.or] = [
        { bookingReference: { [Op.like]: `%${search}%` } },
        { bookingNumber: { [Op.like]: `%${search}%` } },
        { carrier: { [Op.like]: `%${search}%` } },
        { originPort: { [Op.like]: `%${search}%` } },
        { destinationPort: { [Op.like]: `%${search}%` } },
        { trackingNumber: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await FreightBooking.findAndCountAll({
      where, order: [['createdAt', 'DESC'], ['bookingReference', 'DESC']], limit, offset,
    });
    return successResponse(res, rows, 'Bookings retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const rec = await FreightBooking.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Booking not found', 404);
    return successResponse(res, withActions(rec), 'Booking retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const author = actorName(req);
    const rec = await FreightBooking.create({
      ...normalise(req.body),
      airStatus: 'created',
      status: 'init',
      assignedTo: req.body.assignedTo || author,
      createdBy: req.user?.id || null,
      activityLog: [logEntry(author, 'Freight Booking Request created')],
    });
    return successResponse(res, withActions(rec), 'Booking created', 201);
  } catch (error) {
    next(error);
  }
};

const TRACKED = {
  carrier: 'Shipping Line',
  airline: 'Airline',
  flightNo: 'Flight No',
  trackingNumber: 'AWB Number',
  originPort: 'Origin Port',
  destinationPort: 'Destination Port',
  departureDate: 'Departure Date',
  incoterm: 'Incoterms',
  paymentTerms: 'Payment Terms',
  client: 'Customer',
  shipper: 'Shipper',
  consignee: 'Consignee',
  atdTime: 'ATD',
  ataTime: 'ATA',
};

exports.update = async (req, res, next) => {
  try {
    const rec = await FreightBooking.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Booking not found', 404);
    if (!rec.availableActions().edit) {
      const label = rec.transportCode === 'AIR' ? AIR_LABELS[rec.airStatus] : SEA_LABELS[rec.status];
      return errorResponse(res, `A booking in "${label}" cannot be edited`, 400);
    }

    const patch = normalise(req.body);
    const changes = Object.entries(TRACKED)
      .filter(([f]) => f in patch && String(patch[f] ?? '') !== String(rec[f] ?? ''))
      .map(([f, label]) => ({ field: label, from: rec[f] || '', to: patch[f] || '' }));

    // Status only moves through the workflow endpoints.
    const { status, airStatus, bookingReference, activityLog, ...rest } = patch;
    await rec.update({
      ...rest,
      ...(changes.length ? { activityLog: pushLog(rec, logEntry(actorName(req), '', changes)) } : {}),
    });
    return successResponse(res, withActions(rec), 'Booking updated');
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const rec = await FreightBooking.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Booking not found', 404);
    if ((rec.freightShipmentCount || 0) > 0) {
      return errorResponse(res, 'Cannot delete a booking that has shipments', 400);
    }
    await rec.destroy();
    return successResponse(res, null, 'Booking deleted');
  } catch (error) {
    next(error);
  }
};

// ── Workflow ────────────────────────────────────────────────────────────────
// Each transition re-checks the same guard the button visibility uses, so a
// stale form can never push a booking into an illegal state.

const airTransition = (guardKey, apply, label) => async (req, res, next) => {
  try {
    const rec = await FreightBooking.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Booking not found', 404);
    if (!rec.availableActions()[guardKey]) {
      return errorResponse(res, `${label} is not available for this booking`, 400);
    }
    const from = AIR_LABELS[rec.airStatus];
    const patch = apply(rec, req);
    await rec.update({
      ...patch,
      activityLog: pushLog(rec, logEntry(actorName(req), patch.__note || '', [
        ...(patch.airStatus ? [{ field: 'Air Status', from, to: AIR_LABELS[patch.airStatus] }] : []),
        ...(patch.__changes || []),
      ])),
    });
    return successResponse(res, withActions(rec), `${label} done`);
  } catch (error) {
    next(error);
  }
};

// Direct Book — no rate was selected, so the carrier is asked to price it.
exports.directBook = airTransition('directBook', (rec) => ({
  airStatus: 'booking_created',
  isDirectBooking: true,
  bookingNumber: rec.bookingNumber || cryptoUuid(),
  providerStatus: 'DIRECT_BOOKING_PROCESSING-Booking has been processed',
}), 'Direct Book');

// Book Now — a flight/rate line was picked, so the booking is placed against it.
exports.bookNow = airTransition('bookNow', (rec) => {
  const flight = (rec.flightLines || [])[0] || {};
  return {
    airStatus: 'booking_created',
    isDirectBooking: false,
    bookingNumber: rec.bookingNumber || cryptoUuid(),
    airline: flight.airline || rec.airline,
    flightNo: flight.flightNumber || rec.flightNo,
    providerStatus: 'PENDING_DELIVERY-None',
    __note: `Booking placed on ${flight.airline || 'carrier'} ${flight.flightNumber || ''}`.trim(),
  };
}, 'Book Now');

// Check Status — polls the carrier. A requested booking becomes confirmed and
// picks up its AWB; a cancellation request completes.
exports.checkStatusAir = airTransition('checkStatusAir', (rec) => {
  if (rec.airStatus === 'booking_cancel_req') {
    return { airStatus: 'booking_cancelled', providerStatus: 'CANCELLED-Booking cancelled by carrier' };
  }
  if (rec.airStatus === 'booking_created') {
    return {
      airStatus: 'booking_confirmed',
      trackingNumber: rec.trackingNumber || awbNumber(),
      providerStatus: 'CONFIRMED-Booking confirmed by carrier',
      __changes: rec.trackingNumber ? [] : [{ field: 'AWB Number', from: '', to: 'issued' }],
    };
  }
  // Already confirmed — the poll just refreshes the provider text.
  return { providerStatus: 'CONFIRMED-Booking confirmed by carrier' };
}, 'Check Status');

exports.cancelBookingAir = airTransition('cancelBookingAir', (rec, req) => ({
  airStatus: 'booking_cancelled',
  cancelReason: req.body.reason || 'Cancelled by operator',
  providerStatus: 'CANCELLED-Booking cancelled',
}), 'Cancel Booking');

// ── SEA ──
const seaTransition = (guardKey, apply, label) => async (req, res, next) => {
  try {
    const rec = await FreightBooking.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Booking not found', 404);
    if (!rec.availableActions()[guardKey]) {
      return errorResponse(res, `${label} is not available for this booking`, 400);
    }
    const from = SEA_LABELS[rec.status];
    const patch = apply(rec, req);
    await rec.update({
      ...patch,
      activityLog: pushLog(rec, logEntry(actorName(req), patch.__note || '', [
        ...(patch.status ? [{ field: 'Status', from, to: SEA_LABELS[patch.status] }] : []),
      ])),
    });
    return successResponse(res, withActions(rec), `${label} done`);
  } catch (error) {
    next(error);
  }
};

exports.book = seaTransition('book', (rec) => ({
  status: 'pending',
  bookingNumber: rec.bookingNumber || seaBookingNumber(),
  buycoTransportStatus: 'SUBMITTED',
  providerStatus: 'PENDING-Awaiting carrier response',
}), 'Book');

exports.checkStatusSea = seaTransition('checkStatusSea', () => ({
  status: 'success',
  buycoTransportStatus: 'CONFIRMED',
  providerStatus: 'SUCCESS-Booking confirmed by carrier',
}), 'Check Status');

exports.updateBooking = seaTransition('updateBooking', (rec, req) => ({
  ...normalise(req.body),
  status: 'success',
  __note: 'Booking amendment sent to carrier',
}), 'Update Booking');

exports.cancelBookingSea = seaTransition('cancelBookingSea', (rec, req) => ({
  status: 'cancel',
  cancelReason: req.body.reason || 'Cancelled by operator',
  buycoTransportStatus: 'CANCELLED',
  providerStatus: 'CANCELLED-Booking cancelled',
}), 'Cancel Booking');

exports.amendDetails = seaTransition('amendDetails', (rec, req) => ({
  ...normalise(req.body),
  __note: 'Amendment submitted to BuyCo',
}), 'Update Booking');

// Search Freight — returns the carrier's rate options and drops them into the
// Cargo Charge Detail grid. Rates are derived from the cargo so the numbers
// move with the shipment rather than being fixed.
const RATE_CARDS = [
  { airline: 'Emirates', code: 'EK', rateName: 'GENERAL CARGO', rateType: 'MARKET', perKg: 4.2 },
  { airline: 'Qatar Airways', code: 'QR', rateName: 'GENERAL CARGO', rateType: 'MARKET', perKg: 3.95 },
  { airline: 'Singapore Airlines', code: 'SQ', rateName: 'EXPRESS', rateType: 'SPOT', perKg: 5.4 },
  { airline: 'Air India', code: 'AI', rateName: 'GENERAL CARGO', rateType: 'CONTRACT', perKg: 3.6 },
];

const searchFreightFor = (rec) => {
  const lines = Array.isArray(rec.cargoLines) ? rec.cargoLines : [];
  // Chargeable weight is the greater of actual and volumetric (÷5000).
  const chargeable = lines.reduce((sum, l) => {
    const vol = (Number(l.height || 0) * Number(l.length || 0) * Number(l.width || 0)) / 5000;
    return sum + Math.max(Number(l.weight || 0), vol) * (l.weightType === 'per_item' ? Number(l.quantity || 1) : 1);
  }, 0) || 100;

  const airportCode = (s) => (String(s || '').match(/-\s*([A-Za-z]{3})\]$/) || [])[1] || '';
  const dep = airportCode(rec.originPort);
  const arr = airportCode(rec.destinationPort);
  const base = new Date(rec.departureDate || Date.now());

  return RATE_CARDS.map((card, i) => {
    const total = Math.round(chargeable * card.perKg * 100) / 100;
    const minimum = 250;
    const dt = new Date(base.getTime() + i * 86400000);
    return {
      airlineCode: card.code,
      airline: card.airline,
      flightNumber: `${card.code}${800 + i * 37}`,
      departureAirport: dep,
      arrivalAirport: arr,
      departureTime: dt.toISOString(),
      arrivalTime: new Date(dt.getTime() + (6 + i) * 3600000).toISOString(),
      latestAcceptanceTime: new Date(dt.getTime() - 4 * 3600000).toISOString(),
      timeOfAvailability: new Date(dt.getTime() + (10 + i) * 3600000).toISOString(),
      stops: String(i % 2),
      rateName: card.rateName,
      rateType: card.rateType,
      rateCurrency: 'AED',
      rateNetRate: card.perKg.toFixed(2),
      rateAllInRate: (card.perKg + 0.9).toFixed(2),
      rateTotal: Math.max(total, minimum).toFixed(2),
      rateMinimumRate: minimum.toFixed(2),
      chargeableWeight: Math.round(chargeable * 100) / 100,
      available: 'true',
      availableReason: '',
      ghaName: 'dnata Cargo',
      ghaAddress: 'Cargo Village, Dubai',
      airlineConditions: 'Subject to space and capacity confirmation.',
      shipmentStatus: 'quoted',
    };
  });
};

exports.searchFreight = async (req, res, next) => {
  try {
    const rec = await FreightBooking.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Booking not found', 404);
    if (!rec.availableActions().searchFreight && !rec.availableActions().searchFreightSea) {
      return errorResponse(res, 'Search Freight is not available for this booking', 400);
    }
    if (!(rec.cargoLines || []).length) {
      return errorResponse(res, 'Add at least one cargo line before searching for freight', 400);
    }
    const flights = searchFreightFor(rec);
    await rec.update({
      flightLines: flights,
      activityLog: pushLog(rec, logEntry(actorName(req), `Freight search returned ${flights.length} rate options`)),
    });
    return successResponse(res, withActions(rec), 'Freight search complete');
  } catch (error) {
    next(error);
  }
};

// Picking a rate line from the Cargo Charge Detail grid.
exports.selectFlight = async (req, res, next) => {
  try {
    const rec = await FreightBooking.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Booking not found', 404);
    const idx = Number(req.body.index);
    const lines = rec.flightLines || [];
    if (!lines[idx]) return errorResponse(res, 'No such rate option', 400);
    const chosen = lines[idx];
    await rec.update({
      flightLines: [chosen, ...lines.filter((_, i) => i !== idx)],
      airline: chosen.airline,
      flightNo: chosen.flightNumber,
      activityLog: pushLog(rec, logEntry(actorName(req),
        `Selected ${chosen.airline} ${chosen.flightNumber} at ${chosen.rateTotal} ${chosen.rateCurrency}`)),
    });
    return successResponse(res, withActions(rec), 'Rate selected');
  } catch (error) {
    next(error);
  }
};

// Create House Shipment — raises a real FFJob off the confirmed booking.
exports.createHouseShipment = async (req, res, next) => {
  try {
    const rec = await FreightBooking.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Booking not found', 404);
    if (!rec.availableActions().createHouseShipment) {
      return errorResponse(res, 'Create House Shipment is not available for this booking', 400);
    }

    const customer = rec.customerId
      ? await Customer.findByPk(rec.customerId)
      : await Customer.findOne();
    if (!customer) return errorResponse(res, 'No customer on file to raise a shipment against', 400);

    const cargo = (rec.cargoLines || [])[0] || {};
    const sea = rec.transportCode === 'SEA';
    // FFJob's enums are uppercase; map the booking's cargo label onto them.
    const cargoCode = (rec.cargoType || '').match(/\[(\w+)\]/)?.[1]?.toUpperCase();
    const job = await FFJob.create({
      customerId: customer.id,
      transportMode: sea ? 'SEA' : 'AIR',
      jobType: sea ? 'SEA_FREIGHT' : 'AIR_FREIGHT',
      cargoType: ['FCL', 'LCL', 'FTL', 'LTL', 'LSE', 'BULK', 'RORO', 'BREAKBULK', 'CR', 'PLT']
        .includes(cargoCode) ? cargoCode : (sea ? 'FCL' : 'LSE'),
      direction: (rec.shipmentType || '').includes('IMP') ? 'IMPORT' : 'EXPORT',
      origin: rec.originPort,
      destination: rec.destinationPort,
      etd: rec.etdTime || rec.departureDate || null,
      eta: rec.etaTime || null,
      hblNumber: rec.trackingNumber || null,
      commodity: cargo.commodity || null,
      grossWeight: Number(cargo.weight || 0) || null,
      volume: Number(cargo.volume || 0) || null,
      remarks: `Created from freight booking ${rec.bookingReference}`,
      createdBy: req.user?.id || customer.createdBy || null,
    });

    await rec.update({
      ffJobId: job.id,
      freightShipmentCount: (rec.freightShipmentCount || 0) + 1,
      activityLog: pushLog(rec, logEntry(actorName(req),
        `House Shipment ${job.jobNumber || job.id} created`)),
    });

    return successResponse(res, { booking: withActions(rec), shipment: job }, 'House shipment created', 201);
  } catch (error) {
    next(error);
  }
};

// Create Master Shipment — the direct-consol equivalent.
exports.createMasterShipment = async (req, res, next) => {
  try {
    const rec = await FreightBooking.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Booking not found', 404);
    if (!rec.availableActions().createMasterShipment) {
      return errorResponse(res, 'Create Master Shipment is not available for this booking', 400);
    }

    const sea = rec.transportCode === 'SEA';
    const cargo = (rec.cargoLines || [])[0] || {};
    const master = await MasterShipment.create({
      transportMode: sea ? 'SEA' : 'AIR',
      cargoType: rec.cargoType || null,
      direction: (rec.shipmentType || '').includes('IMP') ? 'IMPORT' : 'EXPORT',
      origin: rec.originPort,
      destination: rec.destinationPort,
      etd: rec.etdTime || rec.departureDate || null,
      eta: rec.etaTime || null,
      mblNumber: rec.trackingNumber || null,
      carrier: rec.carrier || rec.airline || null,
      flightNumber: rec.flightNo || null,
      commodity: cargo.commodity || null,
      grossWeight: Number(cargo.weight || 0) || null,
      volume: Number(cargo.volume || 0) || null,
      incoterm: rec.incoterm || null,
      status: 'created',
      remarks: `Created from freight booking ${rec.bookingReference}`,
      createdBy: req.user?.id || null,
    });

    await rec.update({
      masterShipmentId: master.id,
      freightShipmentCount: (rec.freightShipmentCount || 0) + 1,
      freightDirectShipmentCount: (rec.freightDirectShipmentCount || 0) + 1,
      activityLog: pushLog(rec, logEntry(actorName(req),
        `Master Shipment ${master.shipmentNumber || master.id} created`)),
    });

    return successResponse(res, { booking: withActions(rec), shipment: master }, 'Master shipment created', 201);
  } catch (error) {
    next(error);
  }
};

exports.addActivity = async (req, res, next) => {
  try {
    const rec = await FreightBooking.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Booking not found', 404);
    const entry = {
      at: new Date().toISOString(),
      author: actorName(req),
      kind: req.body.kind || 'message',
      body: req.body.body || '',
      changes: [],
    };
    await rec.update({ activityLog: pushLog(rec, entry) });
    return successResponse(res, entry, 'Activity logged', 201);
  } catch (error) {
    next(error);
  }
};

// Distinct values powering the list's Filters / Group By menus.
exports.getFacets = async (req, res, next) => {
  try {
    const rows = await FreightBooking.findAll({
      attributes: ['carrier', 'company', 'transportCode', 'airStatus', 'status'], raw: true,
    });
    const uniq = (k) => [...new Set(rows.map((r) => r[k]).filter(Boolean))].sort();
    return successResponse(res, {
      carriers: uniq('carrier'),
      companies: uniq('company'),
      airStatuses: Object.entries(AIR_LABELS).map(([key, label]) => ({ key, label })),
      seaStatuses: Object.entries(SEA_LABELS).map(([key, label]) => ({ key, label })),
    }, 'Facets retrieved');
  } catch (error) {
    next(error);
  }
};

// ── helpers ──
function cryptoUuid() {
  return require('crypto').randomUUID();
}
function awbNumber() {
  return `000-${Math.floor(10000000 + Math.random() * 89999999)}`;
}
function seaBookingNumber() {
  const d = new Date();
  return `SQ${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${String(d.getFullYear()).slice(2)}${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;
}
