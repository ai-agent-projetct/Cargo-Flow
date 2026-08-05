const { Op } = require('sequelize');
const { Carrier, Rate, Shipment, Schedule } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { type, status, search } = req.query;

    const where = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { code: { [Op.like]: `%${search}%` } },
        { scac: { [Op.like]: `%${search}%` } },
        { iataCode: { [Op.like]: `%${search}%` } },
        { country: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Carrier.findAndCountAll({
      where,
      order: [['name', 'ASC']],
      limit,
      offset,
    });

    return successResponse(res, rows, 'Carriers retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const carrier = await Carrier.findByPk(req.params.id);
    if (!carrier) return errorResponse(res, 'Carrier not found', 404);

    const [shipmentCount, rateCount] = await Promise.all([
      Shipment.count({ where: { carrierId: carrier.id } }),
      Rate.count({ where: { carrierId: carrier.id } }),
    ]);

    return successResponse(res, { ...carrier.toJSON(), stats: { shipments: shipmentCount, rates: rateCount } }, 'Carrier retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const carrier = await Carrier.create(req.body);
    return successResponse(res, carrier, 'Carrier created', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const carrier = await Carrier.findByPk(req.params.id);
    if (!carrier) return errorResponse(res, 'Carrier not found', 404);
    await carrier.update(req.body);
    return successResponse(res, carrier, 'Carrier updated');
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const carrier = await Carrier.findByPk(req.params.id);
    if (!carrier) return errorResponse(res, 'Carrier not found', 404);

    const inUse = await Shipment.count({ where: { carrierId: carrier.id } });
    if (inUse > 0) {
      return errorResponse(res, 'Cannot delete carrier with existing shipments', 400);
    }

    await carrier.destroy();
    return successResponse(res, null, 'Carrier deleted');
  } catch (error) {
    next(error);
  }
};

exports.getSchedules = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { count, rows } = await Schedule.findAndCountAll({
      where: { carrierId: req.params.id },
      include: [
        { association: 'originPort', attributes: ['name', 'code', 'country'] },
        { association: 'destinationPort', attributes: ['name', 'code', 'country'] },
      ],
      order: [['departureDate', 'ASC']],
      limit,
      offset,
    });
    return successResponse(res, rows, 'Carrier schedules', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};
