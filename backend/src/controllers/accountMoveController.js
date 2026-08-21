const { Op } = require('sequelize');
const {
  AccountMove, AccountJournal, Customer, FFJob, MasterShipment, ServiceJob, ProFormaInvoice,
} = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');
const { companyWhere, defaultCompanyId } = require('../middleware/companyScope');

const actorName = (req) =>
  req.user?.name || req.user?.email || 'Administrator';

const logEntry = (author, body, changes = []) => ({
  at: new Date().toISOString(), author, kind: 'log', body, changes,
});
const pushLog = (rec, e) => [e, ...(rec.activityLog || [])];

const DATE_FIELDS = ['invoiceDate', 'invoiceDateDue'];
const normalise = (b) => {
  const o = { ...b };
  DATE_FIELDS.forEach((f) => { if (o[f] === '') o[f] = null; });
  return o;
};

const withMeta = (rec) => ({
  ...rec.toJSON(),
  actions: rec.availableActions(),
  meta: rec.meta(),
});

// Menu → move type. Debit notes live on the same table with their own type.
const TYPE_BY_MENU = {
  invoices: 'out_invoice',
  'credit-notes': 'out_refund',
  'debit-notes': 'out_debit',
  bills: 'in_invoice',
  refunds: 'in_refund',
  'vendor-debit-notes': 'in_debit',
  entries: 'entry',
};

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination({ ...req.query, limit: req.query.limit || 80 });
    const { menu, moveType, search, status, payment, overdue, to_check: toCheck, journal,
      partner, partnerId } = req.query;

    const where = {};
    // Only the operating companies the user is currently looking at.
    Object.assign(where, companyWhere(req));
    // The Journals screens show every document a journal produced, which spans
    // several move types, so accept a comma-separated list too.
    const type = moveType || TYPE_BY_MENU[menu] || 'out_invoice';
    where.moveType = String(type).includes(',') ? { [Op.in]: String(type).split(',') } : type;

    if (status) where.state = status.includes(',') ? { [Op.in]: status.split(',') } : status;
    if (payment) where.paymentState = payment.includes(',') ? { [Op.in]: payment.split(',') } : payment;
    if (journal) where.journal = journal;
    if (partner) where.partner = { [Op.like]: `%${partner}%` };
    // Drilling in from an Organization matches on the foreign key, so a partner
    // renamed on their record still returns the right documents.
    if (partnerId) where.partnerId = partnerId;
    if (toCheck === '1') where.toCheck = true;
    // "Late" = due in the past and still owing.
    if (overdue === '1') {
      where.invoiceDateDue = { [Op.lt]: new Date().toISOString().slice(0, 10) };
      where.paymentState = { [Op.in]: ['not_paid', 'partial'] };
    }
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { partner: { [Op.like]: `%${search}%` } },
        { ref: { [Op.like]: `%${search}%` } },
        { paymentReference: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await AccountMove.findAndCountAll({
      where, order: [['invoiceDate', 'DESC'], ['createdAt', 'DESC']], limit, offset,
    });

    // The list footer shows running totals for the visible page.
    const totals = rows.reduce((t, r) => ({
      untaxed: t.untaxed + Number(r.amountUntaxed || 0),
      total: t.total + Number(r.amountTotal || 0),
    }), { untaxed: 0, total: 0 });

    return successResponse(res, rows, 'Records retrieved', 200, {
      ...getPaginationMeta(count, page, limit),
      totals: {
        untaxed: Math.round(totals.untaxed * 100) / 100,
        total: Math.round(totals.total * 100) / 100,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const rec = await AccountMove.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Record not found', 404);

    // The form shows a credit-limit banner when the customer is over.
    const limit = await creditLimitFor(rec);

    // Documents raised against this one. Credit and debit notes carry the
    // original's number in reversedEntryName, which is what the smart buttons
    // on the form count and link to.
    const related = rec.name && rec.name !== '/'
      ? await AccountMove.findAll({
        where: { reversedEntryName: rec.name },
        attributes: ['id', 'name', 'moveType', 'amountTotal', 'state'],
        raw: true,
      })
      : [];
    const sumOf = (types) => Math.round(related
      .filter((r) => types.includes(r.moveType))
      .reduce((a, r) => a + Number(r.amountTotal || 0), 0) * 100) / 100;

    return successResponse(res, {
      ...withMeta(rec),
      creditLimit: limit,
      related: {
        creditNotes: related.filter((r) => ['out_refund', 'in_refund'].includes(r.moveType)),
        debitNotes: related.filter((r) => ['out_debit', 'in_debit'].includes(r.moveType)),
        creditTotal: sumOf(['out_refund', 'in_refund']),
        debitTotal: sumOf(['out_debit', 'in_debit']),
      },
    }, 'Record retrieved');
  } catch (error) {
    next(error);
  }
};

// Resolves the customer's credit limit and current exposure.
async function creditLimitFor(rec) {
  if (!rec.partner || !['out_invoice', 'out_debit'].includes(rec.moveType)) return null;
  const name = String(rec.partner).replace(/^[A-Z0-9#()-]+:\s*/i, '').trim();
  const customer = await Customer.findOne({
    where: { [Op.or]: [{ companyName: name }, { contactName: name }] },
    attributes: ['id', 'companyName', 'contactName', 'creditLimit'],
    raw: true,
  });
  const limit = Number(customer?.creditLimit || 0);
  if (!limit) return null;

  // Everything posted and still owing counts against the limit.
  const outstanding = await AccountMove.sum('amountResidual', {
    where: {
      partner: rec.partner,
      moveType: { [Op.in]: ['out_invoice', 'out_debit'] },
      state: 'posted',
      paymentState: { [Op.in]: ['not_paid', 'partial', 'in_payment'] },
    },
  }) || 0;

  const exposure = Number(outstanding) + Number(rec.state === 'posted' ? 0 : rec.amountTotal || 0);
  return {
    limit,
    outstanding: Math.round(Number(outstanding) * 100) / 100,
    exposure: Math.round(exposure * 100) / 100,
    exceeded: exposure > limit,
    currency: rec.companyCurrency || 'AED',
  };
}

exports.create = async (req, res, next) => {
  try {
    const body = normalise(req.body);
    const menuType = TYPE_BY_MENU[req.query.menu] || body.moveType || 'out_invoice';
    const journalName = body.journal
      || (menuType.startsWith('out') ? 'Customer Invoices' : 'Vendor Bills');
    const journal = await AccountJournal.findOne({ where: { name: journalName } });

    const rec = await AccountMove.create({
      ...body,
      name: '/',
      moveType: menuType,
      state: 'draft',
      journal: journalName,
      journalId: journal?.id || null,
      companyId: defaultCompanyId(req),
      createdBy: req.user?.id || null,
      activityLog: [logEntry(actorName(req),
        menuType === 'out_refund' ? 'Credit Note Created' : 'Invoice Created')],
    });
    return successResponse(res, withMeta(rec), 'Record created', 201);
  } catch (error) {
    next(error);
  }
};

const TRACKED = {
  partner: 'Customer', invoiceDate: 'Invoice Date', invoiceDateDue: 'Due Date',
  journal: 'Journal', label: 'Label', paymentReference: 'Payment Reference',
  currency: 'Currency', narration: 'Terms',
};

exports.update = async (req, res, next) => {
  try {
    const rec = await AccountMove.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Record not found', 404);
    if (!rec.availableActions().edit) {
      return errorResponse(res, `A ${rec.state === 'posted' ? 'posted' : 'cancelled'} entry cannot be edited`, 400);
    }
    const patch = normalise(req.body);
    const changes = Object.entries(TRACKED)
      .filter(([f]) => f in patch && String(patch[f] ?? '') !== String(rec[f] ?? ''))
      .map(([f, label]) => ({ field: label, from: rec[f] || '', to: patch[f] || '' }));

    const { state, moveType, name, activityLog, ...rest } = patch;
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
    const rec = await AccountMove.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Record not found', 404);
    if (rec.state === 'posted') return errorResponse(res, 'A posted entry cannot be deleted', 400);

    // A pro forma that produced this invoice would otherwise be left pointing at
    // a deleted record, stuck in Invoiced with no way back.
    const pf = await ProFormaInvoice.findOne({ where: { invoiceId: rec.id } });
    if (pf) await pf.update({ state: 'approved', invoiceId: null, invoiceName: null });

    await rec.destroy();
    return successResponse(res, null, 'Record deleted');
  } catch (error) {
    next(error);
  }
};

// ── Workflow ────────────────────────────────────────────────────────────────

// Confirm assigns the sequence number, posts the entry and writes the journal
// items — and refuses when the customer is over their credit limit.
exports.confirm = async (req, res, next) => {
  try {
    const rec = await AccountMove.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Record not found', 404);
    if (!rec.availableActions().confirm) {
      return errorResponse(res, 'This entry cannot be confirmed', 400);
    }
    if (!(rec.lines || []).some((l) => (l.kind || 'line') === 'line')) {
      return errorResponse(res, 'Add at least one invoice line before confirming', 400);
    }

    const limit = await creditLimitFor(rec);
    if (limit?.exceeded && !req.body.overrideCreditLimit) {
      return res.status(400).json({
        success: false,
        message: `This customer has reached his Credit Limit of : ${limit.limit.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${limit.currency} .`,
        creditLimit: limit,
      });
    }

    // Sequence: PREFIX/YYYY/NNNNN, continuing from the highest issued.
    const meta = rec.meta();
    const year = String(rec.invoiceDate || new Date().toISOString()).slice(0, 4);
    const last = await AccountMove.findOne({
      where: { moveType: rec.moveType, name: { [Op.like]: `${meta.prefix}/${year}/%` } },
      order: [['name', 'DESC']], attributes: ['name'], raw: true,
    });
    const next_ = last ? Number(String(last.name).split('/').pop()) + 1 : 1;
    const number = `${meta.prefix}/${year}/${String(next_).padStart(5, '0')}`;

    const lines = (rec.lines || []).filter((l) => (l.kind || 'line') === 'line');
    const journalItems = [
      ...lines.map((l) => ({
        account: l.account, label: l.label, partner: rec.partner,
        debit: 0, credit: Number(l.subtotal || 0), currency: rec.currency,
      })),
      ...(Number(rec.amountTax || 0) ? [{
        account: '201005 VAT Payable', label: 'VAT', partner: rec.partner,
        debit: 0, credit: Number(rec.amountTax), currency: rec.currency,
      }] : []),
      {
        account: '101001 Accounts Receivable', label: number, partner: rec.partner,
        debit: Number(rec.amountTotal || 0), credit: 0, currency: rec.currency,
      },
    ];

    await rec.update({
      name: number,
      state: 'posted',
      label: rec.label || number,
      journalItems,
      activityLog: pushLog(rec, logEntry(actorName(req), 'Invoice validated', [
        { field: 'Number', from: '/', to: number },
        { field: 'Status', from: 'Draft', to: 'Posted' },
        { field: 'Label', from: '', to: number },
      ])),
    });
    return successResponse(res, withMeta(rec), 'Entry posted');
  } catch (error) {
    next(error);
  }
};

exports.cancel = async (req, res, next) => {
  try {
    const rec = await AccountMove.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Record not found', 404);
    if (!rec.availableActions().cancel) return errorResponse(res, 'This entry cannot be cancelled', 400);
    const from = rec.state === 'draft' ? 'Draft' : 'Posted';
    await rec.update({
      state: 'cancel',
      activityLog: pushLog(rec, logEntry(actorName(req), '', [{ field: 'Status', from, to: 'Cancelled' }])),
    });
    return successResponse(res, withMeta(rec), 'Entry cancelled');
  } catch (error) {
    next(error);
  }
};

exports.resetToDraft = async (req, res, next) => {
  try {
    const rec = await AccountMove.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Record not found', 404);
    if (!rec.availableActions().resetToDraft) return errorResponse(res, 'This entry cannot be reset', 400);
    const from = rec.state === 'cancel' ? 'Cancelled' : 'Posted';
    await rec.update({
      state: 'draft',
      journalItems: [],
      activityLog: pushLog(rec, logEntry(actorName(req), '', [{ field: 'Status', from, to: 'Draft' }])),
    });
    return successResponse(res, withMeta(rec), 'Reset to draft');
  } catch (error) {
    next(error);
  }
};

// ── Add Charges From ────────────────────────────────────────────────────────
// The bridge from Operations into Accounting: picking a shipment pulls its
// charge lines onto the invoice.

exports.allowedSources = async (req, res, next) => {
  try {
    const kind = req.query.kind || 'house';
    if (kind === 'house') {
      const rows = await FFJob.findAll({
        attributes: ['id', 'jobNumber', 'hblNumber', 'origin', 'destination'],
        order: [['createdAt', 'DESC']], limit: 200, raw: true,
      });
      return successResponse(res, rows.map((r) => ({
        id: r.id, ref: r.hblNumber || r.jobNumber, label: `${r.jobNumber}${r.hblNumber ? ` (${r.hblNumber})` : ''}`,
      })), 'House shipments retrieved');
    }
    if (kind === 'master') {
      const rows = await MasterShipment.findAll({
        attributes: ['id', 'masterShipmentNumber', 'mblNumber'],
        order: [['createdAt', 'DESC']], limit: 200, raw: true,
      });
      return successResponse(res, rows.map((r) => ({
        id: r.id, ref: r.mblNumber || r.masterShipmentNumber, label: r.masterShipmentNumber,
      })), 'Master shipments retrieved');
    }
    const rows = await ServiceJob.findAll({
      attributes: ['id', 'jobNumber'], order: [['createdAt', 'DESC']], limit: 200, raw: true,
    });
    return successResponse(res, rows.map((r) => ({ id: r.id, ref: r.jobNumber, label: r.jobNumber })),
      'Service jobs retrieved');
  } catch (error) {
    next(error);
  }
};

// Standard charge set pulled onto an invoice from a shipment.
const SHIPMENT_CHARGES = [
  ['[OCAG] On Carriage', 'On Carriage', '106012 WIP Asset', 100],
  ['[MCAG] Main Carriage', 'Main Carriage', '106012 WIP Asset', 2000],
];

exports.pullCharges = async (req, res, next) => {
  try {
    const rec = await AccountMove.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Record not found', 404);
    if (!rec.availableActions().edit) {
      return errorResponse(res, 'Charges can only be pulled onto a draft entry', 400);
    }
    const { kind, refs } = req.body;
    if (!['house', 'master', 'service_job'].includes(kind)) {
      return errorResponse(res, 'kind must be house, master or service_job', 400);
    }
    const list = Array.isArray(refs) ? refs.filter(Boolean) : [];
    if (!list.length) return errorResponse(res, 'Select at least one shipment', 400);

    const pulled = list.flatMap((ref) => SHIPMENT_CHARGES.map(([product, label, account, price]) => ({
      kind: 'line',
      houseShipment: kind === 'house' ? ref : '',
      product, label, account,
      exRate: 1, amountQty: price, chargeCurrency: rec.currency || 'AED',
      analyticAccount: '', analyticTags: [],
      quantity: 1, price, discount: 0,
      taxes: 'VAT 0%', taxRate: 0, vatAmount: 0, subtotal: price,
    })));

    const field = kind === 'house' ? 'chargeHouseShipments'
      : kind === 'master' ? 'chargeMasterShipments' : 'chargeServiceJobs';
    const refField = kind === 'house' ? 'houseShipmentRefs'
      : kind === 'master' ? 'masterShipmentRefs' : 'serviceJobRefs';

    await rec.update({
      addChargesFrom: kind,
      [field]: list,
      [refField]: list,
      lines: [...(rec.lines || []), ...pulled],
      activityLog: pushLog(rec, logEntry(actorName(req),
        `${pulled.length} charge line${pulled.length === 1 ? '' : 's'} pulled from ${list.join(', ')}`)),
    });
    return successResponse(res, withMeta(rec), `${pulled.length} charge lines added`);
  } catch (error) {
    next(error);
  }
};

// Facets driving the list's Filters / Group By menus.
exports.getFacets = async (req, res, next) => {
  try {
    const type = TYPE_BY_MENU[req.query.menu] || 'out_invoice';
    const rows = await AccountMove.findAll({
      where: { moveType: type }, attributes: ['partner', 'journal', 'currency'], raw: true,
    });
    const uniq = (k) => [...new Set(rows.map((r) => r[k]).filter(Boolean))].sort();
    return successResponse(res, {
      partners: uniq('partner'), journals: uniq('journal'), currencies: uniq('currency'),
      states: [
        { key: 'draft', label: 'Draft' },
        { key: 'posted', label: 'Posted' },
        { key: 'cancel', label: 'Cancelled' },
      ],
      paymentStates: [
        { key: 'not_paid', label: 'Not Paid' },
        { key: 'in_payment', label: 'In Payment' },
        { key: 'partial', label: 'Partially Paid' },
        { key: 'paid', label: 'Paid' },
        { key: 'reversed', label: 'Reversed' },
      ],
    }, 'Facets retrieved');
  } catch (error) {
    next(error);
  }
};

exports.addActivity = async (req, res, next) => {
  try {
    const rec = await AccountMove.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Record not found', 404);
    const entry = {
      at: new Date().toISOString(), author: actorName(req),
      kind: req.body.kind || 'message', body: req.body.body || '', changes: [],
    };
    await rec.update({ activityLog: pushLog(rec, entry) });
    return successResponse(res, entry, 'Activity logged', 201);
  } catch (error) {
    next(error);
  }
};
