const { Op } = require('sequelize');
const { ShipmentSharing } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');

const VALID_TRANSITIONS = {
  created: ['booked', 'cancelled'],
  booked: ['confirmed', 'cancelled'],
  confirmed: ['nomination_generated', 'cancelled'],
  nomination_generated: ['in_transit', 'cancelled'],
  in_transit: ['arrived', 'cancelled'],
  arrived: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { status, direction, transportMode, cargoType, converted, search } = req.query;

    const where = {};
    if (status) where.status = status;
    if (direction) where.direction = direction;
    if (transportMode) where.transportMode = transportMode;
    if (cargoType) where.cargoType = cargoType;
    if (converted !== undefined) where.converted = converted === 'true';

    if (search) {
      where[Op.or] = [
        { sharingNumber: { [Op.like]: `%${search}%` } },
        { bookingId: { [Op.like]: `%${search}%` } },
        { company: { [Op.like]: `%${search}%` } },
        { shipper: { [Op.like]: `%${search}%` } },
        { consignee: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await ShipmentSharing.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return successResponse(res, rows, 'Shipment sharings retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const record = await ShipmentSharing.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Shipment sharing not found', 404);
    return successResponse(res, record, 'Shipment sharing retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const data = { ...req.body, createdBy: req.user.id };
    const record = await ShipmentSharing.create(data);
    return successResponse(res, record, 'Shipment sharing created', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const record = await ShipmentSharing.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Shipment sharing not found', 404);
    if (record.status === 'cancelled') return errorResponse(res, 'Cannot edit a cancelled shipment sharing', 400);
    await record.update(req.body);
    return successResponse(res, record, 'Shipment sharing updated');
  } catch (error) {
    next(error);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const record = await ShipmentSharing.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Shipment sharing not found', 404);

    const allowed = VALID_TRANSITIONS[record.status] || [];
    if (!allowed.includes(status)) {
      return errorResponse(res, `Cannot transition from ${record.status} to ${status}`, 400);
    }

    const updates = { status };
    if (status === 'nomination_generated') updates.converted = true;

    await record.update(updates);
    return successResponse(res, record, `Shipment sharing status updated to ${status.replace('_', ' ')}`);
  } catch (error) {
    next(error);
  }
};

exports.convert = async (req, res, next) => {
  try {
    const record = await ShipmentSharing.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Shipment sharing not found', 404);
    if (record.converted) return errorResponse(res, 'Already converted', 400);

    const allowed = VALID_TRANSITIONS[record.status] || [];
    if (!allowed.includes('nomination_generated')) {
      return errorResponse(res, `Cannot convert from status ${record.status}`, 400);
    }

    await record.update({ converted: true, status: 'nomination_generated' });
    return successResponse(res, record, 'Shipment sharing converted and nomination generated');
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const record = await ShipmentSharing.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Shipment sharing not found', 404);
    if (record.status !== 'created') return errorResponse(res, 'Only newly created shipment sharings can be deleted', 400);
    await record.destroy();
    return successResponse(res, null, 'Shipment sharing deleted');
  } catch (error) {
    next(error);
  }
};

exports.getStats = async (req, res, next) => {
  try {
    const stats = {
      import_to_export_pending: await ShipmentSharing.count({ where: { direction: 'import_to_export', converted: false } }),
      import_to_export_converted: await ShipmentSharing.count({ where: { direction: 'import_to_export', converted: true } }),
      export_to_import_pending: await ShipmentSharing.count({ where: { direction: 'export_to_import', converted: false } }),
      export_to_import_converted: await ShipmentSharing.count({ where: { direction: 'export_to_import', converted: true } }),
    };
    stats.total = await ShipmentSharing.count();
    return successResponse(res, stats, 'Shipment sharing stats retrieved');
  } catch (error) {
    next(error);
  }
};
