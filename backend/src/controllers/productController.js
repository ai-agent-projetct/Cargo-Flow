const { Op, fn, col } = require('sequelize');
const { Product } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');

const asList = (v) => {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
};

const normalise = (b) => {
  const o = { ...b };
  if ('customerTaxes' in o) o.customerTaxes = asList(o.customerTaxes);
  if ('vendorTaxes' in o) o.vendorTaxes = asList(o.vendorTaxes);
  return o;
};

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination({ ...req.query, limit: req.query.limit || 80 });
    const { menu, search, category, sold, purchased } = req.query;

    const where = { active: true };
    // The Customers menu opens with the "Can be Sold" chip, Vendors with
    // "Can be Purchased".
    const wantSold = sold === '1' || (sold === undefined && menu !== 'vendor-products');
    const wantPurchased = purchased === '1' || (purchased === undefined && menu === 'vendor-products');
    if (wantSold) where.canBeSold = true;
    if (wantPurchased) where.canBePurchased = true;
    if (category) where.category = category;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { internalReference: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Product.findAndCountAll({
      where, order: [['name', 'ASC']], limit, offset,
    });
    return successResponse(res, rows, 'Records retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

// Feeds the product picker on invoice, bill and pro forma lines.
exports.lookup = async (req, res, next) => {
  try {
    const { q } = req.query;
    const where = { active: true, canBeSold: true };
    if (q) {
      where[Op.or] = [
        { name: { [Op.like]: `%${q}%` } },
        { internalReference: { [Op.like]: `%${q}%` } },
      ];
    }
    const rows = await Product.findAll({
      where, limit: 30, order: [['name', 'ASC']],
      attributes: ['id', 'internalReference', 'name', 'salesPrice', 'customerTaxes', 'incomeAccount'],
      raw: true,
    });
    return successResponse(res, rows.map((r) => ({
      ...r,
      // The picker shows "[REF] Name" exactly like the ERP.
      display: r.internalReference ? `[${r.internalReference}] ${r.name}` : r.name,
    })), 'Products retrieved');
  } catch (error) {
    next(error);
  }
};

exports.getFacets = async (req, res, next) => {
  try {
    const rows = await Product.findAll({
      where: { active: true },
      attributes: [[col('category'), 'value'], [fn('COUNT', col('id')), 'count']],
      group: [col('category')], raw: true,
    });
    return successResponse(res, {
      categories: rows.filter((r) => r.value).map((r) => ({ value: r.value, count: Number(r.count) })),
    }, 'Facets retrieved');
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const rec = await Product.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Record not found', 404);
    return successResponse(res, rec, 'Record retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const rec = await Product.create({ ...normalise(req.body), active: true });
    return successResponse(res, rec, 'Record created', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const rec = await Product.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Record not found', 404);
    await rec.update(normalise(req.body));
    return successResponse(res, rec, 'Record updated');
  } catch (error) {
    next(error);
  }
};

// Products are archived rather than removed — invoice lines still reference them.
exports.remove = async (req, res, next) => {
  try {
    const rec = await Product.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'Record not found', 404);
    await rec.update({ active: false });
    return successResponse(res, null, 'Record archived');
  } catch (error) {
    next(error);
  }
};
