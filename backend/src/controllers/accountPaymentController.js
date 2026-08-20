const { Op, fn, col } = require('sequelize');
const { AccountPayment, AccountJournal, AccountMove } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');
const { companyWhere, defaultCompanyId } = require('../middleware/companyScope');

const actorName = (req) => req.user?.name || req.user?.email || 'Administrator';
const logEntry = (author, body, changes = []) => ({
  at: new Date().toISOString(), author, kind: 'log', body, changes,
});
const pushLog = (rec, e) => [e, ...(rec.activityLog || [])];

const normalise = (b) => {
  const o = { ...b };
  if (o.paymentDate === '') o.paymentDate = null;
  if (typeof o.invoiceNumbers === 'string') {
    o.invoiceNumbers = o.invoiceNumbers.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return o;
};

const withMeta = (rec) => ({ ...rec.toJSON(), actions: rec.availableActions() });

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination({ ...req.query, limit: req.query.limit || 80 });
    const { menu, paymentType, search, status, journal, method, partner, partnerId } = req.query;

    const where = {};
    // The Customers menu shows money in, the Vendors menu money out.
    where.paymentType = paymentType || (menu === 'vendor-payments' ? 'outbound' : 'inbound');
    if (status) where.state = status.includes(',') ? { [Op.in]: status.split(',') } : status;
    Object.assign(where, companyWhere(req));
    if (journal) where.journal = journal;
    if (method) where.paymentMethod = method;
    if (partner) where.partner = { [Op.like]: `%${partner}%` };
    // Drilling in from an Organization matches on the foreign key.
    if (partnerId) where.partnerId = partnerId;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { partner: { [Op.like]: `%${search}%` } },
        { memo: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await AccountPayment.findAndCountAll({
      where, order: [['paymentDate', 'DESC'], ['name', 'DESC']], limit, offset,
    });

    const pageTotal = rows.reduce((t, r) => t + Number(r.amount || 0), 0);
    return successResponse(res, rows, 'Records retrieved', 200, {
      ...getPaginationMeta(count, page, limit),
      totals: { amount: Math.round(pageTotal * 100) / 100 },
    });
  } catch (error) {
    next(error);
  }
};

// Journals / methods / statuses for the filter and group-by menus.
exports.getFacets = async (req, res, next) => {
  try {
    const paymentType = req.query.menu === 'vendor-payments' ? 'outbound' : 'inbound';
    const group = async (field) => (await AccountPayment.findAll({
      where: { paymentType },
      attributes: [[col(field), 'value'], [fn('COUNT', col('id')), 'count']],
      group: [col(field)], raw: true,
    })).filter((r) => r.value).map((r) => ({ value: r.value, count: Number(r.count) }));

    return successResponse(res, {
      journals: await group('journal'),
      methods: await group('paymentMethod'),
      states: await group('state'),
    }, 'Facets retrieved');
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const rec = await AccountPayment.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Record not found', 404);

    // Resolve the settled invoices so the form can link straight through.
    const nums = rec.invoiceNumbers || [];
    const invoices = nums.length
      ? await AccountMove.findAll({
        where: { name: { [Op.in]: nums } },
        attributes: ['id', 'name', 'moveType', 'amountTotal', 'amountResidual', 'state'],
        raw: true,
      })
      : [];
    return successResponse(res, { ...withMeta(rec), invoices }, 'Record retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const body = normalise(req.body);
    const journalName = body.journal || 'Bank';
    const journal = await AccountJournal.findOne({
      where: { [Op.or]: [{ name: journalName }, { bankAccNumber: journalName }] },
    });
    const rec = await AccountPayment.create({
      ...body,
      name: '/',
      state: 'draft',
      paymentType: body.paymentType || (req.query.menu === 'vendor-payments' ? 'outbound' : 'inbound'),
      journal: journalName,
      journalId: journal?.id || null,
      companyId: defaultCompanyId(req),
      createdBy: req.user?.id || null,
      activityLog: [logEntry(actorName(req), 'Payment Created')],
    });
    return successResponse(res, withMeta(rec), 'Record created', 201);
  } catch (error) {
    next(error);
  }
};

const TRACKED = {
  partner: 'Customer', paymentDate: 'Date', journal: 'Journal',
  paymentMethod: 'Payment Method', amount: 'Amount', memo: 'Memo',
};

exports.update = async (req, res, next) => {
  try {
    const rec = await AccountPayment.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Record not found', 404);
    if (!rec.availableActions().edit) {
      return errorResponse(res, 'Only a draft payment can be edited', 400);
    }
    const patch = normalise(req.body);
    const changes = Object.entries(TRACKED)
      .filter(([f]) => f in patch && String(patch[f] ?? '') !== String(rec[f] ?? ''))
      .map(([f, label]) => ({ field: label, from: rec[f] || '', to: patch[f] || '' }));

    const { state, name, activityLog, ...rest } = patch;
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
    const rec = await AccountPayment.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Record not found', 404);
    if (rec.state === 'posted') return errorResponse(res, 'A posted payment cannot be deleted', 400);
    await rec.destroy();
    return successResponse(res, null, 'Record deleted');
  } catch (error) {
    next(error);
  }
};

// Confirming numbers the payment from its journal's sequence, the way the
// demo does: <journal code>/<year>/<month>/<counter> for bank and cash.
exports.confirm = async (req, res, next) => {
  try {
    const rec = await AccountPayment.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Record not found', 404);
    if (!rec.availableActions().confirm) {
      return errorResponse(res, 'Only a draft payment can be confirmed', 400);
    }

    let name = rec.name;
    if (!name || name === '/') {
      const journal = rec.journalId ? await AccountJournal.findByPk(rec.journalId) : null;
      const code = journal?.code || (rec.journal || 'BNK').slice(0, 4).toUpperCase();
      const d = new Date(rec.paymentDate || Date.now());
      const prefix = `${code}/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/`;
      const last = await AccountPayment.count({ where: { name: { [Op.like]: `${prefix}%` } } });
      name = `${prefix}${String(last + 1).padStart(4, '0')}`;
    }

    await rec.update({
      name, state: 'posted',
      activityLog: pushLog(rec, logEntry(actorName(req), 'Payment Confirmed')),
    });

    // Settle whatever invoices this payment names.
    const nums = rec.invoiceNumbers || [];
    if (nums.length) {
      const moves = await AccountMove.findAll({ where: { name: { [Op.in]: nums }, state: 'posted' } });
      let left = Number(rec.amount || 0);
      for (const m of moves) {
        if (left <= 0) break;
        const residual = Number(m.amountResidual || 0);
        const applied = Math.min(residual, left);
        left -= applied;
        const nextResidual = Math.round((residual - applied) * 100) / 100;
        await m.update({
          amountResidual: nextResidual,
          paymentState: nextResidual <= 0 ? 'paid' : 'partial',
        });
      }
    }

    return successResponse(res, withMeta(rec), 'Payment confirmed');
  } catch (error) {
    next(error);
  }
};

exports.cancel = async (req, res, next) => {
  try {
    const rec = await AccountPayment.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Record not found', 404);
    if (!rec.availableActions().cancel) {
      return errorResponse(res, 'This payment cannot be cancelled', 400);
    }
    await rec.update({
      state: 'cancel',
      activityLog: pushLog(rec, logEntry(actorName(req), 'Payment Cancelled')),
    });
    return successResponse(res, withMeta(rec), 'Payment cancelled');
  } catch (error) {
    next(error);
  }
};

exports.resetToDraft = async (req, res, next) => {
  try {
    const rec = await AccountPayment.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Record not found', 404);
    if (!rec.availableActions().resetToDraft) {
      return errorResponse(res, 'This payment cannot be reset', 400);
    }
    await rec.update({
      state: 'draft',
      activityLog: pushLog(rec, logEntry(actorName(req), 'Reset To Draft')),
    });
    return successResponse(res, withMeta(rec), 'Payment reset to draft');
  } catch (error) {
    next(error);
  }
};

exports.addActivity = async (req, res, next) => {
  try {
    const rec = await AccountPayment.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Record not found', 404);
    const entry = { ...logEntry(actorName(req), req.body.body || ''), kind: req.body.kind || 'message' };
    await rec.update({ activityLog: pushLog(rec, entry) });
    return successResponse(res, entry, 'Activity logged', 201);
  } catch (error) {
    next(error);
  }
};
