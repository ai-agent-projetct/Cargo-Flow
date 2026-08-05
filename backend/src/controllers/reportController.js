const { Op, fn, col, literal } = require('sequelize');
const {
  Shipment, Invoice, Quotation, Customer, Carrier, Port, Rate,
  CFSReceipt, CFSDelivery, Consolidation, ShipmentSharing, ServiceJob,
} = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');

exports.getShipmentReport = async (req, res, next) => {
  try {
    const { startDate, endDate, mode, status, groupBy = 'month' } = req.query;

    const where = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }
    if (mode) where.mode = mode;
    if (status) where.status = status;

    const [byMode, byStatus, byMonth] = await Promise.all([
      Shipment.findAll({
        attributes: ['mode', [fn('COUNT', col('id')), 'count']],
        where,
        group: ['mode'],
        raw: true,
      }),
      Shipment.findAll({
        attributes: ['status', [fn('COUNT', col('id')), 'count']],
        where,
        group: ['status'],
        raw: true,
      }),
      Shipment.findAll({
        attributes: [
          [fn('YEAR', col('createdAt')), 'year'],
          [fn('MONTH', col('createdAt')), 'month'],
          [fn('COUNT', col('id')), 'count'],
        ],
        where,
        group: [fn('YEAR', col('createdAt')), fn('MONTH', col('createdAt'))],
        order: [[fn('YEAR', col('createdAt')), 'ASC'], [fn('MONTH', col('createdAt')), 'ASC']],
        raw: true,
      }),
    ]);

    return successResponse(res, {
      byMode: byMode.map((r) => ({ ...r, count: parseInt(r.count) })),
      byStatus: byStatus.map((r) => ({ ...r, count: parseInt(r.count) })),
      byMonth: byMonth.map((r) => ({ ...r, count: parseInt(r.count) })),
    }, 'Shipment report generated');
  } catch (error) {
    next(error);
  }
};

exports.getRevenueReport = async (req, res, next) => {
  try {
    const { startDate, endDate, currency = 'USD' } = req.query;

    const where = { status: { [Op.in]: ['paid', 'partially_paid'] } };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }
    if (currency) where.currency = currency;

    const [monthly, byStatus, summary] = await Promise.all([
      Invoice.findAll({
        attributes: [
          [fn('YEAR', col('createdAt')), 'year'],
          [fn('MONTH', col('createdAt')), 'month'],
          [fn('SUM', col('totalAmount')), 'revenue'],
          [fn('SUM', col('paidAmount')), 'collected'],
          [fn('COUNT', col('id')), 'count'],
        ],
        where,
        group: [fn('YEAR', col('createdAt')), fn('MONTH', col('createdAt'))],
        order: [[fn('YEAR', col('createdAt')), 'ASC'], [fn('MONTH', col('createdAt')), 'ASC']],
        raw: true,
      }),
      Invoice.findAll({
        attributes: ['status', [fn('SUM', col('totalAmount')), 'total'], [fn('COUNT', col('id')), 'count']],
        where: { createdAt: where.createdAt || {} },
        group: ['status'],
        raw: true,
      }),
      Invoice.findAll({
        attributes: [
          [fn('SUM', col('totalAmount')), 'totalRevenue'],
          [fn('SUM', col('paidAmount')), 'totalCollected'],
          [fn('SUM', col('balanceAmount')), 'totalOutstanding'],
          [fn('COUNT', col('id')), 'totalInvoices'],
        ],
        where: { createdAt: where.createdAt || {} },
        raw: true,
      }),
    ]);

    return successResponse(res, {
      monthly: monthly.map((r) => ({ ...r, revenue: parseFloat(r.revenue) || 0, collected: parseFloat(r.collected) || 0 })),
      byStatus: byStatus.map((r) => ({ ...r, total: parseFloat(r.total) || 0 })),
      summary: summary[0] ? {
        totalRevenue: parseFloat(summary[0].totalRevenue) || 0,
        totalCollected: parseFloat(summary[0].totalCollected) || 0,
        totalOutstanding: parseFloat(summary[0].totalOutstanding) || 0,
        totalInvoices: parseInt(summary[0].totalInvoices) || 0,
      } : {},
    }, 'Revenue report generated');
  } catch (error) {
    next(error);
  }
};

exports.getQuotationReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const where = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    const [byStatus, byMode, conversionRate] = await Promise.all([
      Quotation.findAll({
        attributes: ['status', [fn('COUNT', col('id')), 'count']],
        where,
        group: ['status'],
        raw: true,
      }),
      Quotation.findAll({
        attributes: ['mode', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('totalAmount')), 'totalValue']],
        where,
        group: ['mode'],
        raw: true,
      }),
      Quotation.findAll({
        attributes: [
          [fn('COUNT', col('id')), 'total'],
          [fn('SUM', literal("CASE WHEN status = 'converted' THEN 1 ELSE 0 END")), 'converted'],
          [fn('SUM', literal("CASE WHEN status = 'approved' THEN 1 ELSE 0 END")), 'approved'],
        ],
        where,
        raw: true,
      }),
    ]);

    const stats = conversionRate[0] || {};
    const total = parseInt(stats.total) || 0;
    const converted = parseInt(stats.converted) || 0;

    return successResponse(res, {
      byStatus: byStatus.map((r) => ({ ...r, count: parseInt(r.count) })),
      byMode: byMode.map((r) => ({ ...r, count: parseInt(r.count), totalValue: parseFloat(r.totalValue) || 0 })),
      conversionRate: total > 0 ? ((converted / total) * 100).toFixed(1) : 0,
      summary: { total, converted, approved: parseInt(stats.approved) || 0 },
    }, 'Quotation report generated');
  } catch (error) {
    next(error);
  }
};

exports.getCustomerReport = async (req, res, next) => {
  try {
    const topCustomers = await Customer.findAll({
      attributes: [
        'id', 'companyName', 'country', 'type',
      ],
      include: [
        {
          association: 'shipments',
          attributes: [],
          required: false,
        },
        {
          association: 'invoices',
          attributes: [],
          where: { status: 'paid' },
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: 20,
    });

    // Get revenue per customer
    const customerRevenue = await Promise.all(
      topCustomers.map(async (c) => {
        const revenue = await Invoice.sum('totalAmount', { where: { customerId: c.id, status: 'paid' } }) || 0;
        const shipments = await Shipment.count({ where: { customerId: c.id } });
        return { ...c.toJSON(), revenue: parseFloat(revenue), shipments };
      })
    );

    customerRevenue.sort((a, b) => b.revenue - a.revenue);

    return successResponse(res, customerRevenue, 'Customer report generated');
  } catch (error) {
    next(error);
  }
};

exports.getOperationsReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const where = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    const [
      cfsReceiptsByStatus,
      cfsDeliveriesByStatus,
      consolidationsByStatus,
      sharingsByDirection,
      serviceJobsByType,
    ] = await Promise.all([
      CFSReceipt.findAll({ attributes: ['status', [fn('COUNT', col('id')), 'count']], where, group: ['status'], raw: true }),
      CFSDelivery.findAll({ attributes: ['status', [fn('COUNT', col('id')), 'count']], where, group: ['status'], raw: true }),
      Consolidation.findAll({ attributes: ['status', [fn('COUNT', col('id')), 'count']], where, group: ['status'], raw: true }),
      ShipmentSharing.findAll({ attributes: ['direction', [fn('COUNT', col('id')), 'count']], where, group: ['direction'], raw: true }),
      ServiceJob.findAll({ attributes: ['serviceType', [fn('COUNT', col('id')), 'count']], where, group: ['serviceType'], raw: true }),
    ]);

    const toCount = (rows) => rows.map((r) => ({ ...r, count: parseInt(r.count) }));

    return successResponse(res, {
      cfsReceipts: toCount(cfsReceiptsByStatus),
      cfsDeliveries: toCount(cfsDeliveriesByStatus),
      consolidations: toCount(consolidationsByStatus),
      shipmentSharings: toCount(sharingsByDirection),
      serviceJobsByType: toCount(serviceJobsByType),
    }, 'Operations report generated');
  } catch (error) {
    next(error);
  }
};

exports.getAgingReport = async (req, res, next) => {
  try {
    const outstanding = await Invoice.findAll({
      where: { status: { [Op.in]: ['sent', 'partially_paid', 'overdue'] } },
      include: [{ association: 'customer', attributes: ['id', 'companyName'] }],
      order: [['dueDate', 'ASC']],
    });

    const now = new Date();
    const buckets = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    const invoices = outstanding.map((inv) => {
      const balance = parseFloat(inv.balanceAmount) || 0;
      const dueDate = inv.dueDate ? new Date(inv.dueDate) : null;
      const daysOverdue = dueDate ? Math.floor((now - dueDate) / (1000 * 60 * 60 * 24)) : 0;

      let bucket = 'current';
      if (daysOverdue > 90) bucket = '90+';
      else if (daysOverdue > 60) bucket = '61-90';
      else if (daysOverdue > 30) bucket = '31-60';
      else if (daysOverdue > 0) bucket = '1-30';

      buckets[bucket] += balance;

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customer: inv.customer?.companyName || '-',
        dueDate: inv.dueDate,
        balanceAmount: balance,
        daysOverdue,
        bucket,
      };
    });

    return successResponse(res, { buckets, invoices }, 'Aging report generated');
  } catch (error) {
    next(error);
  }
};

exports.getCarrierPerformance = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const where = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    const carriers = await Carrier.findAll({ where: { status: 'active' } });

    const performance = await Promise.all(carriers.map(async (carrier) => {
      const total = await Shipment.count({ where: { ...where, carrierId: carrier.id } });
      const onTime = await Shipment.count({
        where: {
          ...where,
          carrierId: carrier.id,
          status: 'delivered',
          actualArrival: { [Op.lte]: literal('estimatedArrival') },
        },
      });

      return {
        carrier: { id: carrier.id, name: carrier.name, type: carrier.type },
        totalShipments: total,
        onTimeDeliveries: onTime,
        onTimeRate: total > 0 ? ((onTime / total) * 100).toFixed(1) : 0,
      };
    }));

    performance.sort((a, b) => b.totalShipments - a.totalShipments);

    return successResponse(res, performance, 'Carrier performance report');
  } catch (error) {
    next(error);
  }
};
