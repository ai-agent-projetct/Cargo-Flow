const { Op, fn, col, literal } = require('sequelize');
const { sequelize } = require('../config/database');
const { Shipment, Quotation, Invoice, Customer, Job, Notification, TrackingEvent, FFJob, ServiceJob, CreditNote, Opportunity, VendorBill, FreightBooking, Carrier, Port, User, Event } = require('../models');
const { successResponse, errorResponse } = require('../utils/helpers');

// Helper to count items grouped by a label function and return [{label, count}], sorted desc
const groupCount = (items, labelFn, limit) => {
  const map = new Map();
  items.forEach((item) => {
    const label = labelFn(item) || 'Unknown';
    map.set(label, (map.get(label) || 0) + 1);
  });
  let arr = Array.from(map.entries()).map(([label, count]) => ({ label, count }));
  arr.sort((a, b) => b.count - a.count);
  if (limit) arr = arr.slice(0, limit);
  return arr;
};

exports.getKPIs = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Shipments stats
    const totalShipments = await Shipment.count();
    const activeShipments = await Shipment.count({
      where: { status: { [Op.in]: ['booking_confirmed', 'cargo_received', 'customs_clearance', 'loaded', 'departed', 'in_transit', 'arrived'] } },
    });
    const shipmentsThisMonth = await Shipment.count({ where: { createdAt: { [Op.gte]: startOfMonth } } });
    const shipmentsLastMonth = await Shipment.count({
      where: { createdAt: { [Op.between]: [startOfLastMonth, endOfLastMonth] } },
    });

    // Revenue stats
    const revenueThisMonth = await Invoice.sum('totalAmount', {
      where: { status: 'paid', createdAt: { [Op.gte]: startOfMonth } },
    }) || 0;
    const revenueLastMonth = await Invoice.sum('totalAmount', {
      where: { status: 'paid', createdAt: { [Op.between]: [startOfLastMonth, endOfLastMonth] } },
    }) || 0;

    // Outstanding invoices
    const outstandingAmount = await Invoice.sum('balanceAmount', {
      where: { status: { [Op.in]: ['sent', 'partially_paid', 'overdue'] } },
    }) || 0;
    const overdueInvoices = await Invoice.count({ where: { status: 'overdue' } });

    // Quotations
    const pendingQuotations = await Quotation.count({ where: { status: 'sent' } });
    const quotationsThisMonth = await Quotation.count({ where: { createdAt: { [Op.gte]: startOfMonth } } });

    // Customers
    const totalCustomers = await Customer.count();
    const newCustomersThisMonth = await Customer.count({ where: { createdAt: { [Op.gte]: startOfMonth } } });

    // Jobs
    const openJobs = await Job.count({ where: { status: { [Op.in]: ['pending', 'in_progress'] } } });

    // Growth calculations
    const shipmentGrowth = shipmentsLastMonth > 0
      ? (((shipmentsThisMonth - shipmentsLastMonth) / shipmentsLastMonth) * 100).toFixed(1)
      : 100;
    const revenueGrowth = revenueLastMonth > 0
      ? (((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100).toFixed(1)
      : 100;

    const kpis = {
      shipments: {
        total: totalShipments,
        active: activeShipments,
        thisMonth: shipmentsThisMonth,
        growth: parseFloat(shipmentGrowth),
      },
      revenue: {
        thisMonth: parseFloat(revenueThisMonth),
        lastMonth: parseFloat(revenueLastMonth),
        growth: parseFloat(revenueGrowth),
        outstanding: parseFloat(outstandingAmount),
      },
      invoices: {
        overdue: overdueInvoices,
        outstanding: parseFloat(outstandingAmount),
      },
      quotations: {
        pending: pendingQuotations,
        thisMonth: quotationsThisMonth,
      },
      customers: {
        total: totalCustomers,
        newThisMonth: newCustomersThisMonth,
      },
      jobs: {
        open: openJobs,
      },
    };

    return successResponse(res, kpis, 'KPIs retrieved');
  } catch (error) {
    next(error);
  }
};

exports.getShipmentsByMode = async (req, res, next) => {
  try {
    const data = await Shipment.findAll({
      attributes: ['mode', [fn('COUNT', col('id')), 'count']],
      group: ['mode'],
      raw: true,
    });

    const formatted = data.map((item) => ({
      mode: item.mode,
      count: parseInt(item.count),
    }));

    return successResponse(res, formatted, 'Shipments by mode retrieved');
  } catch (error) {
    next(error);
  }
};

exports.getShipmentsByStatus = async (req, res, next) => {
  try {
    const data = await Shipment.findAll({
      attributes: ['status', [fn('COUNT', col('id')), 'count']],
      group: ['status'],
      raw: true,
    });

    return successResponse(res, data.map((d) => ({ status: d.status, count: parseInt(d.count) })), 'Shipments by status');
  } catch (error) {
    next(error);
  }
};

exports.getMonthlyRevenue = async (req, res, next) => {
  try {
    const months = 12;
    const results = [];

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

      const revenue = await Invoice.sum('totalAmount', {
        where: { status: 'paid', createdAt: { [Op.between]: [start, end] } },
      }) || 0;

      const shipments = await Shipment.count({
        where: { createdAt: { [Op.between]: [start, end] } },
      });

      results.push({
        month: start.toLocaleString('default', { month: 'short' }),
        year: start.getFullYear(),
        revenue: parseFloat(revenue),
        shipments,
      });
    }

    return successResponse(res, results, 'Monthly revenue retrieved');
  } catch (error) {
    next(error);
  }
};

exports.getRecentActivities = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const [recentShipments, recentQuotations, recentInvoices] = await Promise.all([
      Shipment.findAll({
        limit: 5,
        order: [['updatedAt', 'DESC']],
        include: [{ association: 'customer', attributes: ['companyName'] }],
        attributes: ['id', 'shipmentNumber', 'status', 'mode', 'updatedAt'],
      }),
      Quotation.findAll({
        limit: 5,
        order: [['updatedAt', 'DESC']],
        include: [{ association: 'customer', attributes: ['companyName'] }],
        attributes: ['id', 'quoteNumber', 'status', 'mode', 'totalAmount', 'currency', 'updatedAt'],
      }),
      Invoice.findAll({
        limit: 5,
        order: [['updatedAt', 'DESC']],
        include: [{ association: 'customer', attributes: ['companyName'] }],
        attributes: ['id', 'invoiceNumber', 'status', 'totalAmount', 'currency', 'dueDate', 'updatedAt'],
      }),
    ]);

    const activities = [
      ...recentShipments.map((s) => ({
        type: 'shipment',
        id: s.id,
        reference: s.shipmentNumber,
        description: `Shipment ${s.shipmentNumber} - ${s.status.replace(/_/g, ' ')}`,
        customer: s.customer?.companyName,
        timestamp: s.updatedAt,
      })),
      ...recentQuotations.map((q) => ({
        type: 'quotation',
        id: q.id,
        reference: q.quoteNumber,
        description: `Quotation ${q.quoteNumber} - ${q.status}`,
        customer: q.customer?.companyName,
        amount: q.totalAmount,
        currency: q.currency,
        timestamp: q.updatedAt,
      })),
      ...recentInvoices.map((i) => ({
        type: 'invoice',
        id: i.id,
        reference: i.invoiceNumber,
        description: `Invoice ${i.invoiceNumber} - ${i.status}`,
        customer: i.customer?.companyName,
        amount: i.totalAmount,
        currency: i.currency,
        timestamp: i.updatedAt,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);

    return successResponse(res, activities, 'Recent activities retrieved');
  } catch (error) {
    next(error);
  }
};

exports.getTopRoutes = async (req, res, next) => {
  try {
    const routes = await Shipment.findAll({
      attributes: [
        'originPortId', 'destinationPortId',
        [fn('COUNT', col('Shipment.id')), 'count'],
      ],
      include: [
        { association: 'originPort', attributes: ['name', 'code', 'country'] },
        { association: 'destinationPort', attributes: ['name', 'code', 'country'] },
      ],
      where: {
        originPortId: { [Op.ne]: null },
        destinationPortId: { [Op.ne]: null },
      },
      group: ['originPortId', 'destinationPortId', 'originPort.id', 'originPort.name', 'originPort.code', 'originPort.country', 'destinationPort.id', 'destinationPort.name', 'destinationPort.code', 'destinationPort.country'],
      order: [[literal('count'), 'DESC']],
      limit: 10,
    });

    return successResponse(res, routes, 'Top routes retrieved');
  } catch (error) {
    next(error);
  }
};

exports.getAdminStats = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      ffJobsTotal,
      ffJobsByStatusRaw,
      serviceJobsTotal,
      serviceJobsByStatusRaw,
      creditNotesTotal,
      creditNotesAmount,
      opportunitiesTotal,
      opportunitiesByStageRaw,
      vendorBillsTotal,
      vendorBillsAmount,
      quotationsTotal,
      quotationsByStatusRaw,
      quotationsByModeRaw,
      tradeLaneRaw,
    ] = await Promise.all([
      FFJob.count(),
      FFJob.findAll({ attributes: ['status', [fn('COUNT', col('id')), 'count']], group: ['status'], raw: true }),
      ServiceJob.count(),
      ServiceJob.findAll({ attributes: ['status', [fn('COUNT', col('id')), 'count']], group: ['status'], raw: true }),
      CreditNote.count(),
      CreditNote.sum('totalAmount', { where: { status: { [Op.ne]: 'cancelled' } } }),
      Opportunity.count({ where: { stage: { [Op.notIn]: ['won', 'lost'] } } }),
      Opportunity.findAll({ attributes: ['stage', [fn('COUNT', col('id')), 'count']], group: ['stage'], raw: true }),
      VendorBill.count(),
      VendorBill.sum('totalAmount', { where: { status: { [Op.ne]: 'cancelled' } } }),
      Quotation.count(),
      Quotation.findAll({ attributes: ['status', [fn('COUNT', col('id')), 'count']], group: ['status'], raw: true }),
      Quotation.findAll({ attributes: ['transportMode', [fn('COUNT', col('id')), 'count']], group: ['transportMode'], raw: true }),
      Quotation.findAll({
        attributes: ['originCountry', 'destinationCountry', [fn('COUNT', col('id')), 'count']],
        where: { originCountry: { [Op.ne]: null }, destinationCountry: { [Op.ne]: null } },
        group: ['originCountry', 'destinationCountry'],
        order: [[literal('count'), 'DESC']],
        limit: 5,
        raw: true,
      }),
    ]);

    // Detailed quotation list for per-user/carrier/country/origin/customer breakdowns
    const allQuotations = await Quotation.findAll({
      include: [
        { model: User, as: 'creator', attributes: ['id', 'name'] },
        { model: Carrier, as: 'carrier', attributes: ['id', 'name'] },
        { model: Customer, as: 'customer', attributes: ['id', 'companyName'] },
        { model: Port, as: 'originPort', attributes: ['id', 'name', 'code'] },
      ],
      attributes: ['id', 'status', 'transportMode', 'originCountry', 'originCity', 'totalAmount'],
    });

    const quotesPerUser = groupCount(allQuotations, (q) => q.creator?.name);
    const quotesPerCarrier = groupCount(allQuotations, (q) => q.carrier?.name);
    const quotesPerCountry = groupCount(allQuotations, (q) => q.originCountry);
    const quotesPerOrigin = groupCount(allQuotations, (q) => q.originPort ? `${q.originPort.name} (${q.originPort.code})` : q.originCity);
    const topCustomers = groupCount(allQuotations, (q) => q.customer?.companyName, 5);

    const conversionStatus = {
      convertedAsBooking: allQuotations.filter((q) => q.status === 'converted').length,
      lost: allQuotations.filter((q) => ['rejected', 'expired', 'cancelled'].includes(q.status)).length,
      pending: allQuotations.filter((q) => ['draft', 'sent', 'pending', 'un_accepted'].includes(q.status)).length,
    };

    const ffJobsByStatus = {};
    ffJobsByStatusRaw.forEach((r) => { ffJobsByStatus[r.status] = parseInt(r.count); });

    const serviceJobsByStatus = {};
    serviceJobsByStatusRaw.forEach((r) => { serviceJobsByStatus[r.status] = parseInt(r.count); });

    const opportunitiesByStage = {};
    opportunitiesByStageRaw.forEach((r) => { opportunitiesByStage[r.stage] = parseInt(r.count); });

    const quotationsByStatus = {};
    quotationsByStatusRaw.forEach((r) => { quotationsByStatus[r.status] = parseInt(r.count); });

    const quotationsByMode = {};
    quotationsByModeRaw.forEach((r) => { quotationsByMode[r.transportMode || 'Unknown'] = parseInt(r.count); });

    const topTradeLanes = tradeLaneRaw.map((r) => ({
      origin: r.originCountry,
      destination: r.destinationCountry,
      count: parseInt(r.count),
    }));

    return successResponse(res, {
      ffJobs: { total: ffJobsTotal, byStatus: ffJobsByStatus },
      serviceJobs: { total: serviceJobsTotal, byStatus: serviceJobsByStatus },
      creditNotes: { total: creditNotesTotal, amount: parseFloat(creditNotesAmount) || 0 },
      opportunities: { total: opportunitiesTotal, byStage: opportunitiesByStage },
      vendorBills: { total: vendorBillsTotal, amount: parseFloat(vendorBillsAmount) || 0 },
      quotations: {
        total: quotationsTotal,
        byStatus: quotationsByStatus,
        byMode: quotationsByMode,
        topTradeLanes,
        quotesPerUser,
        quotesPerCarrier,
        quotesPerCountry,
        quotesPerOrigin,
        topCustomers,
        conversionStatus,
      },
    }, 'Admin stats retrieved');
  } catch (error) {
    next(error);
  }
};

exports.getUserStats = async (req, res, next) => {
  try {
    const { Customer: CustomerModel } = require('../models');
    // The link lives on the account (users.customerId); Customer has no userId,
    // so the old lookup threw on every portal dashboard load.
    const customerId = req.user?.customerId;
    const customer = customerId ? await CustomerModel.findByPk(customerId) : null;

    if (!customer) {
      return successResponse(res, {}, 'No customer linked to this user');
    }
    const now = new Date();

    const [
      invoiceCount,
      invoiceAmount,
      creditNoteCount,
      creditNoteAmount,
      approvedQuotesCount,
      unacceptedQuotesCount,
      ffJobsCount,
      serviceJobsCount,
      totalPaidAmount,
      totalDueAmount,
      totalOverDueAmount,
    ] = await Promise.all([
      Invoice.count({ where: { customerId } }),
      Invoice.sum('totalAmount', { where: { customerId, status: { [Op.ne]: 'cancelled' } } }),
      CreditNote.count({ where: { customerId } }),
      CreditNote.sum('totalAmount', { where: { customerId, status: { [Op.ne]: 'cancelled' } } }),
      Quotation.count({ where: { customerId, status: 'accepted' } }),
      Quotation.count({ where: { customerId, status: 'un_accepted' } }),
      FFJob.count({ where: { customerId } }),
      ServiceJob.count({ where: { customerId } }),
      Invoice.sum('paidAmount', { where: { customerId } }),
      Invoice.sum('balanceAmount', { where: { customerId, status: { [Op.in]: ['sent', 'partially_paid'] } } }),
      Invoice.sum('balanceAmount', { where: { customerId, status: 'overdue' } }),
    ]);

    return successResponse(res, {
      invoiceCount,
      invoiceAmount: parseFloat(invoiceAmount) || 0,
      creditNoteCount,
      creditNoteAmount: parseFloat(creditNoteAmount) || 0,
      approvedQuotesCount,
      unacceptedQuotesCount,
      ffJobsCount,
      serviceJobsCount,
      totalPaidAmount: parseFloat(totalPaidAmount) || 0,
      totalDueAmount: parseFloat(totalDueAmount) || 0,
      totalOverDueAmount: parseFloat(totalOverDueAmount) || 0,
    }, 'User stats retrieved');
  } catch (error) {
    next(error);
  }
};

exports.getUpcomingDeliveries = async (req, res, next) => {
  try {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const shipments = await Shipment.findAll({
      where: {
        estimatedArrival: { [Op.between]: [new Date(), nextWeek] },
        status: { [Op.notIn]: ['delivered', 'completed', 'cancelled'] },
      },
      include: [
        { association: 'customer', attributes: ['companyName'] },
        { association: 'destinationPort', attributes: ['name', 'code'] },
      ],
      order: [['estimatedArrival', 'ASC']],
      limit: 10,
    });

    return successResponse(res, shipments, 'Upcoming deliveries retrieved');
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────
// Shipment Dashboard
// ──────────────────────────────────────────────────────────────────────────
exports.getShipmentDashboard = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const jobs = await FFJob.findAll({
      include: [
        { association: 'customer', attributes: ['id', 'companyName'] },
        { association: 'salesAgent', attributes: ['id', 'name'] },
        { association: 'originPort', attributes: ['id', 'name', 'code', 'country'] },
        { association: 'destinationPort', attributes: ['id', 'name', 'code', 'country'] },
      ],
    });

    const totalShipments = jobs.length;

    // Total TEU - estimate from container numbers count for FCL jobs (assume 1 TEU per container)
    let totalTEU = 0;
    jobs.forEach((j) => {
      if (j.cargoType === 'FCL' && Array.isArray(j.containerNumbers)) {
        totalTEU += j.containerNumbers.length;
      }
    });

    // No of carriers - distinct carrier names
    const carrierSet = new Set();
    jobs.forEach((j) => { if (j.carrier) carrierSet.add(j.carrier); });
    const noOfCarriers = carrierSet.size;

    // Total volume
    let totalVolume = 0;
    jobs.forEach((j) => { totalVolume += parseFloat(j.volume) || 0; });

    // Profitability (current month) - revenue from Invoice, cost from VendorBill
    const [revenue, cost] = await Promise.all([
      Invoice.sum('totalAmount', {
        where: { status: { [Op.ne]: 'cancelled' }, createdAt: { [Op.gte]: startOfMonth, [Op.lt]: startOfNextMonth } },
      }),
      VendorBill.sum('totalAmount', {
        where: { status: { [Op.ne]: 'cancelled' }, createdAt: { [Op.gte]: startOfMonth, [Op.lt]: startOfNextMonth } },
      }),
    ]);
    const revenueVal = parseFloat(revenue) || 0;
    const costVal = parseFloat(cost) || 0;
    const margin = revenueVal - costVal;
    const marginPct = revenueVal > 0 ? parseFloat(((margin / revenueVal) * 100).toFixed(1)) : 0;

    // Profitability by customers
    const customerProfitMap = new Map();
    jobs.forEach((j) => {
      const name = j.customer?.companyName || 'Unknown';
      if (!customerProfitMap.has(name)) {
        customerProfitMap.set(name, { customer: name, shipments: 0 });
      }
      customerProfitMap.get(name).shipments += 1;
    });
    const profitabilityByCustomers = Array.from(customerProfitMap.values()).sort((a, b) => b.shipments - a.shipments);

    // Grouped breakdowns
    const shipmentsBySalesAgent = groupCount(jobs, (j) => j.salesAgent?.name);
    const shipmentsByTradeLanes = groupCount(jobs, (j) => `${j.originCountry || j.origin || '-'} → ${j.destinationCountry || j.destination || '-'}`);
    const shipmentsByCompanies = groupCount(jobs, (j) => j.customer?.companyName);
    const shipmentsByStatus = groupCount(jobs, (j) => j.status);
    const shipmentsByOriginCountry = groupCount(jobs, (j) => j.originCountry);
    const shipmentsByDestinationCountry = groupCount(jobs, (j) => j.destinationCountry);

    const seaJobs = jobs.filter((j) => j.transportMode === 'SEA');
    const airJobs = jobs.filter((j) => j.transportMode === 'AIR');
    const roadJobs = jobs.filter((j) => j.transportMode === 'ROAD');

    const shipmentsByPOL = groupCount(seaJobs, (j) => j.originPort ? `${j.originPort.name} (${j.originPort.code})` : j.origin);
    const shipmentsByPOD = groupCount(seaJobs, (j) => j.destinationPort ? `${j.destinationPort.name} (${j.destinationPort.code})` : j.destination);
    const shipmentsByAOL = groupCount(airJobs, (j) => j.originPort ? `${j.originPort.name} (${j.originPort.code})` : j.origin);
    const shipmentsByAOD = groupCount(airJobs, (j) => j.destinationPort ? `${j.destinationPort.name} (${j.destinationPort.code})` : j.destination);

    const shipmentType = groupCount(jobs, (j) => j.direction);
    const transportMode = groupCount(jobs, (j) => j.transportMode);
    const cargoType = groupCount(jobs, (j) => j.cargoType);

    return successResponse(res, {
      totalShipments,
      totalTEU,
      noOfCarriers,
      totalVolume: parseFloat(totalVolume.toFixed(3)),
      profitability: {
        revenue: revenueVal,
        cost: costVal,
        margin,
        marginPct,
      },
      profitabilityByCustomers,
      shipmentsBySalesAgent,
      shipmentsByTradeLanes,
      shipmentsByCompanies,
      shipmentsByStatus,
      shipmentsByOriginCountry,
      shipmentsByDestinationCountry,
      shipmentsByPOL,
      shipmentsByPOD,
      shipmentsByAOL,
      shipmentsByAOD,
      shipmentType,
      transportMode,
      cargoType,
      seaShipment: { count: seaJobs.length },
      airShipment: { count: airJobs.length },
      roadShipment: { count: roadJobs.length },
    }, 'Shipment dashboard retrieved');
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────
// Carrier Booking Dashboard
// ──────────────────────────────────────────────────────────────────────────
exports.getCarrierBookingDashboard = async (req, res, next) => {
  try {
    const bookings = await FreightBooking.findAll({
      include: [
        { association: 'carrier', attributes: ['id', 'name'] },
        { association: 'creator', attributes: ['id', 'name'] },
      ],
    });

    const totalBookings = bookings.length;

    const topCarrierBookings = groupCount(bookings, (b) => b.carrier?.name, 5);
    const bookingsPerUser = groupCount(bookings, (b) => b.creator?.name, 10);
    // Vessel info isn't a direct field on FreightBooking; derive from FFJob's vessel via ffJob association where possible
    const topVesselBookings = groupCount(bookings, (b) => b.containerType || 'Unknown', 5);
    const topTransporterBookings = groupCount(bookings, (b) => b.carrier?.name, 5);

    return successResponse(res, {
      totalBookings,
      topCarrierBookings,
      bookingsPerUser,
      topVesselBookings,
      topTransporterBookings,
    }, 'Carrier booking dashboard retrieved');
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────
// Activity Dashboard
// Definitions (no generic Activity/Task model exists, so we derive from
// existing entities):
//   - Pending Approval = Quotations with status 'sent' (awaiting customer approval)
//   - Today Action     = FFJobs with etd or eta falling on today's date
//   - Overdue Action   = Invoices with status 'overdue'
//   - Future Action    = FFJobs with eta in the future (after today)
// ──────────────────────────────────────────────────────────────────────────
exports.getActivityDashboard = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    const [pendingApproval, todayActionEtd, todayActionEta, overdueAction, futureAction] = await Promise.all([
      Quotation.count({ where: { status: 'sent' } }),
      FFJob.count({ where: { etd: { [Op.gte]: startOfToday, [Op.lt]: startOfTomorrow } } }),
      FFJob.count({ where: { eta: { [Op.gte]: startOfToday, [Op.lt]: startOfTomorrow } } }),
      Invoice.count({ where: { status: 'overdue' } }),
      FFJob.count({ where: { eta: { [Op.gte]: startOfTomorrow } } }),
    ]);

    return successResponse(res, {
      pendingApproval,
      todayAction: todayActionEtd + todayActionEta,
      overdueAction,
      futureAction,
    }, 'Activity dashboard retrieved');
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────
// Credit Limit Overdue
// ──────────────────────────────────────────────────────────────────────────
exports.getCreditLimitOverdue = async (req, res, next) => {
  try {
    const customers = await Customer.findAll({
      include: [
        { association: 'assignedUser', attributes: ['id', 'name'] },
      ],
    });

    const rows = [];
    for (const customer of customers) {
      const [invoiceAmount, shipmentCount] = await Promise.all([
        Invoice.sum('totalAmount', {
          where: {
            customerId: customer.id,
            status: { [Op.in]: ['sent', 'overdue', 'partially_paid'] },
          },
        }),
        FFJob.count({ where: { customerId: customer.id } }),
      ]);

      const invoiceAmountVal = parseFloat(invoiceAmount) || 0;
      const creditLimit = parseFloat(customer.creditLimit) || 0;

      if (invoiceAmountVal > creditLimit) {
        rows.push({
          customerId: customer.id,
          creditLimitRequester: customer.assignedUser?.name || customer.companyName || '-',
          customer: customer.companyName,
          numberOfShipment: shipmentCount,
          approverName: customer.assignedUser?.name || '-',
          creditDays: customer.paymentTerms,
          creditLimit,
          invoiceAmount: invoiceAmountVal,
        });
      }
    }

    rows.sort((a, b) => b.invoiceAmount - a.invoiceAmount);
    const top10 = rows.slice(0, 10).map((r, i) => ({ slNo: i + 1, ...r }));

    return successResponse(res, top10, 'Credit limit overdue retrieved');
  } catch (error) {
    next(error);
  }
};
