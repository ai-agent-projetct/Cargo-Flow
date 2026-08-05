const { Op } = require('sequelize');
const { Group, User } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');

const getIncludes = () => [
  { association: 'users', attributes: ['id', 'name', 'email'], through: { attributes: [] } },
];

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { search, status, applicationName } = req.query;

    const where = {};
    if (status) where.status = status;
    if (applicationName) where.applicationName = applicationName;
    if (search) {
      where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }];
    }

    const { count, rows } = await Group.findAndCountAll({
      where,
      include: getIncludes(),
      order: [['name', 'ASC']],
      limit,
      offset,
      distinct: true,
    });

    return successResponse(res, rows, 'Groups retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const group = await Group.findByPk(req.params.id, { include: getIncludes() });
    if (!group) return errorResponse(res, 'Group not found', 404);
    return successResponse(res, group, 'Group retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { userIds, ...data } = req.body;
    const group = await Group.create(data);
    if (Array.isArray(userIds) && userIds.length) {
      await group.setUsers(userIds);
    }
    const result = await Group.findByPk(group.id, { include: getIncludes() });
    return successResponse(res, result, 'Group created', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { userIds, ...data } = req.body;
    const group = await Group.findByPk(req.params.id);
    if (!group) return errorResponse(res, 'Group not found', 404);
    await group.update(data);
    if (Array.isArray(userIds)) {
      await group.setUsers(userIds);
    }
    const result = await Group.findByPk(group.id, { include: getIncludes() });
    return successResponse(res, result, 'Group updated');
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const group = await Group.findByPk(req.params.id);
    if (!group) return errorResponse(res, 'Group not found', 404);
    await group.destroy();
    return successResponse(res, null, 'Group deleted');
  } catch (error) {
    next(error);
  }
};

exports.addUser = async (req, res, next) => {
  try {
    const group = await Group.findByPk(req.params.id);
    if (!group) return errorResponse(res, 'Group not found', 404);
    const { userId } = req.body;
    await group.addUser(userId);
    const result = await Group.findByPk(group.id, { include: getIncludes() });
    return successResponse(res, result, 'User added to group');
  } catch (error) {
    next(error);
  }
};

exports.removeUser = async (req, res, next) => {
  try {
    const group = await Group.findByPk(req.params.id);
    if (!group) return errorResponse(res, 'Group not found', 404);
    const { userId } = req.body;
    await group.removeUser(userId);
    const result = await Group.findByPk(group.id, { include: getIncludes() });
    return successResponse(res, result, 'User removed from group');
  } catch (error) {
    next(error);
  }
};
