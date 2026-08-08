const { Op } = require('sequelize');
const { AccountJournal } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');

// Each dashboard card carries its own action map so the UI never re-derives
// which buttons a journal type offers.
const asCard = (j) => ({ ...j.toJSON(), actions: j.cardActions() });

exports.dashboard = async (req, res, next) => {
  try {
    const rows = await AccountJournal.findAll({
      where: { active: true },
      order: [['sequence', 'ASC'], ['name', 'ASC']],
    });
    const cards = rows.map(asCard);

    // Totals across the sale/purchase cards, which is what the top of the
    // Accounting dashboard summarises.
    const sum = (k, types) => cards
      .filter((c) => types.includes(c.type))
      .reduce((t, c) => t + Number(c[k] || 0), 0);

    return successResponse(res, {
      cards,
      summary: {
        toValidate: sum('toValidateAmount', ['sale']),
        unpaid: sum('unpaidAmount', ['sale']),
        late: sum('lateAmount', ['sale']),
        billsToPay: sum('unpaidAmount', ['purchase']),
        journalCount: cards.length,
      },
    }, 'Dashboard retrieved');
  } catch (error) {
    next(error);
  }
};

exports.getAll = async (req, res, next) => {
  try {
    const { type, search } = req.query;
    const where = { active: true };
    if (type) where.type = type.includes(',') ? { [Op.in]: type.split(',') } : type;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { code: { [Op.like]: `%${search}%` } },
        { bankAccNumber: { [Op.like]: `%${search}%` } },
      ];
    }
    const rows = await AccountJournal.findAll({ where, order: [['sequence', 'ASC']] });
    return successResponse(res, rows.map(asCard), 'Journals retrieved');
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const rec = await AccountJournal.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Journal not found', 404);
    return successResponse(res, asCard(rec), 'Journal retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const rec = await AccountJournal.create(req.body);
    return successResponse(res, asCard(rec), 'Journal created', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const rec = await AccountJournal.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Journal not found', 404);
    await rec.update(req.body);
    return successResponse(res, asCard(rec), 'Journal updated');
  } catch (error) {
    next(error);
  }
};

// "Connect" on a bank card — links the feed so the card starts offering
// reconciliation instead.
exports.connect = async (req, res, next) => {
  try {
    const rec = await AccountJournal.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Journal not found', 404);
    if (rec.type !== 'bank') return errorResponse(res, 'Only bank journals can be connected', 400);
    await rec.update({ isConnected: true });
    return successResponse(res, asCard(rec), 'Bank feed connected');
  } catch (error) {
    next(error);
  }
};

// "Reconcile N Items" — clears the queue and folds it into the GL balance.
exports.reconcile = async (req, res, next) => {
  try {
    const rec = await AccountJournal.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Journal not found', 404);
    if (!rec.cardActions().reconcile) {
      return errorResponse(res, 'This journal has nothing to reconcile', 400);
    }
    const cleared = rec.toReconcile;
    await rec.update({
      toReconcile: 0,
      latestStatement: rec.balanceGl,
      outstandingAmount: 0,
    });
    return successResponse(res, { journal: asCard(rec), cleared },
      `${cleared} item${cleared === 1 ? '' : 's'} reconciled`);
  } catch (error) {
    next(error);
  }
};

module.exports.asCard = asCard;
