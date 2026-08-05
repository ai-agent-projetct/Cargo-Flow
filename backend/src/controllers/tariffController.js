const { Op } = require('sequelize');
const { Tariff, Company, Customer, Incoterm } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');

const includeRefs = [
  { model: Company, as: 'company', attributes: ['id', 'name'] },
  { model: Customer, as: 'party', attributes: ['id', 'companyName'] },
  { model: Incoterm, as: 'incoterm', attributes: ['id', 'code', 'name'] },
];

exports.getAll = async (req, res, next) => {
  try {
    const { tariffType, search, page = 1, limit = 1000 } = req.query;
    const where = {};
    if (tariffType) where.tariffType = tariffType;
    if (search) {
      where.tariffName = { [Op.like]: `%${search}%` };
    }

    const offset = (Number(page) - 1) * Number(limit);
    const { rows, count } = await Tariff.findAndCountAll({
      where,
      include: includeRefs,
      order: [['createdAt', 'DESC']],
      limit: Number(limit),
      offset,
    });

    const data = rows.map((t) => ({
      ...t.toJSON(),
      activeCharges: Array.isArray(t.charges) ? t.charges.length : 0,
    }));

    return successResponse(res, data, 'Tariffs retrieved', 200, {
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
    const tariff = await Tariff.findByPk(req.params.id, { include: includeRefs });
    if (!tariff) return errorResponse(res, 'Tariff not found', 404);
    return successResponse(res, tariff, 'Tariff retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const tariff = await Tariff.create({
      ...req.body,
      createdBy: req.user?.id,
    });
    return successResponse(res, tariff, 'Tariff created', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const tariff = await Tariff.findByPk(req.params.id);
    if (!tariff) return errorResponse(res, 'Tariff not found', 404);
    await tariff.update(req.body);
    return successResponse(res, tariff, 'Tariff updated');
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const tariff = await Tariff.findByPk(req.params.id);
    if (!tariff) return errorResponse(res, 'Tariff not found', 404);
    await tariff.destroy();
    return successResponse(res, null, 'Tariff deleted');
  } catch (error) {
    next(error);
  }
};

exports.removeAllCharges = async (req, res, next) => {
  try {
    const tariff = await Tariff.findByPk(req.params.id);
    if (!tariff) return errorResponse(res, 'Tariff not found', 404);
    tariff.charges = [];
    await tariff.save();
    return successResponse(res, tariff, 'Charges removed');
  } catch (error) {
    next(error);
  }
};

exports.uploadCharges = async (req, res, next) => {
  try {
    const tariff = await Tariff.findByPk(req.params.id);
    if (!tariff) return errorResponse(res, 'Tariff not found', 404);
    const incoming = Array.isArray(req.body.charges) ? req.body.charges : [];
    const existing = Array.isArray(tariff.charges) ? tariff.charges : [];

    // "In case of same Charge Name found from Uploaded Charges file, Only Last
    // valid row entry will be considered for import."
    const merged = [...existing];
    incoming.forEach((row) => {
      const idx = merged.findIndex((c) => c.chargeName === row.chargeName);
      if (idx >= 0) merged[idx] = row;
      else merged.push(row);
    });

    tariff.charges = merged;
    await tariff.save();
    return successResponse(res, tariff, 'Charges uploaded');
  } catch (error) {
    next(error);
  }
};
