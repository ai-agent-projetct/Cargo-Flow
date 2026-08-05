const { Op } = require('sequelize');
const { Rate, Carrier, Port, User } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');

const getIncludes = () => [
  { association: 'carrier', attributes: ['id', 'name', 'code', 'type'] },
  { association: 'originPort', attributes: ['id', 'name', 'code', 'country'] },
  { association: 'destinationPort', attributes: ['id', 'name', 'code', 'country'] },
  { association: 'creator', attributes: ['id', 'name'] },
];

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { mode, carrierId, originPortId, destinationPortId, status, search } = req.query;

    const where = {};
    if (mode) where.mode = mode;
    if (carrierId) where.carrierId = carrierId;
    if (originPortId) where.originPortId = originPortId;
    if (destinationPortId) where.destinationPortId = destinationPortId;
    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { originCountry: { [Op.like]: `%${search}%` } },
        { destinationCountry: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Rate.findAndCountAll({
      where,
      include: getIncludes(),
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    return successResponse(res, rows, 'Rates retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const rate = await Rate.findByPk(req.params.id, { include: getIncludes() });
    if (!rate) return errorResponse(res, 'Rate not found', 404);
    return successResponse(res, rate, 'Rate retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const data = { ...req.body, createdBy: req.user.id };
    const rate = await Rate.create(data);
    const result = await Rate.findByPk(rate.id, { include: getIncludes() });
    return successResponse(res, result, 'Rate created', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const rate = await Rate.findByPk(req.params.id);
    if (!rate) return errorResponse(res, 'Rate not found', 404);
    await rate.update(req.body);
    const result = await Rate.findByPk(rate.id, { include: getIncludes() });
    return successResponse(res, result, 'Rate updated');
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const rate = await Rate.findByPk(req.params.id);
    if (!rate) return errorResponse(res, 'Rate not found', 404);
    await rate.destroy();
    return successResponse(res, null, 'Rate deleted');
  } catch (error) {
    next(error);
  }
};

exports.search = async (req, res, next) => {
  try {
    const { mode, originPortId, destinationPortId, originCountry, destinationCountry, shipmentType, date } = req.query;

    const where = { status: 'active' };
    if (mode) where.mode = mode;
    if (shipmentType) where.shipmentType = shipmentType;
    if (originPortId) where.originPortId = originPortId;
    if (destinationPortId) where.destinationPortId = destinationPortId;
    if (originCountry) where.originCountry = originCountry;
    if (destinationCountry) where.destinationCountry = destinationCountry;

    // Filter by validity
    const checkDate = date ? new Date(date) : new Date();
    where.validFrom = { [Op.lte]: checkDate };
    where.validTo = { [Op.gte]: checkDate };

    const rates = await Rate.findAll({
      where,
      include: getIncludes(),
      order: [['freightRate', 'ASC']],
    });

    return successResponse(res, rates, 'Rates found');
  } catch (error) {
    next(error);
  }
};
