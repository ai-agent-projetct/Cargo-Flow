const { PermissionGroup, ModelAccess, UserGroup } = require("../models");

// Effective permissions are the union of every ACL row matching the user's
// groups, plus rows with groupId = null which apply to everyone.
//
// Cached per user for a short window — permissions change rarely but are read
// on every request.
const CACHE_TTL_MS = 30_000;
const cache = new Map();

const invalidate = (userId) => {
  if (userId) cache.delete(String(userId));
  else cache.clear();
};

const loadForUser = async (userId) => {
  const links = await UserGroup.findAll({ where: { userId }, attributes: ['groupId'], raw: true });
  const groupIds = links.map((l) => l.groupId);

  const groups = groupIds.length
    ? await PermissionGroup.findAll({ where: { id: groupIds }, raw: true })
    : [];

  const { Op } = require('sequelize');
  const rows = await ModelAccess.findAll({
    where: { [Op.or]: [{ groupId: null }, ...(groupIds.length ? [{ groupId: groupIds }] : [])] },
    raw: true,
  });

  // model -> { read, write, create, delete, label }
  const perms = {};
  rows.forEach((r) => {
    const p = perms[r.model] || (perms[r.model] = {
      read: false, write: false, create: false, delete: false, label: r.label,
    });
    p.read = p.read || !!r.permRead;
    p.write = p.write || !!r.permWrite;
    p.create = p.create || !!r.permCreate;
    p.delete = p.delete || !!r.permDelete;
  });

  return {
    groups: groups.map((g) => ({ id: g.id, category: g.category, name: g.name, fullName: g.fullName })),
    // Only when EVERY group the user holds is own-documents-only does the
    // restriction bite; holding any broader group lifts it.
    ownDocumentsOnly: groups.length > 0 && groups.every((g) => g.ownDocumentsOnly),
    perms,
  };
};

// Holding this group is what makes someone an administrator, exactly as in
// CargoFlo — not a role column. That keeps one source of truth: a user with the
// admin role but without this group is still bound by the matrix.
const SUPERUSER_GROUP = 'Administration / Settings';

const forUser = async (user) => {
  if (!user?.id) return { groups: [], ownDocumentsOnly: false, perms: {}, superuser: false };

  const key = String(user.id);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const value = await loadForUser(user.id);
  value.superuser = value.groups.some((g) => g.fullName === SUPERUSER_GROUP);
  cache.set(key, { at: Date.now(), value });
  return value;
};

// The exact wording the demo shows.
const denialMessage = (label, model) =>
  `Due to security restrictions, you are not allowed to access '${label}' (${model}) records.\n\n`
  + 'Contact your administrator to request access if necessary.';

const can = (ctx, model, action) => {
  if (ctx.superuser) return true;
  return !!ctx.perms?.[model]?.[action];
};

const labelFor = async (model) => {
  const row = await ModelAccess.findOne({ where: { model }, attributes: ['label'], raw: true });
  return row?.label || model;
};

module.exports = { forUser, can, denialMessage, labelFor, invalidate };
