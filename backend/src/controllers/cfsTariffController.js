const { Op } = require('sequelize');
const { CFSTariff, Company, Customer, Carrier, Port } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');

const includeRefs = [
  { model: Company, as: 'company', attributes: ['id', 'name'] },
  { model: Customer, as: 'party', attributes: ['id', 'companyName'] },
  { model: Carrier, as: 'shippingLine', attributes: ['id', 'name'] },
  { model: Port, as: 'originPort', attributes: ['id', 'name', 'code'] },
  { model: Port, as: 'destinationPort', attributes: ['id', 'name', 'code'] },
];

exports.getAll = async (req, res, next) => {
  try {
    const { tariffType, search, page = 1, limit = 1000 } = req.query;
    const where = {};
    if (tariffType) where.tariffType = tariffType;
    if (search) where.tariffName = { [Op.like]: `%${search}%` };

    const offset = (Number(page) - 1) * Number(limit);
    const { rows, count } = await CFSTariff.findAndCountAll({
      where,
      include: includeRefs,
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset,
    });

    return successResponse(res, rows, 'CFS Tariffs retrieved', 200, {
      total: count,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(count / Number(limit)),
      hasNext: offset + rows.length < count,
      hasPrev: Number(page) > 1,
    });
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const tariff = await CFSTariff.findByPk(req.params.id, { include: includeRefs });
    if (!tariff) return errorResponse(res, 'CFS Tariff not found', 404);
    return successResponse(res, tariff, 'CFS Tariff retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const tariff = await CFSTariff.create({
      ...req.body,
      createdBy: req.user?.id,
    });
    return successResponse(res, tariff, 'CFS Tariff created', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const tariff = await CFSTariff.findByPk(req.params.id);
    if (!tariff) return errorResponse(res, 'CFS Tariff not found', 404);
    await tariff.update(req.body);
    return successResponse(res, tariff, 'CFS Tariff updated');
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const tariff = await CFSTariff.findByPk(req.params.id);
    if (!tariff) return errorResponse(res, 'CFS Tariff not found', 404);
    await tariff.destroy();
    return successResponse(res, null, 'CFS Tariff deleted');
  } catch (error) {
    next(error);
  }
};
