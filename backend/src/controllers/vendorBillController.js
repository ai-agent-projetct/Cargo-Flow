const { Op, fn, col } = require('sequelize');
const { VendorBill, Customer, FFJob, ServiceJob, Company, User } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');

const ALLOWED_SORT = ['createdAt', 'updatedAt', 'billNumber', 'billDate', 'dueDate', 'totalAmount', 'status'];

const getIncludes = () => [
  { association: 'vendor', attributes: ['id', 'companyName', 'contactName', 'email'] },
  { association: 'ffJob', attributes: ['id', 'jobNumber', 'status'] },
  { association: 'serviceJob', attributes: ['id', 'jobNumber', 'serviceType', 'status'] },
  { association: 'creator', attributes: ['id', 'name', 'email'] },
];

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const {
      status,
      vendorId,
      ffJobId,
      serviceJobId,
      search,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = req.query;

    const where = {};
    if (status) where.status = status;
    if (vendorId) where.vendorId = vendorId;
    if (ffJobId) where.ffJobId = ffJobId;
    if (serviceJobId) where.serviceJobId = serviceJobId;

    if (dateFrom || dateTo) {
      where.billDate = {};
      if (dateFrom) where.billDate[Op.gte] = dateFrom;
      if (dateTo) where.billDate[Op.lte] = dateTo;
    }

    if (search) {
      where[Op.or] = [
        { billNumber: { [Op.like]: `%${search}%` } },
        { notes: { [Op.like]: `%${search}%` } },
      ];
    }

    const sortField = ALLOWED_SORT.includes(sortBy) ? sortBy : 'createdAt';
    const { count, rows } = await VendorBill.findAndCountAll({
      where,
      include: getIncludes(),
      order: [[sortField, sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    return successResponse(res, rows, 'Vendor bills retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const bill = await VendorBill.findByPk(req.params.id, { include: getIncludes() });
    if (!bill) return errorResponse(res, 'Vendor bill not found', 404);
    return successResponse(res, bill, 'Vendor bill retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const data = { ...req.body, createdBy: req.user.id };

    if (!data.vendorId) return errorResponse(res, 'vendorId is required', 400);

    // Calculate totals from items
    if (data.items && Array.isArray(data.items)) {
      data.subtotal = data.items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
      data.taxAmount = parseFloat(data.taxAmount) || 0;
      data.totalAmount = data.subtotal + data.taxAmount;
    }
    data.balance = (parseFloat(data.totalAmount) || 0) - (parseFloat(data.amountPaid) || 0);

    const bill = await VendorBill.create(data);
    const result = await VendorBill.findByPk(bill.id, { include: getIncludes() });

    if (req.io) req.io.emit('vendorBill:created', { id: result.id, billNumber: result.billNumber });

    return successResponse(res, result, 'Vendor bill created', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const bill = await VendorBill.findByPk(req.params.id);
    if (!bill) return errorResponse(res, 'Vendor bill not found', 404);

    if (['paid', 'cancelled'].includes(bill.status)) {
      return errorResponse(res, `Cannot edit a ${bill.status} vendor bill`, 400);
    }

    const updateData = { ...req.body };

    if (updateData.items && Array.isArray(updateData.items)) {
      updateData.subtotal = updateData.items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
      updateData.taxAmount = parseFloat(updateData.taxAmount ?? bill.taxAmount) || 0;
      updateData.totalAmount = updateData.subtotal + updateData.taxAmount;
    }
    if (updateData.totalAmount !== undefined || updateData.amountPaid !== undefined) {
      updateData.balance = (parseFloat(updateData.totalAmount ?? bill.totalAmount) || 0)
        - (parseFloat(updateData.amountPaid ?? bill.amountPaid) || 0);
    }

    await bill.update(updateData);
    const result = await VendorBill.findByPk(bill.id, { include: getIncludes() });
    return successResponse(res, result, 'Vendor bill updated');
  } catch (error) {
    next(error);
  }
};

exports.post = async (req, res, next) => {
  try {
    const bill = await VendorBill.findByPk(req.params.id);
    if (!bill) return errorResponse(res, 'Vendor bill not found', 404);
    if (bill.status !== 'draft') return errorResponse(res, 'Only draft bills can be posted', 400);

    await bill.update({ status: 'posted' });
    const result = await VendorBill.findByPk(bill.id, { include: getIncludes() });
    return successResponse(res, result, 'Vendor bill posted');
  } catch (error) {
    next(error);
  }
};

exports.markPaid = async (req, res, next) => {
  try {
    const bill = await VendorBill.findByPk(req.params.id);
    if (!bill) return errorResponse(res, 'Vendor bill not found', 404);
    if (!['draft', 'posted'].includes(bill.status)) {
      return errorResponse(res, 'Only draft or posted bills can be marked as paid', 400);
    }

    const amountPaid = parseFloat(req.body.amountPaid) || parseFloat(bill.totalAmount);
    await bill.update({
      status: 'paid',
      amountPaid,
      balance: Math.max(0, parseFloat(bill.totalAmount) - amountPaid),
    });

    const result = await VendorBill.findByPk(bill.id, { include: getIncludes() });
    return successResponse(res, result, 'Vendor bill marked as paid');
  } catch (error) {
    next(error);
  }
};

exports.cancel = async (req, res, next) => {
  try {
    const bill = await VendorBill.findByPk(req.params.id);
    if (!bill) return errorResponse(res, 'Vendor bill not found', 404);
    if (bill.status === 'cancelled') return errorResponse(res, 'Bill is already cancelled', 400);
    if (bill.status === 'paid') return errorResponse(res, 'Paid bills cannot be cancelled', 400);

    await bill.update({ status: 'cancelled' });
    const result = await VendorBill.findByPk(bill.id, { include: getIncludes() });
    return successResponse(res, result, 'Vendor bill cancelled');
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const bill = await VendorBill.findByPk(req.params.id);
    if (!bill) return errorResponse(res, 'Vendor bill not found', 404);
    if (bill.status !== 'draft') return errorResponse(res, 'Only draft bills can be deleted', 400);

    await bill.destroy();
    return successResponse(res, null, 'Vendor bill deleted');
  } catch (error) {
    next(error);
  }
};

exports.getStats = async (req, res, next) => {
  try {
    const statuses = ['draft', 'posted', 'paid', 'cancelled'];
    const stats = {};

    await Promise.all(
      statuses.map(async (status) => {
        const [count, total] = await Promise.all([
          VendorBill.count({ where: { status } }),
          VendorBill.sum('totalAmount', { where: { status } }),
        ]);
        stats[status] = { count, totalAmount: parseFloat(total) || 0 };
      })
    );

    const totalOutstanding = await VendorBill.sum('balance', {
      where: { status: { [Op.in]: ['draft', 'posted'] } },
    });

    return successResponse(res, { byStatus: stats, totalOutstanding: parseFloat(totalOutstanding) || 0 }, 'Vendor bill stats retrieved');
  } catch (error) {
    next(error);
  }
};
