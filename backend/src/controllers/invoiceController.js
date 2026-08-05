const { Op } = require('sequelize');
const { Invoice, InvoiceItem, Customer, Shipment, User } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');
const { sendInvoiceEmail } = require('../utils/emailService');

const getIncludes = (withItems = false) => {
  const includes = [
    { association: 'customer', attributes: ['id', 'companyName', 'contactName', 'email', 'address', 'city', 'country'] },
    { association: 'shipment', attributes: ['id', 'shipmentNumber', 'mode', 'status'] },
    { association: 'creator', attributes: ['id', 'name', 'email'] },
  ];
  if (withItems) {
    includes.push({ association: 'items', order: [['sortOrder', 'ASC']] });
  }
  return includes;
};

const calculateTotals = (items, taxRate = 0, discountAmount = 0) => {
  const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const taxAmount = items
    .filter((i) => i.taxable)
    .reduce((sum, item) => sum + ((parseFloat(item.amount) || 0) * (taxRate / 100)), 0);
  const totalAmount = subtotal + taxAmount - (parseFloat(discountAmount) || 0);
  return { subtotal, taxAmount, totalAmount };
};

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { status, type, customerId, search } = req.query;

    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (customerId) where.customerId = customerId;
    if (search) {
      where[Op.or] = [{ invoiceNumber: { [Op.like]: `%${search}%` } }];
    }

    const { count, rows } = await Invoice.findAndCountAll({
      where,
      include: getIncludes(false),
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    return successResponse(res, rows, 'Invoices retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const invoice = await Invoice.findByPk(req.params.id, { include: getIncludes(true) });
    if (!invoice) return errorResponse(res, 'Invoice not found', 404);
    return successResponse(res, invoice, 'Invoice retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { items = [], taxRate = 0, discountAmount = 0, ...invoiceData } = req.body;
    invoiceData.createdBy = req.user.id;

    // Calculate totals
    const { subtotal, taxAmount, totalAmount } = calculateTotals(items, taxRate, discountAmount);
    invoiceData.subtotal = subtotal;
    invoiceData.taxRate = taxRate;
    invoiceData.taxAmount = taxAmount;
    invoiceData.discountAmount = discountAmount;
    invoiceData.totalAmount = totalAmount;
    invoiceData.balanceAmount = totalAmount;

    const invoice = await Invoice.create(invoiceData);

    // Create items
    if (items.length > 0) {
      const itemsWithId = items.map((item, idx) => ({
        ...item,
        invoiceId: invoice.id,
        amount: (parseFloat(item.quantity) || 1) * parseFloat(item.unitPrice),
        sortOrder: idx,
      }));
      await InvoiceItem.bulkCreate(itemsWithId);
    }

    const result = await Invoice.findByPk(invoice.id, { include: getIncludes(true) });
    return successResponse(res, result, 'Invoice created', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const invoice = await Invoice.findByPk(req.params.id);
    if (!invoice) return errorResponse(res, 'Invoice not found', 404);
    if (['paid', 'cancelled'].includes(invoice.status)) {
      return errorResponse(res, 'Cannot edit a paid or cancelled invoice', 400);
    }

    const { items, taxRate, discountAmount, ...updateData } = req.body;

    if (items) {
      await InvoiceItem.destroy({ where: { invoiceId: invoice.id } });
      const itemsWithId = items.map((item, idx) => ({
        ...item,
        invoiceId: invoice.id,
        amount: (parseFloat(item.quantity) || 1) * parseFloat(item.unitPrice),
        sortOrder: idx,
      }));
      await InvoiceItem.bulkCreate(itemsWithId);

      const { subtotal, taxAmount, totalAmount } = calculateTotals(items, taxRate ?? invoice.taxRate, discountAmount ?? invoice.discountAmount);
      updateData.subtotal = subtotal;
      updateData.taxRate = taxRate ?? invoice.taxRate;
      updateData.taxAmount = taxAmount;
      updateData.discountAmount = discountAmount ?? invoice.discountAmount;
      updateData.totalAmount = totalAmount;
      updateData.balanceAmount = totalAmount - invoice.paidAmount;
    }

    await invoice.update(updateData);
    const result = await Invoice.findByPk(invoice.id, { include: getIncludes(true) });
    return successResponse(res, result, 'Invoice updated');
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const invoice = await Invoice.findByPk(req.params.id);
    if (!invoice) return errorResponse(res, 'Invoice not found', 404);
    if (['paid', 'sent'].includes(invoice.status)) {
      return errorResponse(res, 'Cannot delete a sent or paid invoice', 400);
    }
    await InvoiceItem.destroy({ where: { invoiceId: invoice.id } });
    await invoice.destroy();
    return successResponse(res, null, 'Invoice deleted');
  } catch (error) {
    next(error);
  }
};

exports.send = async (req, res, next) => {
  try {
    const invoice = await Invoice.findByPk(req.params.id, { include: getIncludes(true) });
    if (!invoice) return errorResponse(res, 'Invoice not found', 404);
    if (invoice.status !== 'draft') {
      return errorResponse(res, 'Only draft invoices can be sent', 400);
    }

    const recipientEmail = req.body.email || invoice.customer?.email;
    if (!recipientEmail) return errorResponse(res, 'Recipient email required', 400);

    await sendInvoiceEmail(invoice, invoice.customer, recipientEmail);
    await invoice.update({ status: 'sent' });

    return successResponse(res, invoice, 'Invoice sent successfully');
  } catch (error) {
    next(error);
  }
};

exports.recordPayment = async (req, res, next) => {
  try {
    const { amount, paymentDate, paymentMethod, paymentReference, notes } = req.body;
    const invoice = await Invoice.findByPk(req.params.id);
    if (!invoice) return errorResponse(res, 'Invoice not found', 404);
    if (['draft', 'cancelled'].includes(invoice.status)) {
      return errorResponse(res, 'Cannot record payment for this invoice', 400);
    }

    const payAmount = parseFloat(amount);
    const newPaid = parseFloat(invoice.paidAmount) + payAmount;
    const newBalance = parseFloat(invoice.totalAmount) - newPaid;

    let newStatus = invoice.status;
    if (newBalance <= 0) {
      newStatus = 'paid';
    } else if (newPaid > 0) {
      newStatus = 'partially_paid';
    }

    await invoice.update({
      paidAmount: newPaid,
      balanceAmount: Math.max(0, newBalance),
      status: newStatus,
      paymentDate: paymentDate || new Date(),
      paymentMethod: paymentMethod || invoice.paymentMethod,
      paymentReference: paymentReference || invoice.paymentReference,
    });

    return successResponse(res, invoice, 'Payment recorded');
  } catch (error) {
    next(error);
  }
};

exports.createCreditNote = async (req, res, next) => {
  try {
    const sourceInvoice = await Invoice.findByPk(req.params.id, { include: [{ association: 'items' }] });
    if (!sourceInvoice) return errorResponse(res, 'Invoice not found', 404);

    const { amount, reason, items: creditItems } = req.body;
    const creditAmount = parseFloat(amount) || parseFloat(sourceInvoice.totalAmount);

    const creditNote = await Invoice.create({
      type: 'credit_note',
      customerId: sourceInvoice.customerId,
      shipmentId: sourceInvoice.shipmentId,
      createdBy: req.user.id,
      status: 'sent',
      issueDate: new Date(),
      dueDate: new Date(),
      currency: sourceInvoice.currency,
      subtotal: creditAmount,
      totalAmount: creditAmount,
      balanceAmount: creditAmount,
      linkedCreditNoteId: sourceInvoice.id,
      notes: reason || `Credit note for invoice ${sourceInvoice.invoiceNumber}`,
    });

    if (creditItems?.length > 0) {
      await InvoiceItem.bulkCreate(creditItems.map((item, idx) => ({
        ...item,
        invoiceId: creditNote.id,
        amount: (parseFloat(item.quantity) || 1) * parseFloat(item.unitPrice),
        sortOrder: idx,
      })));
    }

    const result = await Invoice.findByPk(creditNote.id, { include: getIncludes(true) });
    return successResponse(res, result, 'Credit note created', 201);
  } catch (error) {
    next(error);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const invoice = await Invoice.findByPk(req.params.id);
    if (!invoice) return errorResponse(res, 'Invoice not found', 404);

    await invoice.update({ status });
    return successResponse(res, invoice, 'Invoice status updated');
  } catch (error) {
    next(error);
  }
};
