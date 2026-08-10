const { Op } = require('sequelize');
const models = require('../models');
const { BY_ID, CONFIGS } = require('../services/configRegistry');
const { successResponse, errorResponse, getPagination } = require('../utils/helpers');

const { ConfigItem } = models;

const spec = (id) => BY_ID[id];

// A leaf either reads a real model or the shared config_items table.
const modelFor = (cfg) => (cfg.backing === 'model' ? models[cfg.modelName] : ConfigItem);

const scopeFor = (cfg) => (cfg.backing === 'model' ? {} : { category: cfg.category });

exports.list = async (req, res, next) => {
  try {
    return successResponse(res, CONFIGS.map((c) => ({ id: c.id, title: c.title })), 'Configuration');
  } catch (error) { return next(error); }
};

exports.getAll = async (req, res, next) => {
  try {
    const cfg = spec(req.params.id);
    if (!cfg) return errorResponse(res, `Unknown configuration '${req.params.id}'`, 404);
    const Model = modelFor(cfg);
    if (!Model) return errorResponse(res, `Model '${cfg.modelName}' is not registered`, 500);

    const { page, limit, offset } = getPagination({ ...req.query, limit: req.query.limit || 80 });
    const where = { ...scopeFor(cfg) };
    if (req.query.search) {
      // Search whichever text fields this leaf actually declares.
      const textKeys = cfg.fields.filter((x) => x.type === 'text').map((x) => x.key);
      const usable = textKeys.filter((k) => Model.rawAttributes[k]);
      if (usable.length) {
        where[Op.or] = usable.map((k) => ({ [k]: { [Op.like]: `%${req.query.search}%` } }));
      }
    }

    const { count, rows } = await Model.findAndCountAll({ where, limit, offset });
    return successResponse(res, {
      data: rows,
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
      spec: { id: cfg.id, title: cfg.title, fields: cfg.fields },
    }, cfg.title);
  } catch (error) { return next(error); }
};

exports.getById = async (req, res, next) => {
  try {
    const cfg = spec(req.params.id);
    if (!cfg) return errorResponse(res, `Unknown configuration '${req.params.id}'`, 404);
    const rec = await modelFor(cfg).findByPk(req.params.recordId);
    if (!rec) return errorResponse(res, 'Record not found', 404);
    return successResponse(res, { record: rec, spec: { id: cfg.id, title: cfg.title, fields: cfg.fields } }, cfg.title);
  } catch (error) { return next(error); }
};

// Only accept the keys the leaf declares, so a crafted body cannot set columns
// this screen was never meant to touch.
const pick = (cfg, body) => {
  const out = {};
  for (const field of cfg.fields) {
    if (body[field.key] === undefined) continue;
    let v = body[field.key];
    if (field.type === 'number') v = v === '' || v === null ? null : Number(v);
    if (field.type === 'boolean') v = Boolean(v);
    if (v === '') v = null;
    out[field.key] = v;
  }
  return out;
};

exports.create = async (req, res, next) => {
  try {
    const cfg = spec(req.params.id);
    if (!cfg) return errorResponse(res, `Unknown configuration '${req.params.id}'`, 404);
    const rec = await modelFor(cfg).create({ ...pick(cfg, req.body), ...scopeFor(cfg) });
    return successResponse(res, rec, `${cfg.title} created`, 201);
  } catch (error) { return next(error); }
};

exports.update = async (req, res, next) => {
  try {
    const cfg = spec(req.params.id);
    if (!cfg) return errorResponse(res, `Unknown configuration '${req.params.id}'`, 404);
    const rec = await modelFor(cfg).findByPk(req.params.recordId);
    if (!rec) return errorResponse(res, 'Record not found', 404);
    await rec.update(pick(cfg, req.body));
    return successResponse(res, rec, `${cfg.title} updated`);
  } catch (error) { return next(error); }
};

exports.remove = async (req, res, next) => {
  try {
    const cfg = spec(req.params.id);
    if (!cfg) return errorResponse(res, `Unknown configuration '${req.params.id}'`, 404);
    const rec = await modelFor(cfg).findByPk(req.params.recordId);
    if (!rec) return errorResponse(res, 'Record not found', 404);
    await rec.destroy();
    return successResponse(res, null, `${cfg.title} deleted`);
  } catch (error) { return next(error); }
};
