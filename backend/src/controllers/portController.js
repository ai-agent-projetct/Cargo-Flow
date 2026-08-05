const { Op } = require('sequelize');
const { Port, Shipment } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { type, country, status, search } = req.query;

    const where = {};
    if (type) where.type = type;
    if (country) where.country = country;
    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { code: { [Op.like]: `%${search}%` } },
        { city: { [Op.like]: `%${search}%` } },
        { country: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Port.findAndCountAll({
      where,
      order: [['name', 'ASC']],
      limit,
      offset,
    });

    return successResponse(res, rows, 'Ports retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const port = await Port.findByPk(req.params.id);
    if (!port) return errorResponse(res, 'Port not found', 404);
    return successResponse(res, port, 'Port retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const port = await Port.create(req.body);
    return successResponse(res, port, 'Port created', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const port = await Port.findByPk(req.params.id);
    if (!port) return errorResponse(res, 'Port not found', 404);
    await port.update(req.body);
    return successResponse(res, port, 'Port updated');
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const port = await Port.findByPk(req.params.id);
    if (!port) return errorResponse(res, 'Port not found', 404);

    const inUse = await Shipment.count({
      where: { [Op.or]: [{ originPortId: port.id }, { destinationPortId: port.id }] },
    });
    if (inUse > 0) {
      return errorResponse(res, 'Cannot delete port that is used in shipments', 400);
    }

    await port.destroy();
    return successResponse(res, null, 'Port deleted');
  } catch (error) {
    next(error);
  }
};

exports.getCountries = async (req, res, next) => {
  try {
    const { type } = req.query;
    const where = {};
    if (type) where.type = type;

    const result = await Port.findAll({
      attributes: [[require('sequelize').fn('DISTINCT', require('sequelize').col('country')), 'country']],
      where,
      order: [['country', 'ASC']],
      raw: true,
    });

    const countries = result.map((r) => r.country).filter(Boolean);
    return successResponse(res, countries, 'Countries retrieved');
  } catch (error) {
    next(error);
  }
};
