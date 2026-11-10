// Charge lines: the cost and revenue detail behind every quote, house
// shipment, master shipment, service job and pro forma.
//
// One controller, because `charge_lines` is one table. The six
// Settings > Technical > Charge Lines views are filters over it, and the
// per-parent tabs on each record are the same filter scoped to that record.
//
// Every write re-prices through `chargeRollup`, then re-rolls the parent, so
// a header's revenue, cost and margin can never drift from its lines.

const { Op, fn, col } = require('sequelize');
const {
  ChargeLine, Quotation, FFJob, Shipment, MasterShipment, ServiceJob,
  ProFormaInvoice, Organization, Carrier, Product, QuoteLeg,
} = require('../models');
const { recalcLine, rollup, splitQuoteLine } = require('../services/chargeRollup');
const { computeChargeable } = require('../services/chargeableWeight');
const {
  successResponse, errorResponse, getPagination, getPaginationMeta,
} = require('../utils/helpers');

// Which model owns each parentType, and where its cargo figures live. The
// cargo mapping is what lets a basis-driven charge reprice itself when the
// shipment's weight changes.
const PARENTS = {
  quote: {
    model: () => Quotation,
    label: 'Quotation',
    cargo: (r) => ({
      transportMode: normaliseMode(r.transportMode || r.mode),
      shipmentType: r.shipmentType || r.cargoType,
      grossWeight: r.cargoWeight,
      volume: r.cargoVolume,
      containerCount: r.containerCount,
      truckCount: r.truckCount,
      packUnit: r.packUnit,
      netWeight: r.netWeight,
      divisor: r.volumetricDivisor,
    }),
  },
  house_shipment: {
    model: () => FFJob,
    label: 'House shipment',
    fallbackModel: () => Shipment,
    cargo: (r) => ({
      transportMode: normaliseMode(r.transportMode || r.mode),
      shipmentType: r.cargoType || r.shipmentType,
      grossWeight: r.grossWeight ?? r.cargoWeight,
      volume: r.volume ?? r.cargoVolume,
      containerCount: Array.isArray(r.containerNumbers)
        ? r.containerNumbers.length
        : r.containerCount,
      truckCount: r.truckCount,
      packUnit: r.packCount ?? r.packages ?? r.numberOfPackages,
      netWeight: r.netWeight,
      divisor: r.volumetricDivisor,
    }),
  },
  master_shipment: {
    model: () => MasterShipment,
    label: 'Master shipment',
    cargo: (r) => ({
      transportMode: normaliseMode(r.transportMode),
      shipmentType: r.cargoType,
      grossWeight: r.grossWeight,
      volume: r.volume,
      containerCount: Array.isArray(r.containerNumbers) ? r.containerNumbers.length : 0,
      packUnit: r.packages,
      divisor: r.volumetricDivisor,
    }),
  },
  service_job: {
    model: () => ServiceJob,
    label: 'Service job',
    cargo: (r) => ({
      transportMode: normaliseMode(r.transportMode),
      shipmentType: r.shipmentType || r.cargoType,
      grossWeight: r.grossWeight,
      volume: r.volume,
      packUnit: r.packUnit,
      divisor: r.volumetricDivisor,
    }),
  },
  pro_forma: {
    model: () => ProFormaInvoice,
    label: 'Pro forma invoice',
    cargo: () => null,
  },
};

const normaliseMode = (m) => {
  const v = String(m || '').toUpperCase();
  if (v === 'LAND') return 'ROAD';
  if (v === 'MULTIMODAL' || v === '') return 'SEA';
  return v;
};

const listInclude = [
  { model: Organization, as: 'creditor', attributes: ['id', 'name', 'companyName'], required: false },
  { model: Organization, as: 'debtor', attributes: ['id', 'name', 'companyName'], required: false },
  { model: Carrier, as: 'carrier', attributes: ['id', 'name', 'code'], required: false },
  { model: Product, as: 'product', attributes: ['id', 'name', 'internalReference'], required: false },
];

/** Load a parent record, trying the fallback model where one exists. */
const loadParent = async (parentType, parentId) => {
  const spec = PARENTS[parentType];
  if (!spec) return { spec: null, record: null };
  let record = await spec.model().findByPk(parentId);
  if (!record && spec.fallbackModel) {
    record = await spec.fallbackModel().findByPk(parentId);
  }
  return { spec, record };
};

/**
 * Re-roll a parent's totals from its current charge lines and persist them.
 * Called after every charge-line write so the two can never disagree.
 */
const refreshParent = async (parentType, parentId) => {
  const { spec, record } = await loadParent(parentType, parentId);
  if (!spec || !record) return null;

  const lines = await ChargeLine.findAll({
    where: { parentType, parentId, isActive: true },
  });
  const roll = rollup(lines);

  const patch = {
    estimatedRevenue: roll.estimatedRevenue,
    estimatedCost: roll.estimatedCost,
    estimatedMargin: roll.estimatedMargin,
    estimatedMarginPercentage: roll.estimatedMarginPercentage,
    receivedRevenue: roll.receivedRevenue,
    paidCost: roll.paidCost,
    receivedMargin: roll.receivedMargin,
    dueRevenue: roll.dueRevenue,
    dueCost: roll.dueCost,
    revenueChargeStatus: roll.revenueStatus,
    costChargeStatus: roll.costStatus,
  };

  // A quote also keeps the legacy flat totals in step, so the older quote
  // screens and the quote PDF keep showing the same figures.
  if (parentType === 'quote') {
    patch.totalBuyRate = roll.estimatedCost;
    patch.totalSellRate = roll.estimatedRevenue;
    patch.totalAmount = roll.estimatedRevenue;
    patch.profit = roll.estimatedMargin;
    patch.allInclusiveSellRate = roll.estimatedRevenue;
  }

  // Only write fields the model actually declares - a column the model does
  // not know about is silently dropped, and a silent drop here would leave a
  // header reading zero with no error anywhere.
  const known = Object.keys(record.rawAttributes || {});
  const safe = Object.fromEntries(Object.entries(patch).filter(([k]) => known.includes(k)));
  await record.update(safe);

  // On a multimodal quote each leg carries its own totals too.
  if (parentType === 'quote') {
    const legs = await QuoteLeg.findAll({ where: { quotationId: parentId } });
    for (const leg of legs) {
      const legLines = lines.filter((l) => l.multimodalLineId === leg.id);
      const legRoll = rollup(legLines);
      await leg.update({
        totalCostAmount: legRoll.estimatedCost,
        totalSellAmount: legRoll.estimatedRevenue,
        estimatedMargin: legRoll.estimatedMargin,
        allInclusiveSellRate: legRoll.estimatedRevenue,
      });
    }
  }

  return roll;
};

/** Cargo context for a parent, used to reprice basis-driven quantities. */
const cargoFor = async (parentType, parentId, legId) => {
  // A multimodal leg prices on its own cargo, not the quote header's.
  if (legId) {
    const leg = await QuoteLeg.findByPk(legId);
    if (leg) {
      return {
        transportMode: normaliseMode(leg.transportMode),
        shipmentType: leg.shipmentType,
        grossWeight: leg.grossWeight,
        volume: leg.volume,
        containerCount: leg.containerCount,
        truckCount: leg.truckCount,
        packUnit: leg.packUnit,
        netWeight: leg.netWeight,
        divisor: leg.volumetricDivisor,
      };
    }
  }
  const { spec, record } = await loadParent(parentType, parentId);
  if (!spec || !record) return null;
  return spec.cargo(record.toJSON ? record.toJSON() : record);
};

exports.refreshParent = refreshParent;

// --- list -------------------------------------------------------------------
// Serves both the per-record charge tabs and the six technical list views.
exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const {
      parentType, parentId, side, search, billingStatus, chargeCode,
      transportMode, multimodalLineId, creditorPartnerId, debtorPartnerId,
      chargeSource, carrierId, selected,
    } = req.query;

    const where = {};
    if (parentType) {
      where.parentType = String(parentType).includes(',')
        ? { [Op.in]: String(parentType).split(',') }
        : parentType;
    }
    if (parentId) where.parentId = parentId;
    if (side) where.side = String(side).includes(',') ? { [Op.in]: String(side).split(',') } : side;
    if (billingStatus) where.billingStatus = billingStatus;
    if (chargeCode) where.chargeCode = chargeCode;
    if (transportMode) where.transportMode = transportMode;
    if (multimodalLineId) where.multimodalLineId = multimodalLineId;
    if (creditorPartnerId) where.creditorPartnerId = creditorPartnerId;
    if (debtorPartnerId) where.debtorPartnerId = debtorPartnerId;
    if (chargeSource) where.chargeSource = chargeSource;
    if (carrierId) where.carrierId = carrierId;
    if (selected === 'true' || selected === 'false') where.selected = selected === 'true';
    if (req.query.isActive === undefined) where.isActive = true;
    else if (req.query.isActive !== 'all') where.isActive = req.query.isActive === 'true';

    if (search) {
      where[Op.or] = [
        { chargeDescription: { [Op.like]: `%${search}%` } },
        { serviceName: { [Op.like]: `%${search}%` } },
        { chargeCode: { [Op.like]: `%${search}%` } },
      ];
    }

    const unpaged = req.query.limit === 'all';
    const query = {
      where,
      include: listInclude,
      order: [['modeTypeSequence', 'ASC'], ['sequence', 'ASC'], ['createdAt', 'ASC']],
      distinct: true,
    };
    if (!unpaged) Object.assign(query, { limit, offset });

    const { count, rows } = await ChargeLine.findAndCountAll(query);

    // Column totals, so the footer does not have to add up only the rows on
    // the current page.
    const totals = await ChargeLine.findOne({
      where,
      attributes: [
        [fn('SUM', col('totalCostAmount')), 'totalCost'],
        [fn('SUM', col('totalSellAmount')), 'totalSell'],
        [fn('SUM', col('totalCostAmountIncl')), 'totalCostIncl'],
        [fn('SUM', col('totalSellAmountIncl')), 'totalSellIncl'],
        [fn('SUM', col('estimatedMargin')), 'totalMargin'],
        [fn('SUM', col('residualAmount')), 'totalResidual'],
      ],
      raw: true,
    });

    return successResponse(
      res,
      { lines: rows, totals },
      'Charge lines retrieved',
      200,
      unpaged ? null : getPaginationMeta(count, page, limit),
    );
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const line = await ChargeLine.findByPk(req.params.id, { include: listInclude });
    if (!line) return errorResponse(res, 'Charge line not found', 404);
    return successResponse(res, line, 'Charge line retrieved');
  } catch (error) {
    next(error);
  }
};

// --- create -----------------------------------------------------------------
exports.create = async (req, res, next) => {
  try {
    const { parentType, parentId } = req.body;
    if (!PARENTS[parentType]) {
      return errorResponse(
        res,
        `Unknown parent type "${parentType}". Expected one of: ${Object.keys(PARENTS).join(', ')}`,
        422,
      );
    }
    const { record } = await loadParent(parentType, parentId);
    if (!record) return errorResponse(res, `${PARENTS[parentType].label} not found`, 422);
    if (!req.body.chargeDescription) {
      return errorResponse(res, 'A charge line needs a description', 422);
    }

    const cargo = await cargoFor(parentType, parentId, req.body.multimodalLineId);
    const payload = recalcLine({
      side: parentType === 'quote' ? 'both' : (req.body.side || 'revenue'),
      ...req.body,
      companyId: req.body.companyId || record.companyId || null,
    }, cargo);

    const line = await ChargeLine.create(payload);
    await refreshParent(parentType, parentId);
    const fresh = await ChargeLine.findByPk(line.id, { include: listInclude });
    return successResponse(res, fresh, 'Charge line created', 201);
  } catch (error) {
    next(error);
  }
};

// --- update -----------------------------------------------------------------
exports.update = async (req, res, next) => {
  try {
    const line = await ChargeLine.findByPk(req.params.id);
    if (!line) return errorResponse(res, 'Charge line not found', 404);

    // A fully billed or invoiced charge is already on a posted document, so
    // its money fields are frozen. Remarks stay editable.
    const posted = line.billingStatus === 'fully_billed' || line.billingStatus === 'fully_invoiced';
    const moneyFields = [
      'quantity', 'costAmountRate', 'sellAmountRate', 'costCurrency', 'sellCurrency',
      'costConversionRate', 'sellConversionRate', 'measurementBasis', 'taxes',
      'supplierTaxes', 'marginType', 'marginPercentage', 'marginAmount', 'useMargin',
    ];
    if (posted) {
      const attempted = moneyFields.filter((f) => req.body[f] !== undefined);
      if (attempted.length) {
        return errorResponse(
          res,
          `This charge is already ${line.billingStatus.replace('_', ' ')}. `
          + `Raise a credit note instead of changing ${attempted.join(', ')}.`,
          409,
        );
      }
    }

    const payload = { ...req.body };
    delete payload.id;
    delete payload.parentType;
    delete payload.parentId;

    const merged = { ...line.toJSON(), ...payload };
    const cargo = await cargoFor(line.parentType, line.parentId, merged.multimodalLineId);
    recalcLine(merged, cargo);
    await line.update(merged);
    await refreshParent(line.parentType, line.parentId);

    // A paired charge mirrors quantity and basis, so the cost and revenue
    // sides of one charge stay comparable on the job cost sheet.
    if (line.pairLineId && (payload.quantity !== undefined || payload.measurementBasis !== undefined)) {
      const pair = await ChargeLine.findByPk(line.pairLineId);
      if (pair && pair.billingStatus !== 'fully_billed' && pair.billingStatus !== 'fully_invoiced') {
        const pairMerged = {
          ...pair.toJSON(),
          quantity: merged.quantity,
          measurementBasis: merged.measurementBasis,
        };
        recalcLine(pairMerged, cargo);
        await pair.update(pairMerged);
        await refreshParent(pair.parentType, pair.parentId);
      }
    }

    const fresh = await ChargeLine.findByPk(line.id, { include: listInclude });
    return successResponse(res, fresh, 'Charge line updated');
  } catch (error) {
    next(error);
  }
};

// --- delete -----------------------------------------------------------------
exports.remove = async (req, res, next) => {
  try {
    const line = await ChargeLine.findByPk(req.params.id);
    if (!line) return errorResponse(res, 'Charge line not found', 404);
    if (line.billingStatus !== 'no') {
      return errorResponse(
        res,
        `This charge has already been ${line.billingStatus.replace('_', ' ')} and cannot be deleted. `
        + 'Raise a credit note instead.',
        409,
      );
    }
    const { parentType, parentId, pairLineId } = line;
    if (pairLineId) {
      // Clear the back-reference so the surviving side does not point at a
      // row that no longer exists.
      await ChargeLine.update({ pairLineId: null }, { where: { id: pairLineId } });
    }
    await line.destroy();
    await refreshParent(parentType, parentId);
    return successResponse(res, null, 'Charge line deleted');
  } catch (error) {
    next(error);
  }
};

// --- bulk re-price ----------------------------------------------------------
// Used after a shipment's weight or volume changes: every basis-driven charge
// on it gets its quantity and totals recomputed in one call.
exports.recalculate = async (req, res, next) => {
  try {
    const { parentType, parentId } = req.body;
    if (!PARENTS[parentType]) return errorResponse(res, 'Unknown parent type', 422);
    const { spec, record } = await loadParent(parentType, parentId);
    if (!record) return errorResponse(res, `${spec ? spec.label : 'Parent'} not found`, 404);

    const lines = await ChargeLine.findAll({ where: { parentType, parentId } });
    if (!lines.length) return errorResponse(res, 'This record has no charge lines yet', 404);

    const baseCargo = spec.cargo(record.toJSON());
    let repriced = 0;
    let skipped = 0;
    for (const line of lines) {
      if (line.billingStatus === 'fully_billed' || line.billingStatus === 'fully_invoiced') {
        skipped += 1;
        continue;
      }
      const cargo = line.multimodalLineId
        ? await cargoFor(parentType, parentId, line.multimodalLineId)
        : baseCargo;
      const merged = line.toJSON();
      recalcLine(merged, cargo);
      await line.update(merged);
      repriced += 1;
    }

    // Keep the parent's own chargeable figures in step with its cargo.
    if (baseCargo) {
      const figures = computeChargeable(baseCargo);
      const known = Object.keys(record.rawAttributes || {});
      const patch = {
        chargeableWeight: figures.chargeableWeight,
        chargeableBasis: figures.basis,
        weightVolume: figures.weightVolume,
        volumetricDivisor: figures.divisorUsed,
      };
      await record.update(
        Object.fromEntries(Object.entries(patch).filter(([k]) => known.includes(k))),
      );
    }

    const roll = await refreshParent(parentType, parentId);
    return successResponse(
      res,
      { repriced, skipped, totals: roll },
      skipped
        ? `${repriced} charge(s) repriced. ${skipped} already billed and left unchanged.`
        : `${repriced} charge(s) repriced.`,
    );
  } catch (error) {
    next(error);
  }
};

// --- copy a quote's charges onto a shipment or service job ------------------
// This is the handover from selling to operating: each 'both' quote line
// becomes a cost charge and a revenue charge, cross-linked to each other and
// back to the quote line they came from.
exports.copyFromQuote = async (req, res, next) => {
  try {
    const { quotationId, parentType, parentId, legId } = req.body;
    if (!['house_shipment', 'master_shipment', 'service_job'].includes(parentType)) {
      return errorResponse(res, 'Charges can only be copied onto a shipment or a service job', 422);
    }
    const quote = await Quotation.findByPk(quotationId);
    if (!quote) return errorResponse(res, 'Quotation not found', 404);
    const { spec, record } = await loadParent(parentType, parentId);
    if (!record) return errorResponse(res, `${spec ? spec.label : 'Target'} not found`, 404);

    const existing = await ChargeLine.count({ where: { parentType, parentId } });
    if (existing && !req.body.append) {
      return errorResponse(
        res,
        `This ${spec.label.toLowerCase()} already has ${existing} charge line(s). `
        + 'Pass append=true to add the quote charges alongside them.',
        409,
      );
    }

    const where = { parentType: 'quote', parentId: quotationId, isActive: true };
    // On a multimodal quote only the requested leg's charges are copied, so a
    // shipment created from the sea leg does not inherit the road charges.
    if (legId) where.multimodalLineId = legId;
    const quoteLines = await ChargeLine.findAll({ where, order: [['sequence', 'ASC']] });
    if (!quoteLines.length) {
      return errorResponse(res, 'That quotation has no charge lines to copy', 404);
    }

    const created = [];
    for (const ql of quoteLines) {
      const { cost, revenue } = splitQuoteLine(ql.toJSON(), {
        parentType,
        parentId,
        clientId: record.customerId || quote.customerId,
      });
      const costRow = await ChargeLine.create(cost);
      const revenueRow = await ChargeLine.create({ ...revenue, pairLineId: costRow.id });
      await costRow.update({ pairLineId: revenueRow.id });
      created.push(costRow, revenueRow);
    }

    const roll = await refreshParent(parentType, parentId);
    return successResponse(
      res,
      { created: created.length, totals: roll },
      `${quoteLines.length} quote charge(s) copied as ${created.length} cost and revenue charges`,
      201,
    );
  } catch (error) {
    next(error);
  }
};

// --- the job cost sheet -----------------------------------------------------
// Cost beside revenue for each charge, with the estimated and actual columns
// the Shipment Job Cost Sheet export shows.
exports.costSheet = async (req, res, next) => {
  try {
    const { parentType, parentId } = req.query;
    if (!PARENTS[parentType]) return errorResponse(res, 'Unknown parent type', 422);
    const { spec, record } = await loadParent(parentType, parentId);
    if (!record) return errorResponse(res, `${spec ? spec.label : 'Record'} not found`, 404);

    const lines = await ChargeLine.findAll({
      where: { parentType, parentId, isActive: true },
      include: listInclude,
      order: [['modeTypeSequence', 'ASC'], ['sequence', 'ASC']],
    });

    // Group by charge so cost and revenue for the same charge sit on one row.
    const byCharge = new Map();
    for (const l of lines) {
      const key = l.chargeCode || l.chargeDescription || l.id;
      if (!byCharge.has(key)) {
        byCharge.set(key, {
          chargeCode: l.chargeCode,
          chargeDescription: l.chargeDescription,
          measurementBasis: l.measurementBasis,
          quantity: Number(l.quantity),
          transportMode: l.transportMode,
          legSequence: l.modeTypeSequence,
          estimatedCost: 0, estimatedRevenue: 0,
          actualCost: 0, actualRevenue: 0,
          costStatus: null, revenueStatus: null,
          creditor: null, debtor: null,
        });
      }
      const row = byCharge.get(key);
      if (l.side === 'cost' || l.side === 'both') {
        row.estimatedCost += Number(l.totalCostAmountIncl) || Number(l.totalCostAmount) || 0;
        row.actualCost += Number(l.billedAmount) || 0;
        row.costStatus = l.billingStatus;
        row.creditor = l.creditor ? (l.creditor.companyName || l.creditor.name) : row.creditor;
      }
      if (l.side === 'revenue' || l.side === 'both') {
        row.estimatedRevenue += Number(l.totalSellAmountIncl) || Number(l.totalSellAmount) || 0;
        row.actualRevenue += Number(l.invoicedAmount) || 0;
        row.revenueStatus = l.billingStatus;
        row.debtor = l.debtor ? (l.debtor.companyName || l.debtor.name) : row.debtor;
      }
    }

    const rows = [...byCharge.values()].map((r) => ({
      ...r,
      estimatedCost: Number(r.estimatedCost.toFixed(2)),
      estimatedRevenue: Number(r.estimatedRevenue.toFixed(2)),
      actualCost: Number(r.actualCost.toFixed(2)),
      actualRevenue: Number(r.actualRevenue.toFixed(2)),
      estimatedMargin: Number((r.estimatedRevenue - r.estimatedCost).toFixed(2)),
      actualMargin: Number((r.actualRevenue - r.actualCost).toFixed(2)),
    }));

    const sum = (f) => Number(rows.reduce((s, r) => s + r[f], 0).toFixed(2));
    const totals = {
      estimatedRevenue: sum('estimatedRevenue'),
      estimatedCost: sum('estimatedCost'),
      estimatedMargin: sum('estimatedMargin'),
      actualRevenue: sum('actualRevenue'),
      actualCost: sum('actualCost'),
      actualMargin: sum('actualMargin'),
    };
    totals.estimatedMarginPercentage = totals.estimatedRevenue
      ? Number(((totals.estimatedMargin / totals.estimatedRevenue) * 100).toFixed(2))
      : 0;
    totals.actualMarginPercentage = totals.actualRevenue
      ? Number(((totals.actualMargin / totals.actualRevenue) * 100).toFixed(2))
      : 0;

    return successResponse(res, {
      reference: record.jobNumber || record.quoteNumber || record.masterShipmentNumber
        || record.shipmentNumber || record.name,
      parentType,
      parentId,
      currency: record.currency || 'AED',
      chargeableWeight: record.chargeableWeight,
      chargeableBasis: record.chargeableBasis,
      rows,
      totals,
    }, 'Cost sheet retrieved');
  } catch (error) {
    next(error);
  }
};
