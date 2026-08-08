const permissions = require('../services/permissionService');

// Maps the HTTP verb to the ACL action being attempted.
const ACTION_BY_METHOD = {
  GET: 'read',
  HEAD: 'read',
  POST: 'create',
  PUT: 'write',
  PATCH: 'write',
  DELETE: 'delete',
};

/**
 * Guards a route group against a model's ACL.
 *
 *   router.use(requireAccess('house.shipment'))
 *
 * A POST to a workflow endpoint is a state change, not a record creation, so
 * sub-paths beyond the collection/:id are treated as writes.
 */
const requireAccess = (model, opts = {}) => async (req, res, next) => {
  try {
    const ctx = await permissions.forUser(req.user);
    req.permissions = ctx;

    let action = opts.action || ACTION_BY_METHOD[req.method] || 'read';
    // POST /:id/approve is a write on an existing record, not a create.
    if (!opts.action && req.method === 'POST' && /\/[^/]+\/[^/]+$/.test(req.path)) {
      action = 'write';
    }

    if (permissions.can(ctx, model, action)) return next();

    const label = await permissions.labelFor(model);
    return res.status(403).json({
      success: false,
      // The frontend renders this verbatim in the Warning dialog.
      message: permissions.denialMessage(label, model),
      accessDenied: { model, label, action },
    });
  } catch (error) {
    return next(error);
  }
};

// Attaches req.permissions without enforcing — used by list endpoints that want
// to filter rather than refuse.
const attachPermissions = async (req, res, next) => {
  try {
    req.permissions = await permissions.forUser(req.user);
    return next();
  } catch (error) {
    return next(error);
  }
};

// Applies the "User: Own Documents Only" record rule to a Sequelize where clause.
const scopeToOwnDocuments = (req, where = {}, field = 'createdBy') => {
  const ctx = req.permissions;
  if (!ctx || ctx.superuser || !ctx.ownDocumentsOnly) return where;
  return { ...where, [field]: req.user?.id || null };
};

module.exports = { requireAccess, attachPermissions, scopeToOwnDocuments };
