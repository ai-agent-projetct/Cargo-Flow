const { Op } = require('sequelize');
const { CFSDelivery } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { status, transportMode, cargoType, search } = req.query;

    const where = {};
    if (status) where.status = status;
    if (transportMode) where.transportMode = transportMode;
    if (cargoType) where.cargoType = cargoType;

    if (search) {
      where[Op.or] = [
        { deliveryNumber: { [Op.like]: `%${search}%` } },
        { containerNumber: { [Op.like]: `%${search}%` } },
        { vehicleNumber: { [Op.like]: `%${search}%` } },
        { cfsLocation: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await CFSDelivery.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return successResponse(res, rows, 'CFS Deliveries retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const record = await CFSDelivery.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'CFS Delivery not found', 404);
    return successResponse(res, record, 'CFS Delivery retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const data = { ...req.body, createdBy: req.user.id };
    const record = await CFSDelivery.create(data);
    return successResponse(res, record, 'CFS Delivery created', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const record = await CFSDelivery.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'CFS Delivery not found', 404);
    if (record.status === 'cancelled') return errorResponse(res, 'Cannot edit a cancelled delivery', 400);
    await record.update(req.body);
    return successResponse(res, record, 'CFS Delivery updated');
  } catch (error) {
    next(error);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const record = await CFSDelivery.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'CFS Delivery not found', 404);
    if (!['created', 'delivered', 'cancelled'].includes(status)) {
      return errorResponse(res, 'Invalid status', 400);
    }
    await record.update({ status });
    return successResponse(res, record, `CFS Delivery status updated to ${status}`);
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const record = await CFSDelivery.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'CFS Delivery not found', 404);
    if (record.status !== 'created') return errorResponse(res, 'Only deliveries in Created status can be deleted', 400);
    await record.destroy();
    return successResponse(res, null, 'CFS Delivery deleted');
  } catch (error) {
    next(error);
  }
};
