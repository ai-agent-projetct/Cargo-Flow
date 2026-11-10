// Post-dated cheques (Accounting > Post Dated Cheque (PDC) > PDC Payments).
//
// A PDC must not touch the bank ledger when it is received, because the money
// is not there yet. The lifecycle is registered -> deposited -> done, with
// returned and bounced as the failure exits. Only `done` creates the payment
// that settles invoices, which is what keeps a drawer of post-dated cheques
// out of the cash position.

const { Op, fn, col } = require('sequelize');
const {
  PdcPayment, AccountPayment, AccountJournal, AccountMove, Organization,
} = require('../models');
const {
  successResponse, errorResponse, getPagination, getPaginationMeta,
} = require('../utils/helpers');
const { companyWhere, defaultCompanyId } = require('../middleware/companyScope');

const num = (v, d = 0) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : d;
};
const money = (v) => Math.round((num(v) + Number.EPSILON) * 100) / 100;

const include = [
  { model: Organization, as: 'partner', attributes: ['id', 'name', 'companyName'] },
  { model: AccountJournal, as: 'journal', attributes: ['id', 'name', 'code', 'type'] },
];

const nextName = async () => {
  const year = new Date().getFullYear();
  const prefix = `PDC/${year}/`;
  const last = await PdcPayment.findOne({
    where: { name: { [Op.like]: `${prefix}%` } },
    order: [['name', 'DESC']],
    attributes: ['name'],
  });
  const n = last ? parseInt(String(last.name).split('/').pop(), 10) + 1 : 1;
  return `${prefix}${String(n).padStart(5, '0')}`;
};

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const where = { ...companyWhere(req) };
    const {
      search, state, paymentType, partnerId, journalId, dateFrom, dateTo,
      dueFrom, dueTo, isReconciled,
    } = req.query;

    if (state) {
      where.state = String(state).includes(',') ? { [Op.in]: String(state).split(',') } : state;
    }
    if (paymentType) where.paymentType = paymentType;
    if (partnerId) where.partnerId = partnerId;
    if (journalId) where.journalId = journalId;
    if (isReconciled === 'true' || isReconciled === 'false') {
      where.isReconciled = isReconciled === 'true';
    }
    if (dateFrom && dateTo) where.date = { [Op.between]: [dateFrom, dateTo] };
    // The cheque date is what matters for a maturity view, so it filters
    // separately from the date the cheque was taken in.
    if (dueFrom && dueTo) where.paymentDate = { [Op.between]: [dueFrom, dueTo] };
    else if (dueFrom) where.paymentDate = { [Op.gte]: dueFrom };
    else if (dueTo) where.paymentDate = { [Op.lte]: dueTo };

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { chequeRef: { [Op.like]: `%${search}%` } },
        { bankName: { [Op.like]: `%${search}%` } },
        { memo: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await PdcPayment.findAndCountAll({
      where, include, order: [['paymentDate', 'ASC'], ['name', 'ASC']],
      limit, offset, distinct: true,
    });

    // Totals by state, because the point of this screen is knowing how much
    // is held, how much is in the bank and how much has bounced.
    const byState = await PdcPayment.findAll({
      where: { ...companyWhere(req) },
      attributes: [
        'state', 'paymentType',
        [fn('COUNT', col('id')), 'count'],
        [fn('SUM', col('amount')), 'amount'],
      ],
      group: ['state', 'paymentType'],
      raw: true,
    });

    const today = new Date().toISOString().slice(0, 10);
    const matured = await PdcPayment.count({
      where: {
        ...companyWhere(req),
        state: { [Op.in]: ['registered', 'deposited'] },
        paymentDate: { [Op.lte]: today },
      },
    });

    return successResponse(res, {
      payments: rows.map((p) => ({ ...p.toJSON(), actions: p.availableActions() })),
      summary: {
        byState: byState.map((r) => ({
          state: r.state,
          paymentType: r.paymentType,
          count: Number(r.count),
          amount: money(r.amount),
        })),
        maturedAwaitingClearance: matured,
      },
    }, 'PDC payments retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const pdc = await PdcPayment.findByPk(req.params.id, { include });
    if (!pdc) return errorResponse(res, 'PDC not found', 404);

    // Resolve the invoices this cheque is set against, so the form can list
    // them rather than showing bare ids.
    const ids = Array.isArray(pdc.moveIds) ? pdc.moveIds : [];
    const moves = ids.length
      ? await AccountMove.findAll({
        where: { id: { [Op.in]: ids } },
        attributes: ['id', 'name', 'moveType', 'amountTotal', 'amountResidual', 'invoiceDate'],
      })
      : [];

    return successResponse(res, {
      ...pdc.toJSON(),
      moves,
      actions: pdc.availableActions(),
    }, 'PDC retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    if (!req.body.journalId) return errorResponse(res, 'Choose the bank journal the cheque will be banked into', 422);
    if (!req.body.paymentDate) return errorResponse(res, 'Enter the date written on the cheque', 422);
    if (num(req.body.amount) <= 0) return errorResponse(res, 'The cheque amount must be greater than zero', 422);

    const journal = await AccountJournal.findByPk(req.body.journalId);
    if (!journal) return errorResponse(res, 'Journal not found', 422);

    const pdc = await PdcPayment.create({
      ...req.body,
      name: req.body.name || (await nextName()),
      state: 'registered',
      companyId: req.body.companyId || defaultCompanyId(req),
      createdBy: req.user ? req.user.id : null,
    });
    const fresh = await PdcPayment.findByPk(pdc.id, { include });
    return successResponse(
      res,
      { ...fresh.toJSON(), actions: fresh.availableActions() },
      'PDC registered. It will not affect the bank balance until it clears.',
      201,
    );
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const pdc = await PdcPayment.findByPk(req.params.id);
    if (!pdc) return errorResponse(res, 'PDC not found', 404);
    if (pdc.state === 'done') {
      return errorResponse(
        res,
        'This cheque has cleared and its payment is posted. Reverse the payment to change it.',
        409,
      );
    }
    const payload = { ...req.body };
    ['id', 'name', 'state', 'paymentId', 'isReconciled'].forEach((k) => delete payload[k]);
    await pdc.update(payload);
    const fresh = await PdcPayment.findByPk(pdc.id, { include });
    return successResponse(res, { ...fresh.toJSON(), actions: fresh.availableActions() }, 'PDC updated');
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const pdc = await PdcPayment.findByPk(req.params.id);
    if (!pdc) return errorResponse(res, 'PDC not found', 404);
    if (pdc.state !== 'registered') {
      return errorResponse(
        res,
        `A ${pdc.state} cheque cannot be deleted. Mark it returned instead so the history is kept.`,
        409,
      );
    }
    await pdc.destroy();
    return successResponse(res, null, 'PDC deleted');
  } catch (error) {
    next(error);
  }
};

/**
 * Deposit the cheque at the bank. Allowed only on or after the cheque date -
 * banking a post-dated cheque early is the mistake this guard exists to stop.
 */
exports.deposit = async (req, res, next) => {
  try {
    const pdc = await PdcPayment.findByPk(req.params.id);
    if (!pdc) return errorResponse(res, 'PDC not found', 404);
    if (!pdc.availableActions().deposit) {
      return errorResponse(res, `A ${pdc.state} cheque cannot be deposited`, 409);
    }

    const today = new Date().toISOString().slice(0, 10);
    const chequeDate = String(pdc.paymentDate).slice(0, 10);
    if (chequeDate > today && !req.body.force) {
      return errorResponse(
        res,
        `This cheque is dated ${chequeDate} and cannot be banked before then. `
        + 'Pass force=true only if the drawer has confirmed in writing.',
        409,
      );
    }

    await pdc.update({
      state: 'deposited',
      memo: req.body.memo || pdc.memo,
    });
    const fresh = await PdcPayment.findByPk(pdc.id, { include });
    return successResponse(
      res,
      { ...fresh.toJSON(), actions: fresh.availableActions() },
      'Cheque deposited. It still does not count as cleared funds.',
    );
  } catch (error) {
    next(error);
  }
};

/**
 * The cheque cleared. This is the only transition that creates money: an
 * AccountPayment is posted and the cheque is marked reconciled.
 */
exports.markCleared = async (req, res, next) => {
  try {
    const pdc = await PdcPayment.findByPk(req.params.id, { include });
    if (!pdc) return errorResponse(res, 'PDC not found', 404);
    if (!pdc.availableActions().markCleared) {
      return errorResponse(
        res,
        `Only a deposited cheque can clear. This one is ${pdc.state}.`,
        409,
      );
    }

    const clearingDate = req.body.clearingDate || new Date().toISOString().slice(0, 10);
    const moveIds = Array.isArray(pdc.moveIds) ? pdc.moveIds : [];
    const settled = moveIds.length
      ? await AccountMove.findAll({ where: { id: { [Op.in]: moveIds } }, attributes: ['name'] })
      : [];

    // AccountPayment stores the journal and partner as names alongside the
    // ids, the way the rest of the accounting screens read them.
    const payment = await AccountPayment.create({
      paymentType: pdc.paymentType === 'outbound' ? 'outbound' : 'inbound',
      paymentDate: clearingDate,
      partnerId: pdc.partnerId,
      partner: pdc.partner ? (pdc.partner.companyName || pdc.partner.name) : null,
      journalId: pdc.journalId,
      journal: pdc.journal ? pdc.journal.name : null,
      paymentMethod: 'Cheque',
      amount: pdc.amount,
      currency: pdc.currency || 'AED',
      invoiceNumbers: settled.map((m) => m.name).filter(Boolean),
      memo: `Post-dated cheque ${pdc.name}`
        + (pdc.chequeRef ? ` (cheque ${pdc.chequeRef})` : ''),
      state: 'posted',
      createdBy: req.user ? req.user.id : null,
    });

    await pdc.update({
      state: 'done',
      clearingDate,
      paymentId: payment.id,
      isReconciled: true,
    });

    const fresh = await PdcPayment.findByPk(pdc.id, { include });
    return successResponse(res, {
      ...fresh.toJSON(),
      payment,
      actions: fresh.availableActions(),
    }, `Cheque cleared. Payment ${payment.id} posted for ${money(pdc.amount)} ${pdc.currency}.`);
  } catch (error) {
    next(error);
  }
};

/** The cheque bounced. No payment is created; a bank charge may be recorded. */
exports.markBounced = async (req, res, next) => {
  try {
    const pdc = await PdcPayment.findByPk(req.params.id);
    if (!pdc) return errorResponse(res, 'PDC not found', 404);
    if (!pdc.availableActions().markBounced) {
      return errorResponse(
        res,
        `Only a deposited cheque can bounce. This one is ${pdc.state}.`,
        409,
      );
    }
    if (!req.body.reason) {
      return errorResponse(res, 'Record why the cheque bounced', 422);
    }
    await pdc.update({
      state: 'bounced',
      bounceReason: req.body.reason,
      bounceCharge: money(req.body.bounceCharge),
      isReconciled: false,
    });
    const fresh = await PdcPayment.findByPk(pdc.id, { include });
    return successResponse(
      res,
      { ...fresh.toJSON(), actions: fresh.availableActions() },
      'Cheque marked bounced. The invoices it was set against remain open.',
    );
  } catch (error) {
    next(error);
  }
};

/** The cheque was handed back, usually replaced by another. */
exports.markReturned = async (req, res, next) => {
  try {
    const pdc = await PdcPayment.findByPk(req.params.id);
    if (!pdc) return errorResponse(res, 'PDC not found', 404);
    if (!pdc.availableActions().markReturned) {
      return errorResponse(res, `A ${pdc.state} cheque cannot be returned`, 409);
    }
    await pdc.update({
      state: 'returned',
      memo: [pdc.memo, req.body.reason].filter(Boolean).join('\n'),
      isReconciled: false,
    });
    const fresh = await PdcPayment.findByPk(pdc.id, { include });
    return successResponse(res, { ...fresh.toJSON(), actions: fresh.availableActions() }, 'Cheque marked returned');
  } catch (error) {
    next(error);
  }
};

/** Put a bounced or returned cheque back in play, e.g. on re-presentation. */
exports.reopen = async (req, res, next) => {
  try {
    const pdc = await PdcPayment.findByPk(req.params.id);
    if (!pdc) return errorResponse(res, 'PDC not found', 404);
    if (!pdc.availableActions().reopen) {
      return errorResponse(res, `A ${pdc.state} cheque cannot be reopened`, 409);
    }
    await pdc.update({
      state: 'registered',
      bounceReason: null,
      clearingDate: null,
      isReconciled: false,
      paymentDate: req.body.paymentDate || pdc.paymentDate,
    });
    const fresh = await PdcPayment.findByPk(pdc.id, { include });
    return successResponse(
      res,
      { ...fresh.toJSON(), actions: fresh.availableActions() },
      'Cheque reopened and registered again',
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Cheques grouped by maturity: what is overdue for banking, due this week,
 * and due later. This is the view the collections desk works from.
 */
exports.maturitySchedule = async (req, res, next) => {
  try {
    const today = new Date();
    const iso = (d) => d.toISOString().slice(0, 10);
    const week = new Date(today); week.setDate(week.getDate() + 7);
    const month = new Date(today); month.setDate(month.getDate() + 30);

    const open = await PdcPayment.findAll({
      where: {
        ...companyWhere(req),
        state: { [Op.in]: ['registered', 'deposited'] },
      },
      include,
      order: [['paymentDate', 'ASC']],
    });

    const bucket = (p) => {
      const d = String(p.paymentDate).slice(0, 10);
      if (d < iso(today)) return 'overdue';
      if (d <= iso(week)) return 'dueThisWeek';
      if (d <= iso(month)) return 'dueThisMonth';
      return 'later';
    };

    const buckets = { overdue: [], dueThisWeek: [], dueThisMonth: [], later: [] };
    for (const p of open) buckets[bucket(p)].push(p);

    const summarise = (rows) => ({
      count: rows.length,
      amount: money(rows.reduce((s, r) => s + num(r.amount), 0)),
      inbound: money(rows.filter((r) => r.paymentType === 'inbound')
        .reduce((s, r) => s + num(r.amount), 0)),
      outbound: money(rows.filter((r) => r.paymentType === 'outbound')
        .reduce((s, r) => s + num(r.amount), 0)),
      payments: rows.map((r) => ({ ...r.toJSON(), actions: r.availableActions() })),
    });

    return successResponse(res, {
      asOf: iso(today),
      overdue: summarise(buckets.overdue),
      dueThisWeek: summarise(buckets.dueThisWeek),
      dueThisMonth: summarise(buckets.dueThisMonth),
      later: summarise(buckets.later),
    }, 'PDC maturity schedule retrieved');
  } catch (error) {
    next(error);
  }
};
