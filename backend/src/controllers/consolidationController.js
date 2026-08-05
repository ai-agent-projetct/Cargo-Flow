const { Op } = require('sequelize');
const { Consolidation } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');

const VALID_TRANSITIONS = {
  draft: ['confirmed', 'cancelled'],
  confirmed: ['in_transit', 'cancelled'],
  in_transit: ['arrived', 'cancelled'],
  arrived: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { status, transportMode, direction, cargoType, search } = req.query;

    const where = {};
    if (status) where.status = status;
    if (transportMode) where.transportMode = transportMode;
    if (direction) where.direction = direction;
    if (cargoType) where.cargoType = cargoType;

    if (search) {
      where[Op.or] = [
        { consolidationNumber: { [Op.like]: `%${search}%` } },
        { mblNumber: { [Op.like]: `%${search}%` } },
        { vesselName: { [Op.like]: `%${search}%` } },
        { origin: { [Op.like]: `%${search}%` } },
        { destination: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Consolidation.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return successResponse(res, rows, 'Consolidations retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const record = await Consolidation.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Consolidation not found', 404);
    return successResponse(res, record, 'Consolidation retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const data = { ...req.body, createdBy: req.user.id };
    const record = await Consolidation.create(data);
    return successResponse(res, record, 'Consolidation created', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const record = await Consolidation.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Consolidation not found', 404);
    if (record.status === 'cancelled') return errorResponse(res, 'Cannot edit a cancelled consolidation', 400);
    await record.update(req.body);
    return successResponse(res, record, 'Consolidation updated');
  } catch (error) {
    next(error);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const record = await Consolidation.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Consolidation not found', 404);

    const allowed = VALID_TRANSITIONS[record.status] || [];
    if (!allowed.includes(status)) {
      return errorResponse(res, `Cannot transition from ${record.status} to ${status}`, 400);
    }

    await record.update({ status });
    return successResponse(res, record, `Consolidation status updated to ${status.replace('_', ' ')}`);
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const record = await Consolidation.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Consolidation not found', 404);
    if (record.status !== 'draft') return errorResponse(res, 'Only draft consolidations can be deleted', 400);
    await record.destroy();
    return successResponse(res, null, 'Consolidation deleted');
  } catch (error) {
    next(error);
  }
};

exports.getStats = async (req, res, next) => {
  try {
    const statuses = ['draft', 'confirmed', 'in_transit', 'arrived', 'completed', 'cancelled'];
    const stats = {};
    for (const s of statuses) {
      stats[s] = await Consolidation.count({ where: { status: s } });
    }
    stats.total = await Consolidation.count();
    return successResponse(res, stats, 'Consolidation stats retrieved');
  } catch (error) {
    next(error);
  }
};
