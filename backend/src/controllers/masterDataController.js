const { MasterDataItem } = require('../models');
const { Op } = require('sequelize');
const { successResponse, errorResponse } = require('../utils/helpers');

exports.getAll = async (req, res, next) => {
  try {
    const { category } = req.params;
    const { search } = req.query;
    const where = { category };
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { code: { [Op.like]: `%${search}%` } },
      ];
    }
    const items = await MasterDataItem.findAll({
      where,
      order: [['sortOrder', 'ASC'], ['name', 'ASC']],
    });
    return successResponse(res, items, 'Master data retrieved');
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const { category, id } = req.params;
    const item = await MasterDataItem.findOne({ where: { id, category } });
    if (!item) return errorResponse(res, 'Record not found', 404);
    return successResponse(res, item, 'Master data retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { category } = req.params;
    const item = await MasterDataItem.create({ ...req.body, category });
    return successResponse(res, item, 'Record created', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { category, id } = req.params;
    const item = await MasterDataItem.findOne({ where: { id, category } });
    if (!item) return errorResponse(res, 'Record not found', 404);
    await item.update(req.body);
    return successResponse(res, item, 'Record updated');
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const { category, id } = req.params;
    const item = await MasterDataItem.findOne({ where: { id, category } });
    if (!item) return errorResponse(res, 'Record not found', 404);
    await item.destroy();
    return successResponse(res, null, 'Record deleted');
  } catch (error) {
    next(error);
  }
};
