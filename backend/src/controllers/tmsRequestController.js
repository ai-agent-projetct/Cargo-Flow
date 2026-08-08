const { Op } = require('sequelize');
const { TMSRequest } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');
const { scopeToOwnDocuments } = require('../middleware/permissions');

// TMS requests are system-written: this controller is deliberately read-only.
// There is no create/update/delete, matching create="false" edit="false"
// delete="false" on the demo's views.

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination({ ...req.query, limit: req.query.limit || 80 });
    const { search, status, requestedBy } = req.query;

    let where = {};
    if (status) where.status = status.includes(',') ? { [Op.in]: status.split(',') } : status;
    if (requestedBy) where.requestedBy = requestedBy;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { providerStatus: { [Op.like]: `%${search}%` } },
        { requestedBy: { [Op.like]: `%${search}%` } },
        { requestUuid: { [Op.like]: `%${search}%` } },
      ];
    }
    where = scopeToOwnDocuments(req, where, 'requestedById');

    const { count, rows } = await TMSRequest.findAndCountAll({
      where, order: [['requestDate', 'DESC']], limit, offset,
    });
    return successResponse(res, rows, 'TMS requests retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const rec = await TMSRequest.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'TMS request not found', 404);
    return successResponse(res, rec, 'TMS request retrieved');
  } catch (error) {
    next(error);
  }
};

// The Shipment ID column links to the source document. Resolving it is a read
// on house.shipment, so it is guarded separately — this is the path that
// produces the demo's Warning dialog.
exports.resolveDocument = async (req, res, next) => {
  try {
    const rec = await TMSRequest.findByPk(req.params.id);
    if (!rec) return errorResponse(res, 'TMS request not found', 404);

    const permissions = require('../services/permissionService');
    const ctx = req.permissions || await permissions.forUser(req.user);
    const model = rec.resModel || 'house.shipment';

    if (!permissions.can(ctx, model, 'read')) {
      const label = await permissions.labelFor(model);
      return res.status(403).json({
        success: false,
        message: permissions.denialMessage(label, model),
        accessDenied: { model, label, action: 'read' },
      });
    }

    return successResponse(res, {
      resModel: model,
      reference: rec.reference || rec.name,
      route: `/admin/house-shipments?search=${encodeURIComponent(rec.name)}`,
    }, 'Document resolved');
  } catch (error) {
    next(error);
  }
};

exports.getFacets = async (req, res, next) => {
  try {
    const rows = await TMSRequest.findAll({ attributes: ['requestedBy', 'status'], raw: true });
    return successResponse(res, {
      requesters: [...new Set(rows.map((r) => r.requestedBy).filter(Boolean))].sort(),
      statuses: [
        { key: 'init', label: 'Initialized' },
        { key: 'success', label: 'Success' },
        { key: 'fail', label: 'Failed' },
        { key: 'invalid', label: 'Invalid' },
      ],
    }, 'Facets retrieved');
  } catch (error) {
    next(error);
  }
};
