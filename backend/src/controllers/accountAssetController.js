const { Op } = require('sequelize');
const { AccountAsset } = require('../models');
const { successResponse, errorResponse, getPagination } = require('../utils/helpers');

// Assets, Deferred Revenue and Deferred Expenses are one model split by type.
const TYPE_BY_MENU = {
  assets: 'purchase',
  'deferred-revenue': 'sale',
  'deferred-expenses': 'expense',
};

const TITLE_BY_MENU = {
  assets: 'Assets',
  'deferred-revenue': 'Deferred Revenue',
  'deferred-expenses': 'Deferred Expenses',
};

const withActions = (rec) => ({
  ...rec.toJSON(),
  availableActions: rec.availableActions(),
});

const orNull = (v) => (v === '' || v === undefined ? null : v);

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination({ ...req.query, limit: req.query.limit || 80 });
    const { menu, search, status } = req.query;

    const where = { assetType: TYPE_BY_MENU[menu] || 'purchase' };
    if (status) where.state = status.includes(',') ? { [Op.in]: status.split(',') } : status;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { partner: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await AccountAsset.findAndCountAll({
      where, limit, offset, order: [['acquisitionDate', 'DESC'], ['name', 'ASC']],
    });

    const totals = rows.reduce((a, r) => ({
      original: a.original + Number(r.original || 0),
      depreciated: a.depreciated + Number(r.depreciated || 0),
      bookValue: a.bookValue + Number(r.bookValue || 0),
    }), { original: 0, depreciated: 0, bookValue: 0 });

    return successResponse(res, {
      data: rows.map(withActions),
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
      totals,
      title: TITLE_BY_MENU[menu] || 'Assets',
    }, 'Assets');
  } catch (error) { return next(error); }
};

exports.getById = async (req, res, next) => {
  try {
    const rec = await AccountAsset.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Record not found', 404);
    return successResponse(res, withActions(rec), 'Asset');
  } catch (error) { return next(error); }
};

exports.create = async (req, res, next) => {
  try {
    const body = { ...req.body };
    for (const k of ['acquisitionDate', 'firstDepreciationDate']) body[k] = orNull(body[k]);
    body.assetType = TYPE_BY_MENU[req.query.menu] || body.assetType || 'purchase';
    body.bookValue = body.original;
    body.createdBy = req.user?.id || null;

    const rec = await AccountAsset.create(body);
    // The schedule follows from the value and duration, so build it on save.
    await rec.update({ depreciationLines: rec.buildSchedule() });
    return successResponse(res, withActions(rec), 'Asset created', 201);
  } catch (error) { return next(error); }
};

exports.update = async (req, res, next) => {
  try {
    const rec = await AccountAsset.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Record not found', 404);
    if (!rec.availableActions().edit) {
      return errorResponse(res, 'Only a draft record can be edited', 400);
    }
    const body = { ...req.body };
    for (const k of ['acquisitionDate', 'firstDepreciationDate']) body[k] = orNull(body[k]);
    await rec.update(body);
    await rec.update({ depreciationLines: rec.buildSchedule(), bookValue: rec.original });
    return successResponse(res, withActions(rec), 'Asset updated');
  } catch (error) { return next(error); }
};

// Each workflow button re-checks the same guard the form used, so a stale page
// cannot force an illegal transition.
const transition = (action, nextState, message) => async (req, res, next) => {
  try {
    const rec = await AccountAsset.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Record not found', 404);
    if (!rec.availableActions()[action]) {
      return errorResponse(res, `${message} is not available for this record`, 400);
    }
    const patch = { state: nextState };
    if (action === 'confirm' && !(rec.depreciationLines || []).length) {
      patch.depreciationLines = rec.buildSchedule();
    }
    await rec.update(patch);
    return successResponse(res, withActions(rec), `${message} done`);
  } catch (error) { return next(error); }
};

exports.confirm = transition('confirm', 'running', 'Confirm');
exports.pause = transition('pause', 'paused', 'Pause');
exports.resume = transition('resume', 'running', 'Resume');
exports.close = transition('close', 'close', 'Close');
exports.cancel = transition('cancel', 'cancel', 'Cancel');
exports.resetToDraft = transition('resetToDraft', 'draft', 'Reset to draft');

exports.remove = async (req, res, next) => {
  try {
    const rec = await AccountAsset.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Record not found', 404);
    if (rec.state !== 'draft') return errorResponse(res, 'Only a draft record can be deleted', 400);
    await rec.destroy();
    return successResponse(res, null, 'Asset deleted');
  } catch (error) { return next(error); }
};
