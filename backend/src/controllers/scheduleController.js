const { Op } = require('sequelize');
const { Schedule, Carrier, Port } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');

const getIncludes = () => [
  { association: 'carrier', attributes: ['id', 'name', 'code', 'type', 'logo'] },
  { association: 'originPort', attributes: ['id', 'name', 'code', 'country'] },
  { association: 'destinationPort', attributes: ['id', 'name', 'code', 'country'] },
];

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { carrierId, originPortId, destinationPortId, mode, status, fromDate, toDate } = req.query;

    const where = {};
    if (carrierId) where.carrierId = carrierId;
    if (originPortId) where.originPortId = originPortId;
    if (destinationPortId) where.destinationPortId = destinationPortId;
    if (mode) where.mode = mode;
    if (status) where.status = status;
    if (fromDate || toDate) {
      where.departureDate = {};
      if (fromDate) where.departureDate[Op.gte] = new Date(fromDate);
      if (toDate) where.departureDate[Op.lte] = new Date(toDate);
    }

    const { count, rows } = await Schedule.findAndCountAll({
      where,
      include: getIncludes(),
      order: [['departureDate', 'ASC']],
      limit,
      offset,
      distinct: true,
    });

    return successResponse(res, rows, 'Schedules retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const schedule = await Schedule.findByPk(req.params.id, { include: getIncludes() });
    if (!schedule) return errorResponse(res, 'Schedule not found', 404);
    return successResponse(res, schedule, 'Schedule retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const schedule = await Schedule.create(req.body);
    const result = await Schedule.findByPk(schedule.id, { include: getIncludes() });
    return successResponse(res, result, 'Schedule created', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const schedule = await Schedule.findByPk(req.params.id);
    if (!schedule) return errorResponse(res, 'Schedule not found', 404);
    await schedule.update(req.body);
    const result = await Schedule.findByPk(schedule.id, { include: getIncludes() });
    return successResponse(res, result, 'Schedule updated');
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const schedule = await Schedule.findByPk(req.params.id);
    if (!schedule) return errorResponse(res, 'Schedule not found', 404);
    await schedule.destroy();
    return successResponse(res, null, 'Schedule deleted');
  } catch (error) {
    next(error);
  }
};

exports.search = async (req, res, next) => {
  try {
    const { originPortId, destinationPortId, mode, departureDate, carrierId } = req.query;

    const where = { status: { [Op.in]: ['scheduled', 'departed'] } };
    if (carrierId) where.carrierId = carrierId;
    if (originPortId) where.originPortId = originPortId;
    if (destinationPortId) where.destinationPortId = destinationPortId;
    if (mode) where.mode = mode;
    if (departureDate) {
      const date = new Date(departureDate);
      const nextMonth = new Date(date);
      nextMonth.setDate(nextMonth.getDate() + 30);
      where.departureDate = { [Op.between]: [date, nextMonth] };
    } else {
      where.departureDate = { [Op.gte]: new Date() };
    }

    const schedules = await Schedule.findAll({
      where,
      include: getIncludes(),
      order: [['departureDate', 'ASC']],
      limit: 50,
    });

    return successResponse(res, schedules, 'Schedules found');
  } catch (error) {
    next(error);
  }
};
