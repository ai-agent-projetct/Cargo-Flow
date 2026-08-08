const { Op, fn, col } = require('sequelize');
const { ProFormaInvoice, AccountMove, AccountJournal } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');

const actorName = (req) => req.user?.name || req.user?.email || 'Administrator';
const logEntry = (author, body, changes = []) => ({
  at: new Date().toISOString(), author, kind: 'log', body, changes,
});
const pushLog = (rec, e) => [e, ...(rec.activityLog || [])];

const asList = (v) => {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
};

const normalise = (b) => {
  const o = { ...b };
  if ('serviceJobRefs' in o) o.serviceJobRefs = asList(o.serviceJobRefs);
  if ('houseShipmentRefs' in o) o.houseShipmentRefs = asList(o.houseShipmentRefs);
  return o;
};

const withMeta = (rec) => ({ ...rec.toJSON(), actions: rec.availableActions() });

// Recomputes taxes/total from the line grid so the header always agrees.
const totalsFor = (lines = []) => lines.reduce((t, l) => {
  const sub = Number(l.subtotal ?? (Number(l.quantity || 1) * Number(l.price || 0)));
  const vat = Number(l.vatAmount ?? (sub * (Number(l.taxRate || 0) / 100)));
  return { taxes: t.taxes + vat, total: t.total + sub + vat };
}, { taxes: 0, total: 0 });

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination({ ...req.query, limit: req.query.limit || 80 });
    const { search, status, customer, customerId } = req.query;

    const where = {};
    if (status) where.state = status.includes(',') ? { [Op.in]: status.split(',') } : status;
    if (customer) where.customer = { [Op.like]: `%${customer}%` };
    // Drilling in from an Organization matches on the foreign key.
    if (customerId) where.customerId = customerId;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { customer: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await ProFormaInvoice.findAndCountAll({
      where, order: [['name', 'DESC']], limit, offset,
    });

    const totals = rows.reduce((t, r) => ({
      taxes: t.taxes + Number(r.taxes || 0),
      total: t.total + Number(r.total || 0),
    }), { taxes: 0, total: 0 });

    return successResponse(res, rows, 'Records retrieved', 200, {
      ...getPaginationMeta(count, page, limit),
      totals: {
        taxes: Math.round(totals.taxes * 100) / 100,
        total: Math.round(totals.total * 100) / 100,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getFacets = async (req, res, next) => {
  try {
    const group = async (field) => (await ProFormaInvoice.findAll({
      attributes: [[col(field), 'value'], [fn('COUNT', col('id')), 'count']],
      group: [col(field)], raw: true,
    })).filter((r) => r.value).map((r) => ({ value: r.value, count: Number(r.count) }));

    return successResponse(res, {
      states: await group('state'),
      customers: (await group('customer')).slice(0, 50),
    }, 'Facets retrieved');
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const rec = await ProFormaInvoice.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Record not found', 404);
    return successResponse(res, withMeta(rec), 'Record retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const body = normalise(req.body);
    const year = new Date().getFullYear();
    const prefix = `PRO/${year}/`;
    // MAX+1 over the existing sequence — the demo's numbering has gaps.
    const last = await ProFormaInvoice.findOne({
      where: { name: { [Op.like]: `${prefix}%` } }, order: [['name', 'DESC']], raw: true,
    });
    const next$ = last ? Number(String(last.name).split('/').pop()) + 1 : 1;

    const t = totalsFor(body.lines || []);
    const rec = await ProFormaInvoice.create({
      ...body,
      name: `${prefix}${String(next$).padStart(5, '0')}`,
      state: 'to_approve',
      taxes: body.taxes ?? Math.round(t.taxes * 100) / 100,
      total: body.total ?? Math.round(t.total * 100) / 100,
      company: 'CargoFlo Logistics Ltd',
      createdBy: req.user?.id || null,
      activityLog: [logEntry(actorName(req), 'Pro Forma Invoice Created')],
    });
    return successResponse(res, withMeta(rec), 'Record created', 201);
  } catch (error) {
    next(error);
  }
};

const TRACKED = {
  customer: 'Customer', currency: 'Currency', taxes: 'Taxes', total: 'Total',
};

exports.update = async (req, res, next) => {
  try {
    const rec = await ProFormaInvoice.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Record not found', 404);
    if (!rec.availableActions().edit) {
      return errorResponse(res, 'Only a pro forma awaiting approval can be edited', 400);
    }
    const patch = normalise(req.body);
    if (patch.lines) {
      const t = totalsFor(patch.lines);
      patch.taxes = Math.round(t.taxes * 100) / 100;
      patch.total = Math.round(t.total * 100) / 100;
    }
    const changes = Object.entries(TRACKED)
      .filter(([f]) => f in patch && String(patch[f] ?? '') !== String(rec[f] ?? ''))
      .map(([f, label]) => ({ field: label, from: rec[f] || '', to: patch[f] || '' }));

    const { state, name, invoiceId, invoiceName, activityLog, ...rest } = patch;
    await rec.update({
      ...rest,
      ...(changes.length ? { activityLog: pushLog(rec, logEntry(actorName(req), '', changes)) } : {}),
    });
    return successResponse(res, withMeta(rec), 'Record updated');
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const rec = await ProFormaInvoice.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Record not found', 404);
    if (rec.invoiceId) return errorResponse(res, 'An invoiced pro forma cannot be deleted', 400);
    await rec.destroy();
    return successResponse(res, null, 'Record deleted');
  } catch (error) {
    next(error);
  }
};

exports.approve = async (req, res, next) => {
  try {
    const rec = await ProFormaInvoice.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Record not found', 404);
    if (!rec.availableActions().approve) {
      return errorResponse(res, 'This pro forma cannot be approved', 400);
    }
    await rec.update({
      state: 'approved',
      activityLog: pushLog(rec, logEntry(actorName(req), 'Pro Forma Approved')),
    });
    return successResponse(res, withMeta(rec), 'Pro forma approved');
  } catch (error) {
    next(error);
  }
};

// The interlink: an approved pro forma becomes a real customer invoice,
// carrying its lines and shipment references across.
exports.createInvoice = async (req, res, next) => {
  try {
    const rec = await ProFormaInvoice.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Record not found', 404);
    if (!rec.availableActions().createInvoice) {
      return errorResponse(res, rec.invoiceId
        ? 'An invoice has already been created from this pro forma'
        : 'Only an approved pro forma can be invoiced', 400);
    }

    const journal = await AccountJournal.findOne({ where: { name: 'Customer Invoices' } });
    const untaxed = Math.round((Number(rec.total || 0) - Number(rec.taxes || 0)) * 100) / 100;
    const today = new Date().toISOString().slice(0, 10);

    const invoice = await AccountMove.create({
      name: '/',
      moveType: 'out_invoice',
      state: 'draft',
      paymentState: 'not_paid',
      partner: rec.customer,
      partnerAddress: rec.customer,
      invoiceDate: today,
      journal: 'Customer Invoices',
      journalId: journal?.id || null,
      currency: rec.currency || 'AED',
      companyCurrency: rec.companyCurrency || 'AED',
      amountUntaxed: untaxed,
      amountTax: Number(rec.taxes || 0),
      amountTotal: Number(rec.total || 0),
      amountResidual: Number(rec.total || 0),
      addChargesFrom: (rec.houseShipmentRefs || []).length ? 'house' : null,
      chargeHouseShipments: rec.houseShipmentRefs || [],
      houseShipmentRefs: rec.houseShipmentRefs || [],
      serviceJobRefs: rec.serviceJobRefs || [],
      lines: rec.lines || [],
      ref: `Pro Forma: ${rec.name}`,
      company: rec.company || 'CargoFlo Logistics Ltd',
      createdBy: req.user?.id || null,
      followerCount: 1,
      activityLog: [logEntry(actorName(req), `Invoice created from ${rec.name}`)],
    });

    await rec.update({
      state: 'invoiced',
      invoiceId: invoice.id,
      invoiceName: invoice.name,
      activityLog: pushLog(rec, logEntry(actorName(req), 'Invoice Created')),
    });

    return successResponse(res, { ...withMeta(rec), invoice }, 'Invoice created', 201);
  } catch (error) {
    next(error);
  }
};

exports.cancel = async (req, res, next) => {
  try {
    const rec = await ProFormaInvoice.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Record not found', 404);
    if (!rec.availableActions().cancel) {
      return errorResponse(res, 'This pro forma cannot be cancelled', 400);
    }
    await rec.update({
      state: 'cancel',
      activityLog: pushLog(rec, logEntry(actorName(req), 'Pro Forma Cancelled')),
    });
    return successResponse(res, withMeta(rec), 'Pro forma cancelled');
  } catch (error) {
    next(error);
  }
};

exports.resetToDraft = async (req, res, next) => {
  try {
    const rec = await ProFormaInvoice.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Record not found', 404);
    if (!rec.availableActions().resetToDraft) {
      return errorResponse(res, 'This pro forma cannot be reset', 400);
    }
    await rec.update({
      state: 'to_approve',
      activityLog: pushLog(rec, logEntry(actorName(req), 'Reset To Draft')),
    });
    return successResponse(res, withMeta(rec), 'Pro forma reset');
  } catch (error) {
    next(error);
  }
};

exports.addActivity = async (req, res, next) => {
  try {
    const rec = await ProFormaInvoice.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Record not found', 404);
    const entry = { ...logEntry(actorName(req), req.body.body || ''), kind: req.body.kind || 'message' };
    await rec.update({ activityLog: pushLog(rec, entry) });
    return successResponse(res, entry, 'Activity logged', 201);
  } catch (error) {
    next(error);
  }
};
