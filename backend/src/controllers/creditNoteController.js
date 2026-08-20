const { Op } = require('sequelize');
const { portalWhere } = require('../middleware/portalScope');
const { CreditNote, Invoice, Customer, User, Company } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');

const ALLOWED_SORT = ['createdAt', 'updatedAt', 'totalAmount', 'issuedDate', 'status', 'creditNoteNumber'];

const getIncludes = () => [
  { association: 'invoice', attributes: ['id', 'invoiceNumber', 'totalAmount', 'status', 'currency'] },
  { association: 'customer', attributes: ['id', 'companyName', 'contactName', 'email'] },
  { association: 'creator', attributes: ['id', 'name', 'email'] },
];

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const {
      status,
      customerId,
      invoiceId,
      search,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = req.query;

    // A portal login only ever sees its own customer's records.
    const where = { ...portalWhere(req) };
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (invoiceId) where.invoiceId = invoiceId;

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt[Op.gte] = new Date(dateFrom);
      if (dateTo) where.createdAt[Op.lte] = new Date(dateTo);
    }

    if (search) {
      where[Op.or] = [
        { creditNoteNumber: { [Op.like]: `%${search}%` } },
        { reason: { [Op.like]: `%${search}%` } },
      ];
    }

    const sortField = ALLOWED_SORT.includes(sortBy) ? sortBy : 'createdAt';
    const { count, rows } = await CreditNote.findAndCountAll({
      where,
      include: getIncludes(),
      order: [[sortField, sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    return successResponse(res, rows, 'Credit notes retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const creditNote = await CreditNote.findByPk(req.params.id, { include: getIncludes() });
    if (!creditNote) return errorResponse(res, 'Credit note not found', 404);
    return successResponse(res, creditNote, 'Credit note retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { invoiceId, customerId, reason, items = [], currency = 'USD', notes, companyId } = req.body;

    // Validate invoice exists
    const invoice = await Invoice.findByPk(invoiceId);
    if (!invoice) return errorResponse(res, 'Invoice not found', 404);

    if (invoice.status === 'cancelled') {
      return errorResponse(res, 'Cannot create credit note for a cancelled invoice', 400);
    }

    // Calculate amounts from items
    const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const taxAmount = parseFloat(req.body.taxAmount) || 0;
    const totalAmount = subtotal + taxAmount;

    const creditNote = await CreditNote.create({
      invoiceId,
      customerId: customerId || invoice.customerId,
      companyId,
      reason,
      items,
      subtotal,
      taxAmount,
      totalAmount,
      currency,
      notes,
      createdBy: req.user.id,
      status: 'draft',
    });

    const result = await CreditNote.findByPk(creditNote.id, { include: getIncludes() });

    if (req.io) req.io.emit('creditNote:created', { id: result.id, creditNoteNumber: result.creditNoteNumber });

    return successResponse(res, result, 'Credit note created', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const creditNote = await CreditNote.findByPk(req.params.id);
    if (!creditNote) return errorResponse(res, 'Credit note not found', 404);

    if (creditNote.status !== 'draft') {
      return errorResponse(res, 'Only draft credit notes can be edited', 400);
    }

    const { items, taxAmount } = req.body;

    const updateData = { ...req.body };

    // Recalculate amounts if items changed
    if (items) {
      updateData.subtotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
      updateData.taxAmount = parseFloat(taxAmount) || creditNote.taxAmount || 0;
      updateData.totalAmount = updateData.subtotal + updateData.taxAmount;
    }

    await creditNote.update(updateData);
    const result = await CreditNote.findByPk(creditNote.id, { include: getIncludes() });
    return successResponse(res, result, 'Credit note updated');
  } catch (error) {
    next(error);
  }
};

exports.issue = async (req, res, next) => {
  try {
    const creditNote = await CreditNote.findByPk(req.params.id, { include: getIncludes() });
    if (!creditNote) return errorResponse(res, 'Credit note not found', 404);

    if (creditNote.status !== 'draft') {
      return errorResponse(res, 'Only draft credit notes can be issued', 400);
    }

    await creditNote.update({
      status: 'issued',
      issuedDate: new Date(),
    });

    if (req.io) req.io.emit('creditNote:issued', { id: creditNote.id, creditNoteNumber: creditNote.creditNoteNumber });

    return successResponse(res, creditNote, 'Credit note issued successfully');
  } catch (error) {
    next(error);
  }
};

exports.apply = async (req, res, next) => {
  try {
    const { applyToInvoiceId } = req.body;
    const creditNote = await CreditNote.findByPk(req.params.id, { include: getIncludes() });
    if (!creditNote) return errorResponse(res, 'Credit note not found', 404);

    if (creditNote.status !== 'issued') {
      return errorResponse(res, 'Only issued credit notes can be applied', 400);
    }

    const targetInvoice = await Invoice.findByPk(applyToInvoiceId || creditNote.invoiceId);
    if (!targetInvoice) return errorResponse(res, 'Target invoice not found', 404);

    if (['paid', 'cancelled'].includes(targetInvoice.status)) {
      return errorResponse(res, 'Cannot apply credit note to a paid or cancelled invoice', 400);
    }

    // Reduce invoice balance
    const newBalance = parseFloat(targetInvoice.balanceAmount) - parseFloat(creditNote.totalAmount);
    const newPaidAmount = parseFloat(targetInvoice.paidAmount) + parseFloat(creditNote.totalAmount);
    const newStatus = newBalance <= 0 ? 'paid' : targetInvoice.status;

    await targetInvoice.update({
      balanceAmount: Math.max(0, newBalance),
      paidAmount: newPaidAmount,
      status: newStatus,
    });

    await creditNote.update({
      status: 'applied',
      appliedToInvoiceId: targetInvoice.id,
    });

    if (req.io) req.io.emit('creditNote:applied', { id: creditNote.id, invoiceId: targetInvoice.id });

    return successResponse(res, creditNote, 'Credit note applied to invoice');
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const creditNote = await CreditNote.findByPk(req.params.id);
    if (!creditNote) return errorResponse(res, 'Credit note not found', 404);

    if (creditNote.status !== 'draft') {
      return errorResponse(res, 'Only draft credit notes can be deleted', 400);
    }

    await creditNote.destroy();
    return successResponse(res, null, 'Credit note deleted');
  } catch (error) {
    next(error);
  }
};

exports.post = async (req, res, next) => {
  try {
    const creditNote = await CreditNote.findByPk(req.params.id);
    if (!creditNote) return errorResponse(res, 'Credit note not found', 404);
    if (creditNote.status !== 'draft') return errorResponse(res, 'Only draft credit notes can be posted', 400);

    await creditNote.update({ status: 'issued', issuedDate: new Date() });
    const result = await CreditNote.findByPk(creditNote.id, { include: getIncludes() });

    if (req.io) req.io.emit('creditNote:posted', { id: result.id, creditNoteNumber: result.creditNoteNumber });

    return successResponse(res, result, 'Credit note posted');
  } catch (error) {
    next(error);
  }
};

exports.cancel = async (req, res, next) => {
  try {
    const creditNote = await CreditNote.findByPk(req.params.id);
    if (!creditNote) return errorResponse(res, 'Credit note not found', 404);
    if (creditNote.status === 'cancelled') return errorResponse(res, 'Credit note already cancelled', 400);

    await creditNote.update({ status: 'cancelled' });
    const result = await CreditNote.findByPk(creditNote.id, { include: getIncludes() });
    return successResponse(res, result, 'Credit note cancelled');
  } catch (error) {
    next(error);
  }
};

exports.getStats = async (req, res, next) => {
  try {
    const statuses = ['draft', 'issued', 'applied', 'cancelled'];
    const byStatus = {};

    await Promise.all(
      statuses.map(async (status) => {
        const [count, totalAmount] = await Promise.all([
          CreditNote.count({ where: { status } }),
          CreditNote.sum('totalAmount', { where: { status } }),
        ]);
        byStatus[status] = { count, totalAmount: parseFloat(totalAmount) || 0 };
      })
    );

    return successResponse(res, { byStatus }, 'Credit note stats retrieved');
  } catch (error) {
    next(error);
  }
};

exports.getUserCreditNotes = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { status } = req.query;

    // For customer portal - find customer linked to this user
    const { Customer: CustomerModel } = require('../models');
    const customer = await CustomerModel.findOne({ where: { userId: req.user.id } });

    const where = customer ? { customerId: customer.id } : { customerId: null };
    if (status) where.status = status;

    const { count, rows } = await CreditNote.findAndCountAll({
      where,
      include: getIncludes(),
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    return successResponse(res, rows, 'Credit notes retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};
