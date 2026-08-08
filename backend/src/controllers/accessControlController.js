const { PermissionGroup, ModelAccess, UserGroup, User } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');
const permissions = require('../services/permissionService');

// What the signed-in user may do — the frontend uses this to hide buttons and
// menu entries it would only be refused on.
exports.me = async (req, res, next) => {
  try {
    const ctx = await permissions.forUser(req.user);
    return successResponse(res, {
      superuser: ctx.superuser,
      ownDocumentsOnly: ctx.ownDocumentsOnly,
      groups: ctx.groups,
      // Superusers get an open map; the client treats `superuser` as a wildcard.
      permissions: ctx.perms,
    }, 'Permissions retrieved');
  } catch (error) {
    next(error);
  }
};

exports.listGroups = async (req, res, next) => {
  try {
    const groups = await PermissionGroup.findAll({ order: [['category', 'ASC'], ['name', 'ASC']] });
    const byCategory = {};
    groups.forEach((g) => {
      (byCategory[g.category] = byCategory[g.category] || []).push({
        id: g.id, name: g.name, fullName: g.fullName, ownDocumentsOnly: g.ownDocumentsOnly,
      });
    });
    return successResponse(res, { groups, byCategory }, 'Groups retrieved');
  } catch (error) {
    next(error);
  }
};

// The full ACL grid: models down, groups across.
exports.matrix = async (req, res, next) => {
  try {
    const [rules, groups] = await Promise.all([
      ModelAccess.findAll({ raw: true }),
      PermissionGroup.findAll({ raw: true }),
    ]);
    const groupById = Object.fromEntries(groups.map((g) => [g.id, g.fullName]));
    const models = {};
    rules.forEach((r) => {
      const m = models[r.model] || (models[r.model] = { model: r.model, label: r.label, rules: [] });
      m.rules.push({
        id: r.id,
        group: groupById[r.groupId] || '(all users)',
        groupId: r.groupId,
        read: !!r.permRead, write: !!r.permWrite, create: !!r.permCreate, delete: !!r.permDelete,
      });
    });
    return successResponse(res, Object.values(models).sort((a, b) => a.label.localeCompare(b.label)),
      'Access matrix retrieved');
  } catch (error) {
    next(error);
  }
};

exports.updateRule = async (req, res, next) => {
  try {
    const rule = await ModelAccess.findByPk(req.params.id);
    if (!rule) return errorResponse(res, 'Access rule not found', 404);
    const { read, write, create, delete: del } = req.body;
    await rule.update({
      ...(read !== undefined ? { permRead: !!read } : {}),
      ...(write !== undefined ? { permWrite: !!write } : {}),
      ...(create !== undefined ? { permCreate: !!create } : {}),
      ...(del !== undefined ? { permDelete: !!del } : {}),
    });
    permissions.invalidate();
    return successResponse(res, rule, 'Access rule updated');
  } catch (error) {
    next(error);
  }
};

// Which groups a given user holds.
exports.userGroups = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.userId, {
      attributes: ['id', 'email', 'name', 'role'],
    });
    if (!user) return errorResponse(res, 'User not found', 404);
    const links = await UserGroup.findAll({ where: { userId: user.id }, raw: true });
    return successResponse(res, {
      user,
      groupIds: links.map((l) => l.groupId),
    }, 'User groups retrieved');
  } catch (error) {
    next(error);
  }
};

// Replaces a user's group set in one call, the way the Access Rights tab saves.
exports.setUserGroups = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findByPk(userId);
    if (!user) return errorResponse(res, 'User not found', 404);

    const wanted = Array.isArray(req.body.groupIds) ? req.body.groupIds : [];
    // Guard against locking every administrator out of the system.
    if (user.role === 'admin' && wanted.length === 0) {
      return errorResponse(res, 'An administrator must keep at least one group', 400);
    }

    const valid = await PermissionGroup.findAll({ where: { id: wanted }, attributes: ['id'], raw: true });
    const validIds = valid.map((g) => g.id);

    await UserGroup.destroy({ where: { userId } });
    if (validIds.length) {
      await UserGroup.bulkCreate(validIds.map((groupId) => ({ userId, groupId })));
    }
    permissions.invalidate(userId);

    return successResponse(res, { userId, groupIds: validIds },
      `${validIds.length} group${validIds.length === 1 ? '' : 's'} assigned`);
  } catch (error) {
    next(error);
  }
};

// Everyone with their groups — the Users list in Administration.
exports.listUsersWithGroups = async (req, res, next) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'email', 'name', 'role', 'status'],
      order: [['email', 'ASC']],
    });
    const links = await UserGroup.findAll({ raw: true });
    const groups = await PermissionGroup.findAll({ raw: true });
    const groupById = Object.fromEntries(groups.map((g) => [g.id, g.fullName]));

    const byUser = {};
    links.forEach((l) => { (byUser[l.userId] = byUser[l.userId] || []).push(groupById[l.groupId]); });

    return successResponse(res, users.map((u) => ({
      ...u.toJSON(),
      groups: (byUser[u.id] || []).sort(),
    })), 'Users retrieved');
  } catch (error) {
    next(error);
  }
};
