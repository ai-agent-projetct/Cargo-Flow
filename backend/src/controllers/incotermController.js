const { Incoterm } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');

exports.getAll = async (req, res, next) => {
  try {
    const incoterms = await Incoterm.findAll({ order: [['sortOrder', 'ASC'], ['code', 'ASC']] });
    return successResponse(res, incoterms, 'Incoterms retrieved');
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const incoterm = await Incoterm.findByPk(req.params.id);
    if (!incoterm) return errorResponse(res, 'Incoterm not found', 404);
    return successResponse(res, incoterm, 'Incoterm retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const incoterm = await Incoterm.create(req.body);
    return successResponse(res, incoterm, 'Incoterm created', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const incoterm = await Incoterm.findByPk(req.params.id);
    if (!incoterm) return errorResponse(res, 'Incoterm not found', 404);
    await incoterm.update(req.body);
    return successResponse(res, incoterm, 'Incoterm updated');
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const incoterm = await Incoterm.findByPk(req.params.id);
    if (!incoterm) return errorResponse(res, 'Incoterm not found', 404);
    await incoterm.destroy();
    return successResponse(res, null, 'Incoterm deleted');
  } catch (error) {
    next(error);
  }
};
