const { Op } = require('sequelize');
const { ContainerNumber } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { status, search } = req.query;

    const where = {};
    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { containerNumber: { [Op.like]: `%${search}%` } },
        { linkedShipmentNumber: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await ContainerNumber.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return successResponse(res, rows, 'Container numbers retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { containerNumber } = req.body;
    if (!containerNumber) return errorResponse(res, 'Container number is required', 400);

    const existing = await ContainerNumber.findOne({ where: { containerNumber } });
    if (existing) return errorResponse(res, 'Container number already exists', 400);

    const record = await ContainerNumber.create({ containerNumber: containerNumber.toUpperCase() });
    return successResponse(res, record, 'Container number created', 201);
  } catch (error) {
    next(error);
  }
};

exports.bulkCreate = async (req, res, next) => {
  try {
    const { containerNumbers } = req.body;
    if (!Array.isArray(containerNumbers) || containerNumbers.length === 0) {
      return errorResponse(res, 'containerNumbers array is required', 400);
    }

    const cleaned = [...new Set(containerNumbers.map((c) => String(c).trim().toUpperCase()).filter(Boolean))];
    const existing = await ContainerNumber.findAll({ where: { containerNumber: { [Op.in]: cleaned } } });
    const existingNumbers = new Set(existing.map((e) => e.containerNumber));
    const toCreate = cleaned.filter((c) => !existingNumbers.has(c));

    const created = await ContainerNumber.bulkCreate(toCreate.map((containerNumber) => ({ containerNumber })));

    return successResponse(res, { created: created.length, skipped: cleaned.length - toCreate.length }, 'Container numbers added', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const record = await ContainerNumber.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Container number not found', 404);
    await record.update(req.body);
    return successResponse(res, record, 'Container number updated');
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const record = await ContainerNumber.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Container number not found', 404);
    if (record.status === 'used') return errorResponse(res, 'Cannot delete a container number that is in use', 400);
    await record.destroy();
    return successResponse(res, null, 'Container number deleted');
  } catch (error) {
    next(error);
  }
};
