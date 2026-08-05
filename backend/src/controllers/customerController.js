const { Op } = require('sequelize');
const { Customer, User, Shipment, Invoice, Quotation } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');

const getIncludes = () => [
  { association: 'assignedUser', attributes: ['id', 'name', 'email', 'avatar'] },
];

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { status, type, assignedTo, search } = req.query;

    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (assignedTo) where.assignedTo = assignedTo;
    if (search) {
      where[Op.or] = [
        { companyName: { [Op.like]: `%${search}%` } },
        { contactName: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { country: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Customer.findAndCountAll({
      where,
      include: getIncludes(),
      order: [['companyName', 'ASC']],
      limit,
      offset,
      distinct: true,
    });

    return successResponse(res, rows, 'Customers retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const customer = await Customer.findByPk(req.params.id, { include: getIncludes() });
    if (!customer) return errorResponse(res, 'Customer not found', 404);

    // Stats
    const [shipmentCount, quotationCount, invoiceCount, totalRevenue] = await Promise.all([
      Shipment.count({ where: { customerId: customer.id } }),
      Quotation.count({ where: { customerId: customer.id } }),
      Invoice.count({ where: { customerId: customer.id } }),
      Invoice.sum('totalAmount', { where: { customerId: customer.id, status: 'paid' } }),
    ]);

    const data = {
      ...customer.toJSON(),
      stats: {
        shipments: shipmentCount,
        quotations: quotationCount,
        invoices: invoiceCount,
        totalRevenue: parseFloat(totalRevenue) || 0,
      },
    };

    return successResponse(res, data, 'Customer retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const customer = await Customer.create(req.body);
    const result = await Customer.findByPk(customer.id, { include: getIncludes() });
    return successResponse(res, result, 'Customer created', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return errorResponse(res, 'Customer not found', 404);
    await customer.update(req.body);
    const result = await Customer.findByPk(customer.id, { include: getIncludes() });
    return successResponse(res, result, 'Customer updated');
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return errorResponse(res, 'Customer not found', 404);

    const hasShipments = await Shipment.count({ where: { customerId: customer.id } });
    if (hasShipments > 0) {
      return errorResponse(res, 'Cannot delete customer with existing shipments', 400);
    }

    await customer.destroy();
    return successResponse(res, null, 'Customer deleted');
  } catch (error) {
    next(error);
  }
};

exports.getShipments = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { count, rows } = await Shipment.findAndCountAll({
      where: { customerId: req.params.id },
      include: [
        { association: 'originPort', attributes: ['name', 'code'] },
        { association: 'destinationPort', attributes: ['name', 'code'] },
        { association: 'carrier', attributes: ['name'] },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
    return successResponse(res, rows, 'Customer shipments', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getInvoices = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { count, rows } = await Invoice.findAndCountAll({
      where: { customerId: req.params.id },
      include: [{ association: 'items' }],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
    return successResponse(res, rows, 'Customer invoices', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getQuotations = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { count, rows } = await Quotation.findAndCountAll({
      where: { customerId: req.params.id },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
    return successResponse(res, rows, 'Customer quotations', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};
