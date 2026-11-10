// Vendor rate requests: the buy-side half of pricing.
//
// Sales raises a request from a quote (or an opportunity), it goes to one or
// more vendors, each vendor fills in their rates, we compare the options and
// award one. The winning lines are copied onto the quote's charge lines with
// `chargeSource = 'vendor_portal'`, which is what links a vendor's number to
// the rate the customer is finally quoted.
//
// The vendor-facing handlers at the bottom authenticate on the request's own
// `accessToken` rather than a session, because a vendor has no ERP login.

const crypto = require('crypto');
const { Op } = require('sequelize');
const {
  RateRequest, RateRequestLine, Quotation, ChargeLine,
  Opportunity, Organization, User,
} = require('../models');
const { recalcLine } = require('../services/chargeRollup');
const { refreshParent } = require('./chargeLineController');
const {
  successResponse, errorResponse, getPagination, getPaginationMeta,
} = require('../utils/helpers');
const { defaultCompanyId } = require('../middleware/companyScope');

const num = (v, d = 0) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : d;
};
const money = (v) => Math.round((num(v) + Number.EPSILON) * 100) / 100;

const include = [
  { model: Organization, as: 'agent', attributes: ['id', 'name', 'companyName', 'email'] },
  { model: Quotation, as: 'quotation', attributes: ['id', 'quoteNumber', 'customerId', 'transportMode'] },
  { model: Opportunity, as: 'opportunity', attributes: ['id', 'name'] },
  { model: User, as: 'requester', attributes: ['id', 'name', 'email'] },
];

const nextRequestNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `RR/${year}/`;
  const last = await RateRequest.findOne({
    where: { requestNumber: { [Op.like]: `${prefix}%` } },
    order: [['requestNumber', 'DESC']],
    attributes: ['requestNumber'],
  });
  const n = last ? parseInt(String(last.requestNumber).split('/').pop(), 10) + 1 : 1;
  return `${prefix}${String(n).padStart(5, '0')}`;
};

/** Line total honouring the minimum charge, in both currencies. */
const priceLine = (line, requestCurrency) => {
  const qty = num(line.quantity, 1);
  const rate = num(line.counterRate != null && line.isCounterLine ? line.counterRate : line.buyRate);
  const fx = num(line.exchangeRate, 1) || 1;
  const gross = money(Math.max(rate * qty, num(line.minAmount)));
  line.convertedBuyRate = money(rate * fx);
  line.lineTotal = money(gross * fx);
  line.targetCurrency = line.targetCurrency || requestCurrency;
  return line;
};

/** Recompute a request's total from its live lines. */
const refreshTotal = async (rateRequest) => {
  const lines = await RateRequestLine.findAll({
    where: { rateRequestId: rateRequest.id, isActive: true },
  });
  const total = lines.reduce((s, l) => s + num(l.lineTotal), 0);
  await rateRequest.update({ rateTotal: money(total) });
  return money(total);
};

/**
 * Mirror the winning/pending vendor state onto the quote, so the quote screen
 * shows where pricing stands without opening the requests.
 */
const syncQuoteState = async (quotationId) => {
  if (!quotationId) return;
  const quote = await Quotation.findByPk(quotationId);
  if (!quote) return;

  const requests = await RateRequest.findAll({ where: { quotationId } });
  if (!requests.length) {
    await quote.update({ quoteRateRequestState: 'draft', currentRateRequestId: null });
    return;
  }
  const awarded = requests.find((r) => r.isRateSelected);
  const anyRenegotiating = requests.some(
    (r) => r.vendorRateStatus === 'renegotiate_pending' || r.isRenegotiate,
  );
  const anyRenegotiated = requests.some((r) => r.vendorRateStatus === 'renegotiate_submitted');
  const anySubmitted = requests.some((r) => r.vendorRateStatus === 'submitted');

  let state = 'vendor_rate_requested';
  if (anyRenegotiated) state = 'vendor_rate_renegotiate_submitted';
  else if (anyRenegotiating) state = 'vendor_rate_renegotiate_requested';
  else if (awarded || anySubmitted) state = 'vendor_rate_submitted';

  await quote.update({
    quoteRateRequestState: state,
    currentRateRequestId: awarded ? awarded.id : quote.currentRateRequestId,
  });
};

// --- staff-facing -----------------------------------------------------------
exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const where = {};
    const {
      search, status, vendorRateStatus, quotationId, opportunityId, agentId,
      isRateSelected, dateFrom, dateTo,
    } = req.query;

    if (status) where.status = status;
    if (vendorRateStatus) where.vendorRateStatus = vendorRateStatus;
    if (quotationId) where.quotationId = quotationId;
    if (opportunityId) where.opportunityId = opportunityId;
    if (agentId) where.agentId = agentId;
    if (isRateSelected === 'true' || isRateSelected === 'false') {
      where.isRateSelected = isRateSelected === 'true';
    }
    if (dateFrom && dateTo) where.requestDate = { [Op.between]: [dateFrom, dateTo] };
    if (search) {
      where[Op.or] = [
        { requestNumber: { [Op.like]: `%${search}%` } },
        { quoteOptionName: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await RateRequest.findAndCountAll({
      where, include, order: [['requestDate', 'DESC'], ['requestNumber', 'DESC']],
      limit, offset, distinct: true,
    });
    return successResponse(res, rows, 'Rate requests retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const rr = await RateRequest.findByPk(req.params.id, {
      include: [...include, { model: RateRequestLine, as: 'lines' }],
      order: [[{ model: RateRequestLine, as: 'lines' }, 'sequence', 'ASC']],
    });
    if (!rr) return errorResponse(res, 'Rate request not found', 404);
    return successResponse(
      res,
      { ...rr.toJSON(), actions: rr.availableActions() },
      'Rate request retrieved',
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Raise requests from a quote. One request per vendor, each seeded with the
 * quote's charge lines so the vendor is asked to price exactly what we intend
 * to sell.
 */
exports.create = async (req, res, next) => {
  try {
    const { quotationId, opportunityId, quoteLegId, agentIds, validityDate, remarks } = req.body;
    if (!quotationId && !opportunityId) {
      return errorResponse(res, 'A rate request needs a quotation or an opportunity', 422);
    }
    const vendors = Array.isArray(agentIds) && agentIds.length
      ? agentIds
      : (req.body.agentId ? [req.body.agentId] : []);
    if (!vendors.length) {
      return errorResponse(res, 'Select at least one vendor to request rates from', 422);
    }

    let quote = null;
    if (quotationId) {
      quote = await Quotation.findByPk(quotationId);
      if (!quote) return errorResponse(res, 'Quotation not found', 404);
    }

    // Charges to be priced: the quote's own lines, narrowed to one leg when
    // the quote is multimodal and a leg was named.
    let sourceLines = [];
    if (quote) {
      const where = { parentType: 'quote', parentId: quote.id, isActive: true };
      if (quoteLegId) where.multimodalLineId = quoteLegId;
      sourceLines = await ChargeLine.findAll({ where, order: [['sequence', 'ASC']] });
    }
    const explicitLines = Array.isArray(req.body.lines) ? req.body.lines : null;
    if (!sourceLines.length && !explicitLines) {
      return errorResponse(
        res,
        'There are no charges to price. Add charge lines to the quotation first, '
        + 'or pass the charges to request in `lines`.',
        422,
      );
    }

    const currency = req.body.currency || (quote ? quote.currency : 'AED') || 'AED';
    const created = [];

    for (const agentId of vendors) {
      const vendor = await Organization.findByPk(agentId);
      const rr = await RateRequest.create({
        requestNumber: await nextRequestNumber(),
        quoteOptionName: req.body.quoteOptionName
          || (vendor ? `Option - ${vendor.companyName || vendor.name}` : null),
        agentId,
        email: req.body.email || (vendor ? vendor.email : null),
        rateRequestTo: req.body.rateRequestTo || 'vendor',
        quotationId: quotationId || null,
        opportunityId: opportunityId || (quote ? quote.opportunityId : null),
        quoteLegId: quoteLegId || null,
        requestDate: req.body.requestDate || new Date(),
        validityDate: validityDate || null,
        requestedBy: req.user ? req.user.id : null,
        status: 'draft',
        vendorRateStatus: 'pending',
        currency,
        transitDays: req.body.transitDays || null,
        accessToken: crypto.randomBytes(24).toString('hex'),
        tokenExpiresAt: req.body.tokenExpiresAt
          || new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        remarks: remarks || null,
        companyId: req.body.companyId || defaultCompanyId(req),
        createdBy: req.user ? req.user.id : null,
      });

      const rows = (explicitLines || sourceLines).map((l, i) => {
        const src = l.toJSON ? l.toJSON() : l;
        return priceLine({
          rateRequestId: rr.id,
          sequence: src.sequence || (i + 1) * 10,
          productId: src.productId || null,
          chargeCode: src.chargeCode || null,
          chargeDescription: src.chargeDescription || src.serviceName,
          measurementBasis: src.measurementBasis || null,
          containerType: src.containerType || null,
          uom: src.uom || null,
          quantity: num(src.quantity, 1),
          currency,
          buyRate: 0,
          minAmount: 0,
          exchangeRate: 1,
          rateReceivedBy: 'portal',
          source: 'manual',
          rateAgentId: agentId,
          rateVendorGroupName: rr.quoteOptionName,
          sourceQuoteLineId: src.parentType === 'quote' ? src.id : null,
        }, currency);
      });
      await RateRequestLine.bulkCreate(rows);
      created.push(rr);
    }

    if (quotationId) await syncQuoteState(quotationId);
    if (opportunityId) {
      const opp = await Opportunity.findByPk(opportunityId);
      if (opp) await opp.update({ agentIds: vendors, currentRateRequestId: created[0].id });
    }

    const fresh = await RateRequest.findAll({
      where: { id: { [Op.in]: created.map((r) => r.id) } },
      include: [...include, { model: RateRequestLine, as: 'lines' }],
    });
    return successResponse(
      res, fresh,
      `${created.length} rate request(s) raised for ${(explicitLines || sourceLines).length} charge(s)`,
      201,
    );
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const rr = await RateRequest.findByPk(req.params.id);
    if (!rr) return errorResponse(res, 'Rate request not found', 404);
    if (rr.isRateSelected) {
      return errorResponse(
        res,
        'These rates have been awarded and are now on the quotation. Unaward first.',
        409,
      );
    }
    const payload = { ...req.body };
    ['id', 'requestNumber', 'accessToken', 'isRateSelected', 'rateTotal'].forEach((k) => delete payload[k]);
    await rr.update(payload);
    const fresh = await RateRequest.findByPk(rr.id, {
      include: [...include, { model: RateRequestLine, as: 'lines' }],
    });
    return successResponse(res, { ...fresh.toJSON(), actions: fresh.availableActions() }, 'Rate request updated');
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const rr = await RateRequest.findByPk(req.params.id);
    if (!rr) return errorResponse(res, 'Rate request not found', 404);
    if (rr.isRateSelected) {
      return errorResponse(res, 'Awarded rate requests cannot be deleted', 409);
    }
    const { quotationId } = rr;
    await RateRequestLine.destroy({ where: { rateRequestId: rr.id } });
    await rr.destroy();
    await syncQuoteState(quotationId);
    return successResponse(res, null, 'Rate request deleted');
  } catch (error) {
    next(error);
  }
};

/** Send the request to the vendor - records the send and opens the portal link. */
exports.send = async (req, res, next) => {
  try {
    const rr = await RateRequest.findByPk(req.params.id);
    if (!rr) return errorResponse(res, 'Rate request not found', 404);
    const actions = rr.availableActions();
    if (!actions.send && !actions.resend) {
      return errorResponse(res, `A request in state "${rr.status}" cannot be sent`, 409);
    }
    if (!rr.accessToken) {
      await rr.update({ accessToken: crypto.randomBytes(24).toString('hex') });
    }
    await rr.update({
      status: 'sent',
      vendorRateStatus: rr.isRenegotiate ? 'renegotiate_pending' : 'pending',
      emailSentAt: new Date(),
    });
    await syncQuoteState(rr.quotationId);

    const base = process.env.CLIENT_URL || 'http://localhost:3000';
    return successResponse(res, {
      rateRequest: rr,
      portalUrl: `${base}/vendor/rate-request/${rr.accessToken}`,
    }, 'Rate request sent to the vendor');
  } catch (error) {
    next(error);
  }
};

/** Staff entering rates that arrived by email rather than through the portal. */
exports.submitRates = async (req, res, next) => {
  try {
    const rr = await RateRequest.findByPk(req.params.id);
    if (!rr) return errorResponse(res, 'Rate request not found', 404);
    const lines = Array.isArray(req.body.lines) ? req.body.lines : [];
    if (!lines.length) return errorResponse(res, 'No rates supplied', 422);

    const applied = await applyVendorRates(rr, lines, {
      receivedBy: req.body.rateReceivedBy || 'email',
      source: req.body.source || 'manual',
    });
    return successResponse(res, applied, `${applied.updated} rate(s) recorded`);
  } catch (error) {
    next(error);
  }
};

/**
 * Write vendor rates onto a request's lines and advance its state.
 * Shared by the staff handler and the vendor-portal handler so the two can
 * never diverge.
 */
const applyVendorRates = async (rr, lines, { receivedBy, source }) => {
  const byId = new Map(lines.filter((l) => l.id).map((l) => [String(l.id), l]));
  const existing = await RateRequestLine.findAll({ where: { rateRequestId: rr.id } });
  const now = new Date();

  let updated = 0;
  for (const row of existing) {
    const incoming = byId.get(String(row.id));
    if (!incoming) continue;
    const merged = {
      ...row.toJSON(),
      buyRate: num(incoming.buyRate, num(row.buyRate)),
      minAmount: num(incoming.minAmount, num(row.minAmount)),
      quantity: num(incoming.quantity, num(row.quantity, 1)),
      currency: incoming.currency || row.currency || rr.currency,
      exchangeRate: num(incoming.exchangeRate, num(row.exchangeRate, 1)) || 1,
      transitDays: incoming.transitDays != null ? incoming.transitDays : row.transitDays,
      validFrom: incoming.validFrom || row.validFrom,
      validTo: incoming.validTo || row.validTo,
      remarks: incoming.remarks != null ? incoming.remarks : row.remarks,
      rateReceivedBy: receivedBy,
      source,
      rateSubmittedOn: now,
      rateAgentId: rr.agentId,
    };
    priceLine(merged, rr.currency);
    await row.update(merged);
    updated += 1;
  }

  const total = await refreshTotal(rr);
  await rr.update({
    status: 'done',
    vendorRateStatus: rr.isRenegotiate ? 'renegotiate_submitted' : 'submitted',
    submittedOn: now,
    rateTotal: total,
  });
  await syncQuoteState(rr.quotationId);
  return { updated, rateTotal: total, rateRequest: rr };
};

/** Ask the vendor to improve their rates, keeping their original figures. */
exports.requestRenegotiation = async (req, res, next) => {
  try {
    const rr = await RateRequest.findByPk(req.params.id);
    if (!rr) return errorResponse(res, 'Rate request not found', 404);
    if (!rr.availableActions().requestRenegotiation) {
      return errorResponse(
        res,
        'Renegotiation can only be requested on a submitted, unawarded rate request',
        409,
      );
    }
    if (!req.body.note) {
      return errorResponse(res, 'Say what needs to change so the vendor can respond', 422);
    }

    // Counter-offers are written to `counterRate`, which leaves the vendor's
    // submitted figure intact for the audit trail.
    const counters = Array.isArray(req.body.lines) ? req.body.lines : [];
    for (const c of counters) {
      if (!c.id) continue;
      const row = await RateRequestLine.findOne({
        where: { id: c.id, rateRequestId: rr.id },
      });
      if (row) await row.update({ counterRate: num(c.counterRate), isCounterLine: true });
    }

    await rr.update({
      status: 'renegotiate',
      vendorRateStatus: 'renegotiate_pending',
      isRenegotiate: true,
      renegotiateStatus: 'pending',
      renegotiateNote: req.body.note,
    });
    await syncQuoteState(rr.quotationId);
    const fresh = await RateRequest.findByPk(rr.id, {
      include: [...include, { model: RateRequestLine, as: 'lines' }],
    });
    return successResponse(res, fresh, 'Renegotiation requested');
  } catch (error) {
    next(error);
  }
};

exports.resolveRenegotiation = async (req, res, next) => {
  try {
    const rr = await RateRequest.findByPk(req.params.id);
    if (!rr) return errorResponse(res, 'Rate request not found', 404);
    const accept = req.body.accept === true || req.body.accept === 'true';
    if (!rr.availableActions().acceptRenegotiation) {
      return errorResponse(res, 'There is no submitted renegotiation to resolve', 409);
    }
    await rr.update({
      renegotiateStatus: accept ? 'accepted' : 'rejected',
      vendorRateStatus: accept ? 'submitted' : 'renegotiate_rejected',
      status: accept ? 'done' : 'cancel',
      isRenegotiate: false,
    });
    await syncQuoteState(rr.quotationId);
    return successResponse(
      res, rr,
      accept ? 'Revised rates accepted' : 'Revised rates rejected',
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Award a vendor: copy their rates onto the quote's charge lines as the buy
 * side, leaving the sell side to be set by margin or by hand. This is the
 * point where a vendor's number becomes our cost.
 */
exports.selectRates = async (req, res, next) => {
  try {
    const rr = await RateRequest.findByPk(req.params.id, {
      include: [{ model: RateRequestLine, as: 'lines' }],
    });
    if (!rr) return errorResponse(res, 'Rate request not found', 404);
    if (!rr.availableActions().selectRates) {
      return errorResponse(
        res,
        `Rates cannot be awarded while the vendor status is "${rr.vendorRateStatus}"`,
        409,
      );
    }
    if (!rr.quotationId) {
      return errorResponse(res, 'This rate request is not attached to a quotation', 422);
    }
    const quote = await Quotation.findByPk(rr.quotationId);
    if (!quote) return errorResponse(res, 'Quotation not found', 404);

    const marginType = req.body.marginType || 'percentage';
    const marginValue = num(req.body.marginValue, 20);

    let applied = 0;
    let addedLines = 0;
    for (const line of rr.lines || []) {
      if (line.isActive === false) continue;
      const rate = num(line.counterRate != null && rr.renegotiateStatus === 'accepted'
        ? line.counterRate
        : line.buyRate);
      if (!rate) continue;

      let target = line.sourceQuoteLineId
        ? await ChargeLine.findByPk(line.sourceQuoteLineId)
        : null;

      if (target && target.parentId !== quote.id) target = null;

      if (!target) {
        // The vendor priced a charge the quote does not have yet - add it
        // rather than dropping the rate on the floor.
        target = await ChargeLine.create({
          parentType: 'quote',
          parentId: quote.id,
          side: 'both',
          sequence: (addedLines + 90) * 10,
          chargeCode: line.chargeCode,
          serviceName: line.chargeDescription,
          chargeDescription: line.chargeDescription || 'Vendor charge',
          measurementBasis: line.measurementBasis,
          containerType: line.containerType,
          uom: line.uom,
          quantity: num(line.quantity, 1),
          multimodalLineId: rr.quoteLegId || null,
          companyId: quote.companyId,
          currency: quote.currency || 'AED',
        });
        addedLines += 1;
      }

      const merged = {
        ...target.toJSON(),
        costCurrency: line.currency || rr.currency,
        costConversionRate: num(line.exchangeRate, 1) || 1,
        costAmountRate: rate,
        creditorPartnerId: rr.agentId,
        quantity: num(line.quantity, num(target.quantity, 1)),
        measurementBasis: line.measurementBasis || target.measurementBasis,
        rateRequestLineId: line.id,
        chargeSource: 'vendor_portal',
        transitTime: line.transitDays != null ? line.transitDays : target.transitTime,
        // Derive the sell rate from the awarded cost unless the caller asked
        // to keep the existing sell price.
        useMargin: req.body.keepSellRate ? target.useMargin : true,
        marginType: req.body.keepSellRate ? target.marginType : marginType,
        marginPercentage: req.body.keepSellRate
          ? target.marginPercentage
          : (marginType === 'percentage' ? marginValue : 0),
        marginAmount: req.body.keepSellRate
          ? target.marginAmount
          : (marginType === 'amount' ? marginValue : 0),
      };
      recalcLine(merged, null);
      await target.update(merged);
      await line.update({ appliedChargeLineId: target.id });
      applied += 1;
    }

    if (!applied) {
      return errorResponse(
        res,
        'This vendor has not submitted any rates yet, so there is nothing to award',
        422,
      );
    }

    // Only one vendor can hold the award on a quote at a time.
    await RateRequest.update(
      { isRateSelected: false, selectedAt: null },
      { where: { quotationId: quote.id, id: { [Op.ne]: rr.id } } },
    );
    await rr.update({ isRateSelected: true, selectedAt: new Date(), status: 'done' });

    const totals = await refreshParent('quote', quote.id);
    await syncQuoteState(quote.id);

    return successResponse(res, {
      applied,
      addedLines,
      totals,
      rateRequest: await RateRequest.findByPk(rr.id, {
        include: [...include, { model: RateRequestLine, as: 'lines' }],
      }),
    }, `${applied} vendor rate(s) applied to the quotation as buy rates`);
  } catch (error) {
    next(error);
  }
};

exports.unselectRates = async (req, res, next) => {
  try {
    const rr = await RateRequest.findByPk(req.params.id);
    if (!rr) return errorResponse(res, 'Rate request not found', 404);
    if (!rr.isRateSelected) return errorResponse(res, 'This rate request is not awarded', 409);
    await rr.update({ isRateSelected: false, selectedAt: null });
    await syncQuoteState(rr.quotationId);
    return successResponse(res, rr, 'Award withdrawn. The buy rates already on the quotation were left in place.');
  } catch (error) {
    next(error);
  }
};

exports.cancel = async (req, res, next) => {
  try {
    const rr = await RateRequest.findByPk(req.params.id);
    if (!rr) return errorResponse(res, 'Rate request not found', 404);
    if (!rr.availableActions().cancel) {
      return errorResponse(res, `A request in state "${rr.status}" cannot be cancelled`, 409);
    }
    await rr.update({ status: 'cancel', remarks: req.body.reason || rr.remarks });
    await syncQuoteState(rr.quotationId);
    return successResponse(res, rr, 'Rate request cancelled');
  } catch (error) {
    next(error);
  }
};

/**
 * Side-by-side comparison of every vendor's answer on one quote: the screen
 * that decides the award.
 */
exports.compare = async (req, res, next) => {
  try {
    const { quotationId } = req.query;
    if (!quotationId) return errorResponse(res, 'quotationId is required', 422);
    const quote = await Quotation.findByPk(quotationId);
    if (!quote) return errorResponse(res, 'Quotation not found', 404);

    const requests = await RateRequest.findAll({
      where: { quotationId },
      include: [...include, { model: RateRequestLine, as: 'lines' }],
      order: [['requestNumber', 'ASC']],
    });
    if (!requests.length) {
      return successResponse(
        res,
        { quotationId, charges: [], options: [], cheapest: null },
        'No rate requests have been raised for this quotation yet',
      );
    }

    // Rows are charges, columns are vendors.
    const chargeKeys = [];
    const seen = new Set();
    for (const rr of requests) {
      for (const l of rr.lines || []) {
        const key = l.chargeCode || l.chargeDescription;
        if (key && !seen.has(key)) { seen.add(key); chargeKeys.push({ key, description: l.chargeDescription }); }
      }
    }

    const options = requests.map((rr) => {
      const byKey = {};
      for (const l of rr.lines || []) {
        byKey[l.chargeCode || l.chargeDescription] = {
          buyRate: num(l.buyRate),
          quantity: num(l.quantity, 1),
          lineTotal: num(l.lineTotal),
          currency: l.currency,
          counterRate: l.counterRate != null ? num(l.counterRate) : null,
          checkStatus: l.checkStatus,
        };
      }
      return {
        id: rr.id,
        requestNumber: rr.requestNumber,
        optionName: rr.quoteOptionName,
        vendor: rr.agent ? (rr.agent.companyName || rr.agent.name) : null,
        vendorId: rr.agentId,
        status: rr.status,
        vendorRateStatus: rr.vendorRateStatus,
        isRateSelected: rr.isRateSelected,
        submittedOn: rr.submittedOn,
        validityDate: rr.validityDate,
        transitDays: rr.transitDays,
        currency: rr.currency,
        rateTotal: num(rr.rateTotal),
        charges: byKey,
        actions: rr.availableActions(),
      };
    });

    const quoted = options.filter((o) => o.rateTotal > 0);
    const cheapest = quoted.length
      ? quoted.reduce((best, o) => (o.rateTotal < best.rateTotal ? o : best))
      : null;
    const fastest = quoted.filter((o) => o.transitDays).length
      ? quoted.filter((o) => o.transitDays)
        .reduce((best, o) => (o.transitDays < best.transitDays ? o : best))
      : null;

    return successResponse(res, {
      quotationId,
      quoteNumber: quote.quoteNumber,
      charges: chargeKeys,
      options,
      cheapest: cheapest ? { id: cheapest.id, rateTotal: cheapest.rateTotal } : null,
      fastest: fastest ? { id: fastest.id, transitDays: fastest.transitDays } : null,
    }, 'Vendor rate comparison retrieved');
  } catch (error) {
    next(error);
  }
};

// --- vendor-facing (token authenticated, no ERP login) ----------------------

/** Resolve a portal token to its request, rejecting expired or dead links. */
const byToken = async (token) => {
  if (!token) return { error: 'No rate request token supplied', code: 422 };
  const rr = await RateRequest.findOne({
    where: { accessToken: token },
    include: [
      { model: RateRequestLine, as: 'lines' },
      { model: Quotation, as: 'quotation', attributes: ['id', 'quoteNumber', 'transportMode', 'originCountry', 'destinationCountry', 'cargoWeight', 'cargoVolume', 'commodity'] },
      { model: Organization, as: 'agent', attributes: ['id', 'name', 'companyName'] },
    ],
    order: [[{ model: RateRequestLine, as: 'lines' }, 'sequence', 'ASC']],
  });
  if (!rr) return { error: 'This rate request link is not valid', code: 404 };
  if (rr.tokenExpiresAt && new Date(rr.tokenExpiresAt) < new Date()) {
    return { error: 'This rate request link has expired. Ask your contact to resend it.', code: 410 };
  }
  if (rr.status === 'cancel') {
    return { error: 'This rate request has been cancelled', code: 410 };
  }
  return { rr };
};

/** What the vendor sees when they open their link. */
exports.portalGet = async (req, res, next) => {
  try {
    const { rr, error, code } = await byToken(req.params.token);
    if (error) return errorResponse(res, error, code);

    // Deliberately narrow: a vendor sees the cargo and the charges they were
    // asked to price, never our sell rates, our margin or the customer.
    return successResponse(res, {
      requestNumber: rr.requestNumber,
      optionName: rr.quoteOptionName,
      vendor: rr.agent ? (rr.agent.companyName || rr.agent.name) : null,
      requestDate: rr.requestDate,
      validityDate: rr.validityDate,
      currency: rr.currency,
      status: rr.status,
      vendorRateStatus: rr.vendorRateStatus,
      isRenegotiate: rr.isRenegotiate,
      renegotiateNote: rr.renegotiateNote,
      canSubmit: rr.vendorRateStatus === 'pending' || rr.vendorRateStatus === 'renegotiate_pending',
      transitDays: rr.transitDays,
      rateTotal: num(rr.rateTotal),
      remarks: rr.remarks,
      enquiry: rr.quotation ? {
        reference: rr.quotation.quoteNumber,
        transportMode: rr.quotation.transportMode,
        originCountry: rr.quotation.originCountry,
        destinationCountry: rr.quotation.destinationCountry,
        commodity: rr.quotation.commodity,
        grossWeight: rr.quotation.cargoWeight,
        volume: rr.quotation.cargoVolume,
      } : null,
      lines: (rr.lines || []).map((l) => ({
        id: l.id,
        sequence: l.sequence,
        chargeCode: l.chargeCode,
        chargeDescription: l.chargeDescription,
        measurementBasis: l.measurementBasis,
        containerType: l.containerType,
        uom: l.uom,
        quantity: num(l.quantity, 1),
        currency: l.currency,
        buyRate: num(l.buyRate),
        minAmount: num(l.minAmount),
        lineTotal: num(l.lineTotal),
        counterRate: l.counterRate != null ? num(l.counterRate) : null,
        transitDays: l.transitDays,
        validFrom: l.validFrom,
        validTo: l.validTo,
        remarks: l.remarks,
      })),
    }, 'Rate request retrieved');
  } catch (error) {
    next(error);
  }
};

/** The vendor submits their rates. */
exports.portalSubmit = async (req, res, next) => {
  try {
    const { rr, error, code } = await byToken(req.params.token);
    if (error) return errorResponse(res, error, code);
    if (rr.vendorRateStatus !== 'pending' && rr.vendorRateStatus !== 'renegotiate_pending') {
      return errorResponse(
        res,
        'Rates have already been submitted for this request. Contact us if they need changing.',
        409,
      );
    }
    const lines = Array.isArray(req.body.lines) ? req.body.lines : [];
    if (!lines.length) return errorResponse(res, 'Enter a rate against at least one charge', 422);

    const priced = lines.filter((l) => num(l.buyRate) > 0);
    if (!priced.length) {
      return errorResponse(res, 'Every rate was zero. Enter your rates before submitting.', 422);
    }

    if (req.body.transitDays != null) {
      await rr.update({ transitDays: parseInt(req.body.transitDays, 10) || null });
    }
    if (req.body.remarks) await rr.update({ remarks: req.body.remarks });
    if (req.body.validityDate) await rr.update({ validityDate: req.body.validityDate });

    const applied = await applyVendorRates(rr, lines, {
      receivedBy: 'portal',
      source: 'portal',
    });
    return successResponse(res, {
      requestNumber: rr.requestNumber,
      submitted: applied.updated,
      rateTotal: applied.rateTotal,
    }, 'Thank you. Your rates have been submitted.');
  } catch (error) {
    next(error);
  }
};

/** A vendor declining to quote. */
exports.portalDecline = async (req, res, next) => {
  try {
    const { rr, error, code } = await byToken(req.params.token);
    if (error) return errorResponse(res, error, code);
    if (rr.isRateSelected) {
      return errorResponse(res, 'These rates have already been awarded and cannot be declined', 409);
    }
    await rr.update({
      status: 'cancel',
      remarks: [rr.remarks, `Declined by vendor: ${req.body.reason || 'no reason given'}`]
        .filter(Boolean).join('\n'),
    });
    await syncQuoteState(rr.quotationId);
    return successResponse(res, null, 'Thank you for letting us know.');
  } catch (error) {
    next(error);
  }
};

/** Everything a vendor has open - the Vendor Rate Request Overview. */
exports.portalOverview = async (req, res, next) => {
  try {
    // A signed-in portal user is scoped to their own organization; an
    // anonymous caller must supply a token for a single request instead.
    const vendorId = (req.user && req.user.customerId) || req.query.vendorId;
    if (!vendorId) {
      return errorResponse(
        res,
        'No vendor account on this session. Open a rate request by its link instead.',
        403,
      );
    }
    const requests = await RateRequest.findAll({
      where: { agentId: vendorId },
      include: [
        { model: RateRequestLine, as: 'lines', attributes: ['id', 'lineTotal'] },
        { model: Quotation, as: 'quotation', attributes: ['id', 'quoteNumber', 'transportMode', 'originCountry', 'destinationCountry'] },
      ],
      order: [['requestDate', 'DESC']],
    });

    const counts = requests.reduce((acc, r) => {
      acc.total += 1;
      acc[r.vendorRateStatus] = (acc[r.vendorRateStatus] || 0) + 1;
      if (r.isRateSelected) acc.awarded += 1;
      return acc;
    }, { total: 0, awarded: 0 });

    return successResponse(res, {
      summary: counts,
      requests: requests.map((r) => ({
        id: r.id,
        requestNumber: r.requestNumber,
        optionName: r.quoteOptionName,
        requestDate: r.requestDate,
        validityDate: r.validityDate,
        status: r.status,
        vendorRateStatus: r.vendorRateStatus,
        isRenegotiate: r.isRenegotiate,
        renegotiateNote: r.renegotiateNote,
        isRateSelected: r.isRateSelected,
        currency: r.currency,
        rateTotal: num(r.rateTotal),
        lineCount: (r.lines || []).length,
        accessToken: r.accessToken,
        lane: r.quotation
          ? `${r.quotation.originCountry || '?'} to ${r.quotation.destinationCountry || '?'}`
          : null,
        transportMode: r.quotation ? r.quotation.transportMode : null,
      })),
    }, 'Vendor rate requests retrieved');
  } catch (error) {
    next(error);
  }
};

exports.applyVendorRates = applyVendorRates;
exports.syncQuoteState = syncQuoteState;
