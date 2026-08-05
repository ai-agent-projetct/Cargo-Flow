const { Op } = require('sequelize');
const { Department, Company, User } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');

const getIncludes = () => [
  { association: 'company', attributes: ['id', 'name', 'code'] },
  { association: 'parentDepartment', attributes: ['id', 'name'] },
  { association: 'manager', attributes: ['id', 'name', 'email'] },
  { association: 'members', attributes: ['id', 'name', 'email'] },
];

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { search, status, companyId } = req.query;

    const where = {};
    if (status) where.status = status;
    if (companyId) where.companyId = companyId;
    if (search) {
      where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }];
    }

    const { count, rows } = await Department.findAndCountAll({
      where,
      include: getIncludes(),
      order: [['legacyId', 'ASC'], ['name', 'ASC']],
      limit,
      offset,
      distinct: true,
    });

    return successResponse(res, rows, 'Departments retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const department = await Department.findByPk(req.params.id, { include: getIncludes() });
    if (!department) return errorResponse(res, 'Department not found', 404);
    return successResponse(res, department, 'Department retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const department = await Department.create(req.body);
    const result = await Department.findByPk(department.id, { include: getIncludes() });
    return successResponse(res, result, 'Department created', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const department = await Department.findByPk(req.params.id);
    if (!department) return errorResponse(res, 'Department not found', 404);
    await department.update(req.body);
    const result = await Department.findByPk(department.id, { include: getIncludes() });
    return successResponse(res, result, 'Department updated');
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const department = await Department.findByPk(req.params.id);
    if (!department) return errorResponse(res, 'Department not found', 404);
    await department.destroy();
    return successResponse(res, null, 'Department deleted');
  } catch (error) {
    next(error);
  }
};
