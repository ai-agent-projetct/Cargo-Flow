// Multimodal quote legs.
//
// A multimodal quote is one quote number covering several carriage legs -
// "truck to Jebel Ali, ocean to Nhava Sheva, truck to Gandhinagar" is three
// legs under one quote. Each leg has its own mode, route, carrier, cargo
// figures and charge lines, so cost is attributable per leg while revenue and
// margin roll up to the quote.
//
// The quote header keeps the first leg's origin and the last leg's
// destination, so every existing lane report and the quote PDF keep working
// without knowing about legs at all.

const { Op } = require('sequelize');
const {
  Quotation, QuoteLeg, ChargeLine, Carrier, Port, Schedule, FFJob,
} = require('../models');
const { computeChargeable } = require('../services/chargeableWeight');
const { recalcLine, rollup, splitQuoteLine } = require('../services/chargeRollup');
const { refreshParent } = require('./chargeLineController');
const { successResponse, errorResponse } = require('../utils/helpers');

const num = (v, d = 0) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : d;
};

const legInclude = [
  { model: Carrier, as: 'carrier', attributes: ['id', 'name', 'code', 'scac', 'iataCode'] },
  { model: Port, as: 'originPort', attributes: ['id', 'name', 'code', 'country'] },
  { model: Port, as: 'destinationPort', attributes: ['id', 'name', 'code', 'country'] },
  { model: Schedule, as: 'schedule', attributes: ['id', 'vesselName', 'voyageNumber', 'departureDate', 'arrivalDate'] },
];

/** Cargo context for one leg, for repricing its basis-driven charges. */
const legCargo = (leg) => ({
  transportMode: leg.transportMode,
  shipmentType: leg.shipmentType,
  grossWeight: leg.grossWeight,
  volume: leg.volume,
  containerCount: leg.containerCount,
  truckCount: leg.truckCount,
  packUnit: leg.packUnit,
  netWeight: leg.netWeight,
  divisor: leg.volumetricDivisor,
});

/**
 * Recompute a leg's own chargeable figures and charge totals.
 * Called after any change to a leg's cargo or route.
 */
const refreshLeg = async (leg) => {
  const figures = computeChargeable(legCargo(leg));
  const lines = await ChargeLine.findAll({
    where: { multimodalLineId: leg.id, isActive: true },
  });

  // A basis-driven charge follows its leg's cargo, so changing the weight on
  // one leg reprices only that leg.
  for (const line of lines) {
    if (line.billingStatus === 'fully_billed' || line.billingStatus === 'fully_invoiced') continue;
    const merged = line.toJSON();
    recalcLine(merged, legCargo(leg));
    await line.update(merged);
  }

  const roll = rollup(lines.length ? await ChargeLine.findAll({
    where: { multimodalLineId: leg.id, isActive: true },
  }) : []);

  await leg.update({
    chargeableWeight: figures.chargeableWeight,
    chargeableVolume: figures.chargeableVolume,
    weightVolume: figures.weightVolume,
    chargeableBasis: figures.basis,
    volumetricDivisor: figures.divisorUsed,
    totalCostAmount: roll.estimatedCost,
    totalSellAmount: roll.estimatedRevenue,
    estimatedMargin: roll.estimatedMargin,
    allInclusiveSellRate: roll.estimatedRevenue,
  });
  return { figures, roll };
};

/**
 * Keep the quote header consistent with its legs: the route runs from the
 * first leg's origin to the last leg's destination, the transit time is the
 * sum of the legs, and the cargo figures come from the heaviest leg (every
 * leg carries the same cargo, so taking the max rather than the sum is what
 * stops a three-leg move reporting triple the weight).
 */
const refreshQuoteFromLegs = async (quotationId) => {
  const quote = await Quotation.findByPk(quotationId);
  if (!quote) return null;
  const legs = await QuoteLeg.findAll({
    where: { quotationId },
    order: [['legSequence', 'ASC']],
  });

  if (!legs.length) {
    await quote.update({ isMultimodal: false, legCount: 0 });
    await refreshParent('quote', quotationId);
    return quote;
  }

  const first = legs[0];
  const last = legs[legs.length - 1];
  const transitDays = legs.reduce((s, l) => s + (num(l.transitDays)), 0);
  const maxBy = (field) => legs.reduce((m, l) => Math.max(m, num(l[field])), 0);

  // A single remaining leg is not a multimodal quote any more.
  const multimodal = legs.length > 1;

  await quote.update({
    isMultimodal: multimodal,
    legCount: legs.length,
    transportMode: multimodal ? 'MULTIMODAL' : first.transportMode,
    mode: multimodal ? 'multimodal' : String(first.transportMode || 'sea').toLowerCase().replace('road', 'land'),
    originCountry: first.originCountry || quote.originCountry,
    originCity: first.originLocation || quote.originCity,
    originPortId: first.originPortId || quote.originPortId,
    destinationCountry: last.destinationCountry || quote.destinationCountry,
    destinationCity: last.destinationLocation || quote.destinationCity,
    destinationPortId: last.destinationPortId || quote.destinationPortId,
    estimatedTransitDays: transitDays || quote.estimatedTransitDays,
    transitDays: transitDays || null,
    estimatedPickup: first.estimatedPickup || quote.estimatedPickup,
    expectedDelivery: last.expectedDelivery || quote.expectedDelivery,
    cargoWeight: maxBy('grossWeight') || quote.cargoWeight,
    cargoVolume: maxBy('volume') || quote.cargoVolume,
    chargeableWeight: maxBy('chargeableWeight') || quote.chargeableWeight,
    weightVolume: maxBy('weightVolume') || quote.weightVolume,
    containerCount: maxBy('containerCount') || quote.containerCount,
    truckCount: maxBy('truckCount') || quote.truckCount,
    // Any leg carrying special cargo makes the whole quote special cargo.
    isDangerous: legs.some((l) => l.isDangerousGood) || quote.isDangerous,
    isTemperatureControlled: legs.some((l) => l.isTemperatureControl) || quote.isTemperatureControlled,
    isOutOfGauge: legs.some((l) => l.isOutOfGauge) || quote.isOutOfGauge,
    pickupAddress: first.pickupAddress || quote.pickupAddress,
    deliveryAddress: last.deliveryAddress || quote.deliveryAddress,
  });

  await refreshParent('quote', quotationId);
  return Quotation.findByPk(quotationId);
};

exports.refreshLeg = refreshLeg;
exports.refreshQuoteFromLegs = refreshQuoteFromLegs;

// --- list / read ------------------------------------------------------------
exports.getAll = async (req, res, next) => {
  try {
    const { quotationId } = req.params;
    const quote = await Quotation.findByPk(quotationId);
    if (!quote) return errorResponse(res, 'Quotation not found', 404);

    const legs = await QuoteLeg.findAll({
      where: { quotationId },
      include: legInclude,
      order: [['legSequence', 'ASC']],
    });

    // Charges are returned grouped by leg, which is how the leg tabs render.
    const lines = await ChargeLine.findAll({
      where: { parentType: 'quote', parentId: quotationId, isActive: true },
      order: [['sequence', 'ASC']],
    });

    const payload = legs.map((l) => {
      const legLines = lines.filter((x) => x.multimodalLineId === l.id);
      return {
        ...l.toJSON(),
        chargeLines: legLines,
        chargeCount: legLines.length,
        actions: legActions(l, quote, legs.length),
      };
    });

    // Charges with no leg belong to the quote as a whole.
    const unassigned = lines.filter((x) => !x.multimodalLineId);

    return successResponse(res, {
      quotationId,
      quoteNumber: quote.quoteNumber,
      isMultimodal: quote.isMultimodal,
      legCount: legs.length,
      totalTransitDays: legs.reduce((s, l) => s + num(l.transitDays), 0),
      legs: payload,
      unassignedCharges: unassigned,
      totals: rollup(lines),
    }, 'Quote legs retrieved');
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const leg = await QuoteLeg.findByPk(req.params.id, { include: legInclude });
    if (!leg) return errorResponse(res, 'Quote leg not found', 404);
    const [quote, chargeLines, legCount] = await Promise.all([
      Quotation.findByPk(leg.quotationId),
      ChargeLine.findAll({ where: { multimodalLineId: leg.id }, order: [['sequence', 'ASC']] }),
      QuoteLeg.count({ where: { quotationId: leg.quotationId } }),
    ]);
    return successResponse(res, {
      ...leg.toJSON(),
      chargeLines,
      actions: legActions(leg, quote, legCount),
    }, 'Quote leg retrieved');
  } catch (error) {
    next(error);
  }
};

const legActions = (leg, quote, legCount) => {
  const quoteOpen = !quote || !['accepted', 'converted', 'cancelled', 'expired'].includes(quote.status);
  return {
    edit: quoteOpen && !leg.isConverted,
    delete: quoteOpen && !leg.isConverted && legCount > 1,
    addCharge: quoteOpen && !leg.isConverted,
    requestVendorRates: quoteOpen && !leg.isConverted,
    attachSchedule: quoteOpen && (leg.transportMode === 'SEA' || leg.transportMode === 'AIR'),
    convertToShipment: !leg.isConverted
      && !!quote
      && ['approved', 'accepted'].includes(quote.status),
    openShipment: !!leg.convertedShipmentId,
    reorder: quoteOpen && legCount > 1,
  };
};

// --- create -----------------------------------------------------------------
exports.create = async (req, res, next) => {
  try {
    const { quotationId } = req.params;
    const quote = await Quotation.findByPk(quotationId);
    if (!quote) return errorResponse(res, 'Quotation not found', 404);
    if (['converted', 'cancelled'].includes(quote.status)) {
      return errorResponse(res, `A ${quote.status} quotation cannot take new legs`, 409);
    }
    if (!req.body.transportMode) {
      return errorResponse(res, 'A leg needs a transport mode', 422);
    }

    const existing = await QuoteLeg.count({ where: { quotationId } });
    // Legs are appended unless a position is given, and the sequence is
    // assigned here rather than trusted from the form.
    const legSequence = req.body.legSequence
      ? Math.min(Math.max(1, parseInt(req.body.legSequence, 10)), existing + 1)
      : existing + 1;

    if (legSequence <= existing) {
      // Inserting in the middle: push the later legs down by one.
      await QuoteLeg.increment('legSequence', {
        by: 1,
        where: { quotationId, legSequence: { [Op.gte]: legSequence } },
      });
    }

    const leg = await QuoteLeg.create({
      // Cargo defaults to the quote's, because every leg of one movement
      // carries the same goods unless the user says otherwise.
      grossWeight: quote.cargoWeight,
      volume: quote.cargoVolume,
      netWeight: quote.netWeight,
      packUnit: quote.packUnit,
      containerCount: quote.containerCount,
      shipperId: quote.shipperId,
      consigneeId: quote.consigneeId,
      cargoType: quote.cargoType,
      isDangerousGood: quote.isDangerous,
      isTemperatureControl: quote.isTemperatureControlled,
      isOutOfGauge: quote.isOutOfGauge,
      currency: quote.currency || 'AED',
      companyId: quote.companyId,
      ...req.body,
      quotationId,
      legSequence,
      isCourierLeg: String(req.body.transportMode).toUpperCase() === 'COURIER',
      state: 'draft',
    });

    await refreshLeg(leg);
    await refreshQuoteFromLegs(quotationId);

    const fresh = await QuoteLeg.findByPk(leg.id, { include: legInclude });
    return successResponse(res, fresh, 'Quote leg added', 201);
  } catch (error) {
    next(error);
  }
};

// --- update -----------------------------------------------------------------
exports.update = async (req, res, next) => {
  try {
    const leg = await QuoteLeg.findByPk(req.params.id);
    if (!leg) return errorResponse(res, 'Quote leg not found', 404);
    if (leg.isConverted) {
      return errorResponse(
        res,
        'This leg has already been converted to a shipment. Change the shipment instead.',
        409,
      );
    }
    const payload = { ...req.body };
    ['id', 'quotationId', 'legSequence', 'convertedShipmentId', 'isConverted'].forEach((k) => delete payload[k]);
    await leg.update(payload);
    await refreshLeg(leg);
    await refreshQuoteFromLegs(leg.quotationId);

    const fresh = await QuoteLeg.findByPk(leg.id, { include: legInclude });
    return successResponse(res, fresh, 'Quote leg updated');
  } catch (error) {
    next(error);
  }
};

// --- delete -----------------------------------------------------------------
exports.remove = async (req, res, next) => {
  try {
    const leg = await QuoteLeg.findByPk(req.params.id);
    if (!leg) return errorResponse(res, 'Quote leg not found', 404);
    if (leg.isConverted) {
      return errorResponse(res, 'A converted leg cannot be deleted', 409);
    }
    const count = await QuoteLeg.count({ where: { quotationId: leg.quotationId } });
    if (count <= 1) {
      return errorResponse(
        res,
        'A multimodal quotation needs at least one leg. Turn off multimodal on the quotation instead.',
        409,
      );
    }

    const billed = await ChargeLine.count({
      where: {
        multimodalLineId: leg.id,
        billingStatus: { [Op.in]: ['partial', 'fully_billed', 'fully_invoiced'] },
      },
    });
    if (billed) {
      return errorResponse(
        res,
        `${billed} charge(s) on this leg have already been billed or invoiced. `
        + 'Credit them before removing the leg.',
        409,
      );
    }

    const { quotationId, legSequence } = leg;
    await ChargeLine.destroy({ where: { multimodalLineId: leg.id } });
    await leg.destroy();
    // Close the gap so the legs stay 1..n.
    await QuoteLeg.decrement('legSequence', {
      by: 1,
      where: { quotationId, legSequence: { [Op.gt]: legSequence } },
    });
    await ChargeLine.update(
      { modeTypeSequence: null },
      { where: { parentType: 'quote', parentId: quotationId, multimodalLineId: null } },
    );
    await refreshQuoteFromLegs(quotationId);
    return successResponse(res, null, 'Quote leg removed');
  } catch (error) {
    next(error);
  }
};

// --- reorder ----------------------------------------------------------------
// The order of carriage matters: it decides which leg's origin and which
// leg's destination the quote header shows, and the order of the routing on
// the quote PDF.
exports.reorder = async (req, res, next) => {
  try {
    const { quotationId } = req.params;
    const order = Array.isArray(req.body.legIds) ? req.body.legIds : [];
    if (!order.length) return errorResponse(res, 'Send the leg ids in their new order', 422);

    const legs = await QuoteLeg.findAll({ where: { quotationId } });
    if (legs.length !== order.length) {
      return errorResponse(
        res,
        `This quotation has ${legs.length} leg(s) but ${order.length} were sent. Send them all.`,
        422,
      );
    }
    const known = new Set(legs.map((l) => String(l.id)));
    if (order.some((id) => !known.has(String(id)))) {
      return errorResponse(res, 'One of those legs does not belong to this quotation', 422);
    }

    for (let i = 0; i < order.length; i += 1) {
      await QuoteLeg.update({ legSequence: i + 1 }, { where: { id: order[i] } });
      await ChargeLine.update(
        { modeTypeSequence: i + 1 },
        { where: { multimodalLineId: order[i] } },
      );
    }
    await refreshQuoteFromLegs(quotationId);

    const fresh = await QuoteLeg.findAll({
      where: { quotationId }, include: legInclude, order: [['legSequence', 'ASC']],
    });
    return successResponse(res, fresh, 'Legs reordered');
  } catch (error) {
    next(error);
  }
};

// --- turn a single-mode quote into a multimodal one -------------------------
exports.enableMultimodal = async (req, res, next) => {
  try {
    const quote = await Quotation.findByPk(req.params.quotationId);
    if (!quote) return errorResponse(res, 'Quotation not found', 404);
    const existing = await QuoteLeg.count({ where: { quotationId: quote.id } });
    if (existing) {
      return errorResponse(res, 'This quotation already has legs', 409);
    }

    // The existing single-mode routing becomes leg 1, so nothing already
    // quoted is lost and its charges stay attached.
    const mode = String(quote.transportMode || quote.mode || 'SEA').toUpperCase();
    const first = await QuoteLeg.create({
      quotationId: quote.id,
      legSequence: 1,
      transportMode: mode === 'LAND' ? 'ROAD' : (mode === 'MULTIMODAL' ? 'SEA' : mode),
      shipmentType: quote.shipmentType,
      cargoType: quote.cargoType,
      serviceMode: quote.serviceMode,
      originCountry: quote.originCountry,
      originLocation: quote.originCity,
      originPortId: quote.originPortId,
      destinationCountry: quote.destinationCountry,
      destinationLocation: quote.destinationCity,
      destinationPortId: quote.destinationPortId,
      pickupLocationType: quote.pickupLocationType,
      deliveryLocationType: quote.deliveryLocationType,
      pickupAddress: quote.pickupAddress,
      deliveryAddress: quote.deliveryAddress,
      carrierId: quote.carrierId,
      carrierServiceType: quote.carrierServiceType,
      incotermId: quote.incotermId,
      transitDays: quote.estimatedTransitDays,
      estimatedPickup: quote.estimatedPickup,
      expectedDelivery: quote.expectedDelivery,
      grossWeight: quote.cargoWeight,
      volume: quote.cargoVolume,
      netWeight: quote.netWeight,
      packUnit: quote.packUnit,
      containerCount: quote.containerCount,
      truckCount: quote.truckCount,
      shipperId: quote.shipperId,
      consigneeId: quote.consigneeId,
      agentId: quote.agentId,
      isDangerousGood: quote.isDangerous,
      dangerousGoodNote: quote.dangerousGoodNote,
      hazClass: quote.hazClass,
      hazUnNumber: quote.hazUnNumber,
      isTemperatureControl: quote.isTemperatureControlled,
      temperatureDetails: quote.temperatureDetails,
      isOutOfGauge: quote.isOutOfGauge,
      outOfGaugeDetails: quote.outOfGaugeDetails,
      goodsValue: quote.goodsValue,
      insuranceValue: quote.insuranceValue,
      state: 'draft',
      companyId: quote.companyId,
      currency: quote.currency || 'AED',
      remarks: 'Leg 1, created from the original single-mode routing.',
    });

    // Existing charges belong to that first leg.
    await ChargeLine.update(
      { multimodalLineId: first.id, modeTypeSequence: 1, transportMode: first.transportMode },
      { where: { parentType: 'quote', parentId: quote.id, multimodalLineId: null } },
    );

    await refreshLeg(first);
    const updated = await refreshQuoteFromLegs(quote.id);
    return successResponse(res, {
      quotation: updated,
      legs: await QuoteLeg.findAll({ where: { quotationId: quote.id }, include: legInclude, order: [['legSequence', 'ASC']] }),
    }, 'Multimodal routing enabled. The original routing is now leg 1.', 201);
  } catch (error) {
    next(error);
  }
};

// --- convert one leg into a house shipment ----------------------------------
// This is the operations handover for a multimodal quote: each leg becomes its
// own house shipment carrying that leg's route, cargo and charges, all
// pointing back at the one quote.
exports.convertToShipment = async (req, res, next) => {
  try {
    const leg = await QuoteLeg.findByPk(req.params.id, { include: legInclude });
    if (!leg) return errorResponse(res, 'Quote leg not found', 404);
    if (leg.isConverted) {
      return errorResponse(res, 'This leg has already been converted to a shipment', 409);
    }
    const quote = await Quotation.findByPk(leg.quotationId);
    if (!quote) return errorResponse(res, 'Quotation not found', 404);
    if (!['approved', 'accepted'].includes(quote.status)) {
      return errorResponse(
        res,
        `The quotation is "${quote.status}". Approve or accept it before creating shipments.`,
        409,
      );
    }

    const figures = computeChargeable(legCargo(leg));
    const job = await FFJob.create({
      quotationId: quote.id,
      customerId: quote.customerId,
      companyId: quote.companyId,
      transportMode: leg.transportMode,
      direction: quote.direction || 'EXPORT',
      cargoType: leg.cargoType || quote.cargoType,
      serviceType: leg.carrierServiceType || null,
      origin: leg.originLocation || leg.originCountry,
      originCountry: leg.originCountry,
      originPortId: leg.originPortId,
      destination: leg.destinationLocation || leg.destinationCountry,
      destinationCountry: leg.destinationCountry,
      destinationPortId: leg.destinationPortId,
      etd: leg.estimatedPickup,
      eta: leg.expectedDelivery,
      carrier: leg.carrier ? leg.carrier.name : null,
      vesselName: leg.vesselName,
      voyageNumber: leg.voyageNumber,
      flightNumber: leg.flightNumber,
      commodity: quote.commodity,
      incoterm: quote.incoterm || quote.incoterms,
      grossWeight: leg.grossWeight,
      netWeight: leg.netWeight,
      volume: leg.volume,
      chargeableWeight: figures.chargeableWeight,
      chargeableBasis: figures.basis,
      weightVolume: figures.weightVolume,
      volumetricDivisor: figures.divisorUsed,
      packages: leg.packUnit,
      packCount: leg.packUnit,
      packUnit: leg.packUnitUom || 'PKG',
      shipperId: leg.shipperId || quote.shipperId,
      consigneeId: leg.consigneeId || quote.consigneeId,
      salesAgentId: quote.createdBy,
      status: 'created',
      quoteLegId: leg.id,
      remarks: `Leg ${leg.legSequence} of quotation ${quote.quoteNumber}`
        + (leg.transshipment ? ` (transshipment at ${leg.transshipmentPort || 'intermediate port'})` : ''),
      createdBy: req.user ? req.user.id : quote.createdBy,
    });

    // The leg's charges become the shipment's cost and revenue charges.
    const legLines = await ChargeLine.findAll({
      where: { multimodalLineId: leg.id, isActive: true },
      order: [['sequence', 'ASC']],
    });
    let copied = 0;
    for (const ql of legLines) {
      const { cost, revenue } = splitQuoteLine(ql.toJSON(), {
        parentType: 'house_shipment',
        parentId: job.id,
        clientId: quote.customerId,
      });
      const costRow = await ChargeLine.create(cost);
      const revenueRow = await ChargeLine.create({ ...revenue, pairLineId: costRow.id });
      await costRow.update({ pairLineId: revenueRow.id });
      copied += 1;
    }

    await leg.update({
      convertedShipmentId: job.id,
      isConverted: true,
      state: 'approved',
    });
    const totals = await refreshParent('house_shipment', job.id);

    // Once every leg is converted the quote itself is fully converted.
    const remaining = await QuoteLeg.count({
      where: { quotationId: quote.id, isConverted: false },
    });
    if (!remaining) await quote.update({ status: 'converted' });

    return successResponse(res, {
      shipment: await FFJob.findByPk(job.id),
      chargesCopied: copied,
      totals,
      legsRemaining: remaining,
    }, `Leg ${leg.legSequence} converted to house shipment ${job.jobNumber}`, 201);
  } catch (error) {
    next(error);
  }
};

// --- attach a sailing or flight schedule to a leg ---------------------------
exports.attachSchedule = async (req, res, next) => {
  try {
    const leg = await QuoteLeg.findByPk(req.params.id);
    if (!leg) return errorResponse(res, 'Quote leg not found', 404);
    const schedule = await Schedule.findByPk(req.body.scheduleId);
    if (!schedule) return errorResponse(res, 'Schedule not found', 404);

    const legMode = String(leg.transportMode).toUpperCase();
    const schedMode = String(schedule.mode || '').toUpperCase();
    const compatible = (legMode === 'SEA' && schedMode === 'SEA')
      || (legMode === 'AIR' && schedMode === 'AIR')
      || (legMode === 'RAIL' && schedMode === 'RAIL')
      || (legMode === 'ROAD' && schedMode === 'LAND');
    if (!compatible) {
      return errorResponse(
        res,
        `A ${schedMode || 'unknown'} schedule cannot be attached to a ${legMode} leg`,
        422,
      );
    }

    const isAir = legMode === 'AIR';
    await leg.update({
      [isAir ? 'airScheduleId' : 'scheduleId']: schedule.id,
      carrierId: schedule.carrierId || leg.carrierId,
      vesselName: schedule.vesselName || leg.vesselName,
      voyageNumber: schedule.voyageNumber || leg.voyageNumber,
      flightNumber: schedule.flightNumber || leg.flightNumber,
      estimatedPickup: schedule.departureDate || leg.estimatedPickup,
      expectedDelivery: schedule.arrivalDate || leg.expectedDelivery,
      transitDays: schedule.transitDays || leg.transitDays,
      addVesselDetails: !isAir ? true : leg.addVesselDetails,
      addFlightDetails: isAir ? true : leg.addFlightDetails,
    });
    await refreshQuoteFromLegs(leg.quotationId);

    const fresh = await QuoteLeg.findByPk(leg.id, { include: legInclude });
    return successResponse(res, fresh, 'Schedule attached to the leg');
  } catch (error) {
    next(error);
  }
};

// --- routing summary for the quote PDF and the tracking view ---------------
exports.routing = async (req, res, next) => {
  try {
    const quote = await Quotation.findByPk(req.params.quotationId);
    if (!quote) return errorResponse(res, 'Quotation not found', 404);
    const legs = await QuoteLeg.findAll({
      where: { quotationId: quote.id },
      include: legInclude,
      order: [['legSequence', 'ASC']],
    });

    let cumulative = 0;
    const rows = legs.map((l) => {
      cumulative += num(l.transitDays);
      return {
        legSequence: l.legSequence,
        transportMode: l.transportMode,
        from: l.originLocation || l.originCountry,
        fromPort: l.originPort ? `${l.originPort.name} (${l.originPort.code})` : null,
        to: l.destinationLocation || l.destinationCountry,
        toPort: l.destinationPort ? `${l.destinationPort.name} (${l.destinationPort.code})` : null,
        carrier: l.carrier ? l.carrier.name : null,
        conveyance: l.vesselName || l.flightNumber || l.truckNumber || null,
        reference: l.voyageNumber || l.referenceNumber || null,
        transitDays: num(l.transitDays),
        cumulativeDays: cumulative,
        departure: l.estimatedPickup,
        arrival: l.expectedDelivery,
        transshipment: l.transshipment,
        transshipmentPort: l.transshipmentPort,
        chargeableWeight: num(l.chargeableWeight),
        chargeableBasis: l.chargeableBasis,
        cost: num(l.totalCostAmount),
        revenue: num(l.totalSellAmount),
        margin: num(l.estimatedMargin),
        isConverted: l.isConverted,
        shipmentId: l.convertedShipmentId,
      };
    });

    return successResponse(res, {
      quoteNumber: quote.quoteNumber,
      isMultimodal: quote.isMultimodal,
      origin: rows.length ? rows[0].from : quote.originCity,
      destination: rows.length ? rows[rows.length - 1].to : quote.destinationCity,
      totalTransitDays: cumulative,
      transshipments: rows.filter((r) => r.transshipment).length,
      carrierChanges: new Set(rows.map((r) => r.carrier).filter(Boolean)).size,
      legs: rows,
      totals: {
        cost: Number(rows.reduce((s, r) => s + r.cost, 0).toFixed(2)),
        revenue: Number(rows.reduce((s, r) => s + r.revenue, 0).toFixed(2)),
        margin: Number(rows.reduce((s, r) => s + r.margin, 0).toFixed(2)),
      },
    }, 'Quote routing retrieved');
  } catch (error) {
    next(error);
  }
};
