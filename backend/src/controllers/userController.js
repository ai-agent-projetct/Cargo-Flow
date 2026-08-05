const { Op } = require('sequelize');
const { User, Company, Department } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');
const { sendWelcomeEmail } = require('../utils/emailService');

const getIncludes = () => [
  { association: 'company', attributes: ['id', 'name', 'code'] },
  { association: 'department', attributes: ['id', 'name'] },
];

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { role, status, search } = req.query;

    const where = {};
    if (role) where.role = role;
    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      include: getIncludes(),
      order: [['name', 'ASC']],
      limit,
      offset,
      distinct: true,
    });

    // Resolve defaultCompany name for list display
    const companyIds = [...new Set(rows.map((r) => r.defaultCompanyId).filter(Boolean))];
    let companiesMap = {};
    if (companyIds.length) {
      const companies = await Company.findAll({ where: { id: companyIds }, attributes: ['id', 'name'] });
      companiesMap = Object.fromEntries(companies.map((c) => [c.id, c]));
    }
    const data = rows.map((r) => {
      const json = r.toJSON();
      json.defaultCompany = json.defaultCompanyId ? companiesMap[json.defaultCompanyId] : null;
      return json;
    });

    return successResponse(res, data, 'Users retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id, {
      include: getIncludes(),
    });
    if (!user) return errorResponse(res, 'User not found', 404);
    const json = user.toJSON();
    if (json.allowedCompanyIds?.length || json.defaultCompanyId) {
      const ids = [...new Set([...(json.allowedCompanyIds || []), json.defaultCompanyId].filter(Boolean))];
      const companies = await Company.findAll({ where: { id: ids }, attributes: ['id', 'name'] });
      const map = Object.fromEntries(companies.map((c) => [c.id, c]));
      json.allowedCompanies = (json.allowedCompanyIds || []).map((id) => map[id]).filter(Boolean);
      json.defaultCompany = json.defaultCompanyId ? map[json.defaultCompanyId] : null;
    } else {
      json.allowedCompanies = [];
      json.defaultCompany = null;
    }
    return successResponse(res, json, 'User retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const {
      name, email, password, role, phone, companyId,
      allowedCompanyIds, defaultCompanyId, departmentId,
      creditLimitApproval, quotationApproval,
    } = req.body;

    const existing = await User.findOne({ where: { email } });
    if (existing) return errorResponse(res, 'Email already registered', 409);

    const user = await User.create({
      name,
      email,
      password: password || 'TempPass@123',
      role,
      phone,
      companyId: companyId || defaultCompanyId,
      departmentId,
      allowedCompanyIds: allowedCompanyIds || (defaultCompanyId ? [defaultCompanyId] : []),
      defaultCompanyId,
      creditLimitApproval: creditLimitApproval || {},
      quotationApproval: quotationApproval || {},
    });
    await sendWelcomeEmail(user).catch(() => {});

    const result = await User.findByPk(user.id, { include: getIncludes() });
    return successResponse(res, result, 'User created', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return errorResponse(res, 'User not found', 404);

    const { password, ...updateData } = req.body;
    await user.update(updateData);

    const result = await User.findByPk(user.id, {
      include: getIncludes(),
    });
    return successResponse(res, result, 'User updated');
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return errorResponse(res, 'User not found', 404);
    if (user.id === req.user.id) return errorResponse(res, 'Cannot delete your own account', 400);
    await user.destroy();
    return successResponse(res, null, 'User deleted');
  } catch (error) {
    next(error);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const user = await User.findByPk(req.params.id);
    if (!user) return errorResponse(res, 'User not found', 404);
    if (user.id === req.user.id) return errorResponse(res, 'Cannot change your own status', 400);
    await user.update({ status });
    return successResponse(res, user, `User ${status}`);
  } catch (error) {
    next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    const user = await User.findByPk(req.params.id);
    if (!user) return errorResponse(res, 'User not found', 404);
    await user.update({ password: newPassword });
    return successResponse(res, null, 'Password reset successfully');
  } catch (error) {
    next(error);
  }
};
