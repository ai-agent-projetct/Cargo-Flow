const { Op } = require('sequelize');
const { PurchaseOrder, VendorBill } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');

const actorName = (req) =>
  req.user?.name
  || [req.user?.first_name, req.user?.last_name].filter(Boolean).join(' ')
  || req.user?.email
  || 'Administrator';

// Every response carries the button-visibility map so the form never has to
// re-derive the demo's attrs rules on the client.
const withActions = (record) => ({ ...record.toJSON(), actions: record.availableActions() });

// Blank date inputs arrive as '' and MySQL rejects them, so normalise to null.
const DATE_FIELDS = ['poDate', 'vendorInvoiceDate', 'approvedDate'];
const normalise = (body) => {
  const out = { ...body };
  DATE_FIELDS.forEach((f) => { if (out[f] === '') out[f] = null; });
  return out;
};

const logEntry = (author, body, changes = []) => ({
  at: new Date().toISOString(), author, kind: 'log', body, changes,
});

const pushLog = (record, entry) => [entry, ...(record.activityLog || [])];

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { state, vendor, priority, search } = req.query;

    const where = {};
    if (state) where.state = state.includes(',') ? { [Op.in]: state.split(',') } : state;
    if (vendor) where.vendor = vendor;
    if (priority) where.priority = Number(priority);
    if (search) {
      where[Op.or] = [
        { poNumber: { [Op.like]: `%${search}%` } },
        { vendor: { [Op.like]: `%${search}%` } },
        { shipmentNo: { [Op.like]: `%${search}%` } },
        { vendorInvoiceNo: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await PurchaseOrder.findAndCountAll({
      where, order: [['poDate', 'DESC']], limit, offset,
    });
    return successResponse(res, rows, 'Purchase orders retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const record = await PurchaseOrder.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Purchase order not found', 404);
    return successResponse(res, withActions(record), 'Purchase order retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const author = actorName(req);
    const record = await PurchaseOrder.create({
      ...normalise(req.body),
      state: 'draft',
      createdByName: req.body.createdByName || author,
      createdBy: req.user?.id || null,
      activityLog: [logEntry(author, 'Purchase Order created')],
    });
    return successResponse(res, withActions(record), 'Purchase order created', 201);
  } catch (error) {
    next(error);
  }
};

// Fields whose edits show up in the chatter, the way the demo tracks them.
const TRACKED_FIELDS = {
  vendor: 'Vendor',
  shipmentNo: 'Shipment No',
  vendorInvoiceNo: 'Vendor Invoice No',
  vendorInvoiceDate: 'Vendor Invoice Date',
  contact: 'Contact',
  purchaseApprover: 'Purchase Approver',
  currency: 'Currency',
};

exports.update = async (req, res, next) => {
  try {
    const record = await PurchaseOrder.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Purchase order not found', 404);
    // Approved/cancelled/rejected POs are read-only in the demo.
    if (!['draft', 'to_approve'].includes(record.state)) {
      return errorResponse(res, `A ${record.state.replace('_', ' ')} purchase order cannot be edited`, 400);
    }

    const changes = Object.entries(TRACKED_FIELDS)
      .filter(([field]) => field in req.body && String(req.body[field] ?? '') !== String(record[field] ?? ''))
      .map(([field, label]) => ({ field: label, from: record[field] || '', to: req.body[field] || '' }));

    // state is only moved by the workflow endpoints below.
    const { state, poNumber, activityLog, ...patch } = normalise(req.body);
    await record.update({
      ...patch,
      ...(changes.length ? { activityLog: pushLog(record, logEntry(actorName(req), '', changes)) } : {}),
    });
    return successResponse(res, withActions(record), 'Purchase order updated');
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const record = await PurchaseOrder.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Purchase order not found', 404);
    if ((record.billCount || 0) > 0) {
      return errorResponse(res, 'Cannot delete a purchase order that has vendor bills', 400);
    }
    await record.destroy();
    return successResponse(res, null, 'Purchase order deleted');
  } catch (error) {
    next(error);
  }
};

// Action ▸ Duplicate — new number, back to RFQ, no bills, fresh chatter.
exports.duplicate = async (req, res, next) => {
  try {
    const source = await PurchaseOrder.findByPk(req.params.id);
    if (!source) return errorResponse(res, 'Purchase order not found', 404);

    const { id, poNumber, createdAt, updatedAt, activityLog, ...rest } = source.toJSON();
    const copy = await PurchaseOrder.create({
      ...rest,
      poNumber: undefined, // regenerated by the model hook
      state: 'draft',
      poDate: new Date(),
      billCount: 0,
      approvedByName: null,
      approvedDate: null,
      cancelReason: null,
      cancelRemark: null,
      createdByName: actorName(req),
      createdBy: req.user?.id || null,
      activityLog: [logEntry(actorName(req), `Duplicated from ${poNumber}`)],
    });
    return successResponse(res, withActions(copy), 'Purchase order duplicated', 201);
  } catch (error) {
    next(error);
  }
};

// ---- Workflow -------------------------------------------------------------
// Each transition re-checks the same guard the button visibility uses, so a
// stale form can't push a PO into an illegal state.

const transition = (guardKey, apply, message) => async (req, res, next) => {
  try {
    const record = await PurchaseOrder.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Purchase order not found', 404);
    if (!record.availableActions()[guardKey]) {
      return errorResponse(res, `${message} is not available for this purchase order`, 400);
    }
    const patch = apply(record, req);
    await record.update(patch);
    return successResponse(res, withActions(record), `${message} done`);
  } catch (error) {
    next(error);
  }
};

exports.sendForApproval = transition('sendForApproval', (record, req) => ({
  state: 'to_approve',
  purchaseApprover: req.body.purchaseApprover || record.purchaseApprover || actorName(req),
  activityLog: pushLog(record, logEntry(actorName(req), 'Sent for approval', [
    { field: 'Status', from: 'RFQ', to: 'To Approve' },
  ])),
}), 'Send for Approval');

exports.approve = transition('approve', (record, req) => ({
  state: 'approved',
  approvedByName: actorName(req),
  approvedDate: new Date().toISOString().slice(0, 10),
  activityLog: pushLog(record, logEntry(actorName(req), 'Purchase Order approved', [
    { field: 'Status', from: 'To Approve', to: 'Approved' },
  ])),
}), 'Approve');

exports.reject = transition('reject', (record, req) => ({
  state: 'reject',
  activityLog: pushLog(record, logEntry(actorName(req), req.body.reason || 'Purchase Order rejected', [
    { field: 'Status', from: 'To Approve', to: 'Rejected' },
  ])),
}), 'Reject');

exports.cancel = transition('cancelPO', (record, req) => ({
  state: 'cancel',
  cancelReason: req.body.cancelReason || null,
  cancelRemark: req.body.cancelRemark || null,
  activityLog: pushLog(record, logEntry(
    actorName(req),
    `Purchase Order cancelled${req.body.cancelReason ? ` — ${req.body.cancelReason}` : ''}`,
    [{ field: 'Status', from: record.state === 'draft' ? 'RFQ' : 'Approved', to: 'Cancelled' }],
  )),
}), 'Cancel PO');

// Create Vendor Bill — raises a draft bill from the charge lines and links it
// back to the PO. Once a bill exists, Create Vendor Bill and Cancel PO both
// disappear (bill_count > 0 in the demo).
exports.createVendorBill = async (req, res, next) => {
  try {
    const record = await PurchaseOrder.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Purchase order not found', 404);
    if (!record.availableActions().createVendorBill) {
      return errorResponse(res, 'Create Vendor Bill is not available for this purchase order', 400);
    }

    const lines = Array.isArray(record.chargeLines) ? record.chargeLines : [];
    const bill = await VendorBill.create({
      purchaseOrderId: record.id,
      vendorName: record.vendor,
      billDate: new Date().toISOString().slice(0, 10),
      currency: record.currency || 'AED',
      subtotal: record.amountTotal,
      totalAmount: record.amountTotal,
      status: 'draft',
      notes: `Generated from purchase order ${record.poNumber}`,
      items: lines.map((l) => ({
        description: l.product,
        quantity: Number(l.noOfUnit || 0),
        unitPrice: Number(l.amountPerUnit || 0),
        amount: Number(l.orderCurrencyTotalAmount || l.amount || 0),
        category: 'purchase',
      })),
      createdBy: req.user?.id || null,
    });

    await record.update({
      billCount: (record.billCount || 0) + 1,
      activityLog: pushLog(record, logEntry(actorName(req), `Vendor bill ${bill.billNumber} created`)),
    });

    return successResponse(res, { purchaseOrder: withActions(record), bill }, 'Vendor bill created', 201);
  } catch (error) {
    next(error);
  }
};

// The Bills stat button on the form.
exports.getBills = async (req, res, next) => {
  try {
    const rows = await VendorBill.findAll({
      where: { purchaseOrderId: req.params.id },
      order: [['createdAt', 'DESC']],
    });
    return successResponse(res, rows, 'Bills retrieved');
  } catch (error) {
    next(error);
  }
};

// Action ▸ Send Reminder / Share — both just drop a note on the chatter, which
// is all the demo surfaces to the user.
exports.addActivity = async (req, res, next) => {
  try {
    const record = await PurchaseOrder.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Purchase order not found', 404);
    const entry = {
      at: new Date().toISOString(),
      author: actorName(req),
      kind: req.body.kind || 'message',
      body: req.body.body || '',
      changes: [],
    };
    await record.update({ activityLog: pushLog(record, entry) });
    return successResponse(res, entry, 'Activity logged', 201);
  } catch (error) {
    next(error);
  }
};

// The list's favourite star.
exports.setPriority = async (req, res, next) => {
  try {
    const record = await PurchaseOrder.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Purchase order not found', 404);
    await record.update({ priority: req.body.priority ? 1 : 0 });
    return successResponse(res, { id: record.id, priority: record.priority }, 'Priority updated');
  } catch (error) {
    next(error);
  }
};
