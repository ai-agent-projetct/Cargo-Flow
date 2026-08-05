const { Op } = require('sequelize');
const { Company, User } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');

const getIncludes = () => [
  { association: 'parentCompany', attributes: ['id', 'name', 'code'] },
  { association: 'agent', attributes: ['id', 'name', 'email'] },
];

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { search, status } = req.query;

    const where = {};
    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { code: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Company.findAndCountAll({
      where,
      include: getIncludes(),
      order: [['name', 'ASC']],
      limit,
      offset,
      distinct: true,
    });

    return successResponse(res, rows, 'Companies retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const company = await Company.findByPk(req.params.id, { include: getIncludes() });
    if (!company) return errorResponse(res, 'Company not found', 404);
    return successResponse(res, company, 'Company retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const company = await Company.create(req.body);
    const result = await Company.findByPk(company.id, { include: getIncludes() });
    return successResponse(res, result, 'Company created', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const company = await Company.findByPk(req.params.id);
    if (!company) return errorResponse(res, 'Company not found', 404);
    await company.update(req.body);
    const result = await Company.findByPk(company.id, { include: getIncludes() });
    return successResponse(res, result, 'Company updated');
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const company = await Company.findByPk(req.params.id);
    if (!company) return errorResponse(res, 'Company not found', 404);
    await company.destroy();
    return successResponse(res, null, 'Company deleted');
  } catch (error) {
    next(error);
  }
};
