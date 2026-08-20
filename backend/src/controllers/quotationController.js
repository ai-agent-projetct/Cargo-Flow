const { Op } = require('sequelize');
const { portalWhere } = require('../middleware/portalScope');
const { Quotation, Customer, User, Port, Carrier, Shipment, FFJob, ServiceJob, Event } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta, buildSearchConditions } = require('../utils/helpers');
const { sendQuotationEmail } = require('../utils/emailService');

const ALLOWED_SORT = ['createdAt', 'updatedAt', 'totalAmount', 'validUntil', 'status'];

const getIncludes = () => [
  { association: 'customer', attributes: ['id', 'companyName', 'contactName', 'email'] },
  { association: 'creator', attributes: ['id', 'name', 'email'] },
  { association: 'approver', attributes: ['id', 'name', 'email'] },
  { association: 'originPort', attributes: ['id', 'name', 'code', 'country'] },
  { association: 'destinationPort', attributes: ['id', 'name', 'code', 'country'] },
  { association: 'carrier', attributes: ['id', 'name', 'code', 'type'] },
];

// Build structured quotationNumber: QT-SEA/AIR/ROA/RAIL-EXP/IMP/LOC-FCL/LCL/etc/YEAR/00001
const generateQuotationNumber = async (transportMode, direction, cargoType) => {
  const { Op } = require('sequelize');
  const year = new Date().getFullYear();

  const modeMap = { SEA: 'SEA', AIR: 'AIR', ROAD: 'ROA', RAIL: 'RAIL' };
  const dirMap = { EXPORT: 'EXP', IMPORT: 'IMP', LOCAL: 'LOC' };

  const modeCode = modeMap[transportMode] || 'SEA';
  const dirCode = dirMap[direction] || 'EXP';
  const cargoCode = cargoType || 'GEN';

  const count = await Quotation.count({
    where: {
      transportMode,
      direction,
      createdAt: { [Op.gte]: new Date(`${year}-01-01`) },
    },
  });

  const seq = String(count + 1).padStart(5, '0');
  return `QT-${modeCode}-${dirCode}-${cargoCode}/${year}/${seq}`;
};

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const {
      status,
      mode,
      transportMode,
      direction,
      customerId,
      search,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = req.query;

    // A portal login only ever sees its own customer's records.
    const where = { ...portalWhere(req) };
    if (status) where.status = status;
    if (mode) where.mode = mode;
    if (transportMode) where.transportMode = transportMode;
    if (direction) where.direction = direction;
    if (customerId) where.customerId = customerId;

    if (search) {
      where[Op.or] = [
        { quoteNumber: { [Op.like]: `%${search}%` } },
        { quotationNumber: { [Op.like]: `%${search}%` } },
        { commodity: { [Op.like]: `%${search}%` } },
        { originCity: { [Op.like]: `%${search}%` } },
        { destinationCity: { [Op.like]: `%${search}%` } },
      ];
    }

    const sortField = ALLOWED_SORT.includes(sortBy) ? sortBy : 'createdAt';
    const { count, rows } = await Quotation.findAndCountAll({
      where,
      include: getIncludes(),
      order: [[sortField, sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    return successResponse(res, rows, 'Quotations retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const quotation = await Quotation.findByPk(req.params.id, { include: getIncludes() });
    if (!quotation) return errorResponse(res, 'Quotation not found', 404);
    return successResponse(res, quotation, 'Quotation retrieved');
  } catch (error) {
    next(error);
  }
};

// Get quotations by status tab: accepted | un_accepted | rejected | cancelled | pending
exports.getByStatus = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { status } = req.params;
    const { transportMode, direction, customerId, sortBy = 'createdAt', sortOrder = 'DESC' } = req.query;

    const validStatuses = ['draft', 'sent', 'pending', 'accepted', 'un_accepted', 'approved', 'rejected', 'cancelled', 'expired', 'converted'];
    if (!validStatuses.includes(status)) {
      return errorResponse(res, `Invalid status. Valid values: ${validStatuses.join(', ')}`, 400);
    }

    const where = { status };
    if (transportMode) where.transportMode = transportMode;
    if (direction) where.direction = direction;
    if (customerId) where.customerId = customerId;

    const sortField = ALLOWED_SORT.includes(sortBy) ? sortBy : 'createdAt';
    const { count, rows } = await Quotation.findAndCountAll({
      where,
      include: getIncludes(),
      order: [[sortField, sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    return successResponse(res, rows, `${status} quotations retrieved`, 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const data = { ...req.body, createdBy: req.user.id };

    // Auto-calculate total
    const charges = ['freightCharges', 'originCharges', 'destinationCharges', 'customsCharges', 'insuranceCharges', 'otherCharges'];
    data.totalAmount = charges.reduce((sum, key) => sum + (parseFloat(data[key]) || 0), 0);

    // Set totalSellRate and calculate profit
    data.totalSellRate = data.totalAmount;
    if (data.totalBuyRate) {
      data.profit = data.totalSellRate - parseFloat(data.totalBuyRate);
    }

    // Generate structured quotation number if transport mode fields available
    if (data.transportMode && data.direction && data.cargoType && !data.quotationNumber) {
      data.quotationNumber = await generateQuotationNumber(data.transportMode, data.direction, data.cargoType);
    }

    // Mirror incoterms/incoterm
    if (data.incoterm && !data.incoterms) data.incoterms = data.incoterm;
    if (data.incoterms && !data.incoterm) data.incoterm = data.incoterms;

    const quotation = await Quotation.create(data);
    const result = await Quotation.findByPk(quotation.id, { include: getIncludes() });

    // Emit socket event
    if (req.io) req.io.emit('quotation:created', { id: result.id, quoteNumber: result.quoteNumber, quotationNumber: result.quotationNumber });

    return successResponse(res, result, 'Quotation created', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const quotation = await Quotation.findByPk(req.params.id);
    if (!quotation) return errorResponse(res, 'Quotation not found', 404);

    if (['converted'].includes(quotation.status)) {
      return errorResponse(res, 'Cannot edit a converted quotation', 400);
    }

    const data = { ...req.body };
    const charges = ['freightCharges', 'originCharges', 'destinationCharges', 'customsCharges', 'insuranceCharges', 'otherCharges'];
    data.totalAmount = charges.reduce((sum, key) => sum + (parseFloat(data[key] ?? quotation[key]) || 0), 0);

    data.totalSellRate = data.totalAmount;
    const buyRate = parseFloat(data.totalBuyRate ?? quotation.totalBuyRate);
    if (buyRate) data.profit = data.totalSellRate - buyRate;

    // Mirror incoterms/incoterm
    if (data.incoterm && !data.incoterms) data.incoterms = data.incoterm;
    if (data.incoterms && !data.incoterm) data.incoterm = data.incoterms;

    await quotation.update(data);
    const result = await Quotation.findByPk(quotation.id, { include: getIncludes() });
    return successResponse(res, result, 'Quotation updated');
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const quotation = await Quotation.findByPk(req.params.id);
    if (!quotation) return errorResponse(res, 'Quotation not found', 404);
    if (quotation.status === 'converted') {
      return errorResponse(res, 'Cannot delete a converted quotation', 400);
    }
    await quotation.destroy();
    return successResponse(res, null, 'Quotation deleted');
  } catch (error) {
    next(error);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { status, rejectionReason } = req.body;
    const quotation = await Quotation.findByPk(req.params.id);
    if (!quotation) return errorResponse(res, 'Quotation not found', 404);

    const validTransitions = {
      draft: ['sent', 'pending', 'cancelled'],
      sent: ['pending', 'accepted', 'approved', 'rejected', 'expired', 'un_accepted'],
      pending: ['accepted', 'approved', 'rejected', 'un_accepted', 'cancelled', 'expired'],
      accepted: ['converted', 'cancelled'],
      approved: ['converted', 'accepted', 'cancelled'],
      un_accepted: ['draft', 'cancelled'],
      rejected: ['draft', 'cancelled'],
      expired: ['draft'],
      cancelled: [],
      converted: [],
    };

    if (!validTransitions[quotation.status]?.includes(status)) {
      return errorResponse(res, `Cannot transition from ${quotation.status} to ${status}`, 400);
    }

    const updateData = { status };
    if (status === 'accepted' || status === 'approved') {
      updateData.approvedBy = req.user.id;
      updateData.approvedAt = new Date();
    }
    if (status === 'rejected' || status === 'un_accepted') {
      updateData.rejectionReason = rejectionReason;
    }

    await quotation.update(updateData);

    if (req.io) req.io.emit('quotation:statusUpdated', { id: quotation.id, status });

    return successResponse(res, quotation, `Quotation ${status}`);
  } catch (error) {
    next(error);
  }
};

exports.approve = async (req, res, next) => {
  try {
    const quotation = await Quotation.findByPk(req.params.id, { include: getIncludes() });
    if (!quotation) return errorResponse(res, 'Quotation not found', 404);

    if (!['sent', 'pending', 'draft'].includes(quotation.status)) {
      return errorResponse(res, `Cannot approve a quotation with status: ${quotation.status}`, 400);
    }

    await quotation.update({
      status: 'accepted',
      approvedBy: req.user.id,
      approvedAt: new Date(),
    });

    if (req.io) req.io.emit('quotation:approved', { id: quotation.id, quoteNumber: quotation.quoteNumber });

    return successResponse(res, quotation, 'Quotation approved (accepted)');
  } catch (error) {
    next(error);
  }
};

exports.reject = async (req, res, next) => {
  try {
    const { rejectionReason } = req.body;
    const quotation = await Quotation.findByPk(req.params.id, { include: getIncludes() });
    if (!quotation) return errorResponse(res, 'Quotation not found', 404);

    if (!['sent', 'pending', 'draft'].includes(quotation.status)) {
      return errorResponse(res, `Cannot reject a quotation with status: ${quotation.status}`, 400);
    }

    await quotation.update({
      status: 'rejected',
      rejectionReason: rejectionReason || 'Rejected by reviewer',
    });

    if (req.io) req.io.emit('quotation:rejected', { id: quotation.id, quoteNumber: quotation.quoteNumber });

    return successResponse(res, quotation, 'Quotation rejected');
  } catch (error) {
    next(error);
  }
};

exports.send = async (req, res, next) => {
  try {
    const quotation = await Quotation.findByPk(req.params.id, { include: getIncludes() });
    if (!quotation) return errorResponse(res, 'Quotation not found', 404);
    if (quotation.status !== 'draft') {
      return errorResponse(res, 'Only draft quotations can be sent', 400);
    }

    const recipientEmail = req.body.email || quotation.customer?.email;
    if (!recipientEmail) return errorResponse(res, 'Recipient email required', 400);

    await sendQuotationEmail(quotation, quotation.customer, recipientEmail);
    await quotation.update({ status: 'sent' });

    return successResponse(res, quotation, 'Quotation sent successfully');
  } catch (error) {
    next(error);
  }
};

exports.convertToFFJob = async (req, res, next) => {
  try {
    const quotation = await Quotation.findByPk(req.params.id, { include: getIncludes() });
    if (!quotation) return errorResponse(res, 'Quotation not found', 404);

    if (!['accepted', 'approved'].includes(quotation.status)) {
      return errorResponse(res, 'Only accepted/approved quotations can be converted to FF Jobs', 400);
    }

    if (quotation.ffJobId) {
      return errorResponse(res, 'This quotation has already been converted to an FF Job', 400);
    }

    // Determine transport mode and job type from quotation
    const modeMap = { sea: 'SEA', air: 'AIR', land: 'ROAD', rail: 'RAIL', multimodal: 'SEA' };
    const transportMode = quotation.transportMode || modeMap[quotation.mode] || 'SEA';
    const jobTypeMap = { SEA: 'SEA_FREIGHT', AIR: 'AIR_FREIGHT', ROAD: 'ROAD_FREIGHT', RAIL: 'RAIL_FREIGHT' };
    const jobType = jobTypeMap[transportMode] || 'SEA_FREIGHT';

    const cargoTypeMap = { FCL: 'FCL', LCL: 'LCL', 'Air Freight': 'LSE', 'Land Freight': 'FTL', 'Rail Freight': 'FTL' };
    const cargoType = quotation.cargoType || cargoTypeMap[quotation.shipmentType] || 'FCL';

    const ffJobData = {
      quotationId: quotation.id,
      customerId: quotation.customerId,
      transportMode,
      direction: quotation.direction || 'EXPORT',
      cargoType,
      serviceType: req.body.serviceType || 'H',
      jobType,
      origin: quotation.originCity || '',
      originCode: '',
      destination: quotation.destinationCity || '',
      destinationCode: '',
      commodity: quotation.commodity,
      incoterm: quotation.incoterms || quotation.incoterm,
      grossWeight: quotation.cargoWeight,
      volume: quotation.cargoVolume,
      currency: quotation.currency,
      remarks: quotation.notes || quotation.remarks,
      assignedTo: req.body.assignedTo || null,
      createdBy: req.user.id,
      status: 'draft',
      ...req.body,
    };

    // Remove fields that should not override
    delete ffJobData.id;
    delete ffJobData.jobNumber;

    const ffJob = await FFJob.create(ffJobData);

    await quotation.update({ status: 'converted', ffJobId: ffJob.id });

    // Create event
    await Event.create({
      entityType: 'FF_JOB',
      entityId: ffJob.id,
      eventType: 'CREATED',
      eventDate: new Date(),
      description: `FF Job created from Quotation ${quotation.quoteNumber || quotation.quotationNumber}`,
      createdBy: req.user.id,
      isPublic: false,
    });

    const result = await FFJob.findByPk(ffJob.id, {
      include: [
        { association: 'customer', attributes: ['id', 'companyName', 'contactName', 'email'] },
        { association: 'creator', attributes: ['id', 'name', 'email'] },
      ],
    });

    if (req.io) req.io.emit('ffJob:created', { id: result.id, jobNumber: result.jobNumber, fromQuotation: quotation.id });

    return successResponse(res, { quotation, ffJob: result }, 'Quotation converted to FF Job', 201);
  } catch (error) {
    next(error);
  }
};

exports.convertToServiceJob = async (req, res, next) => {
  try {
    const quotation = await Quotation.findByPk(req.params.id, { include: getIncludes() });
    if (!quotation) return errorResponse(res, 'Quotation not found', 404);

    if (!['accepted', 'approved'].includes(quotation.status)) {
      return errorResponse(res, 'Only accepted/approved quotations can be converted to Service Jobs', 400);
    }

    if (quotation.serviceJobId) {
      return errorResponse(res, 'This quotation has already been converted to a Service Job', 400);
    }

    const serviceJobData = {
      quotationId: quotation.id,
      customerId: quotation.customerId,
      serviceType: req.body.serviceType || 'CUSTOMS_CLEARANCE',
      direction: quotation.direction || 'EXPORT',
      origin: quotation.originCity || '',
      destination: quotation.destinationCity || '',
      currency: quotation.currency,
      remarks: quotation.notes || quotation.remarks,
      assignedTo: req.body.assignedTo || null,
      createdBy: req.user.id,
      status: 'pending',
      charges: req.body.charges || [],
      totalAmount: req.body.totalAmount || 0,
      ...req.body,
    };

    delete serviceJobData.id;
    delete serviceJobData.jobNumber;

    const serviceJob = await ServiceJob.create(serviceJobData);

    await quotation.update({ status: 'converted', serviceJobId: serviceJob.id });

    await Event.create({
      entityType: 'SERVICE_JOB',
      entityId: serviceJob.id,
      eventType: 'CREATED',
      eventDate: new Date(),
      description: `Service Job created from Quotation ${quotation.quoteNumber || quotation.quotationNumber}`,
      createdBy: req.user.id,
      isPublic: false,
    });

    const result = await ServiceJob.findByPk(serviceJob.id, {
      include: [
        { association: 'customer', attributes: ['id', 'companyName', 'contactName', 'email'] },
        { association: 'creator', attributes: ['id', 'name', 'email'] },
      ],
    });

    if (req.io) req.io.emit('serviceJob:created', { id: result.id, jobNumber: result.jobNumber, fromQuotation: quotation.id });

    return successResponse(res, { quotation, serviceJob: result }, 'Quotation converted to Service Job', 201);
  } catch (error) {
    next(error);
  }
};

exports.convertToShipment = async (req, res, next) => {
  try {
    const quotation = await Quotation.findByPk(req.params.id, { include: getIncludes() });
    if (!quotation) return errorResponse(res, 'Quotation not found', 404);
    if (!['accepted', 'approved'].includes(quotation.status)) {
      return errorResponse(res, 'Only accepted/approved quotations can be converted to shipments', 400);
    }

    const shipment = await Shipment.create({
      quotationId: quotation.id,
      customerId: quotation.customerId,
      createdBy: req.user.id,
      mode: quotation.mode,
      shipmentType: quotation.shipmentType,
      carrierId: quotation.carrierId,
      originPortId: quotation.originPortId,
      destinationPortId: quotation.destinationPortId,
      incoterms: quotation.incoterms,
      commodity: quotation.commodity,
      hsCode: quotation.hsCode,
      cargoWeight: quotation.cargoWeight,
      cargoVolume: quotation.cargoVolume,
      cargoWeightUnit: quotation.cargoWeightUnit,
      containerCount: quotation.containerCount,
      containerType: quotation.containerType,
      isDangerous: quotation.isDangerous,
      isTemperatureControlled: quotation.isTemperatureControlled,
      currency: quotation.currency,
      notes: quotation.notes,
      status: 'booking_confirmed',
    });

    await quotation.update({ status: 'converted' });

    if (req.io) req.io.emit('shipment:created', { id: shipment.id, shipmentNumber: shipment.shipmentNumber });

    return successResponse(res, { quotation, shipment }, 'Quotation converted to shipment', 201);
  } catch (error) {
    next(error);
  }
};

exports.duplicate = async (req, res, next) => {
  try {
    const source = await Quotation.findByPk(req.params.id);
    if (!source) return errorResponse(res, 'Quotation not found', 404);

    const data = source.toJSON();
    delete data.id;
    delete data.quoteNumber;
    delete data.quotationNumber;
    delete data.createdAt;
    delete data.updatedAt;
    delete data.ffJobId;
    delete data.serviceJobId;
    data.status = 'draft';
    data.createdBy = req.user.id;
    data.approvedBy = null;
    data.approvedAt = null;
    data.rejectionReason = null;

    const newQuotation = await Quotation.create(data);
    const result = await Quotation.findByPk(newQuotation.id, { include: getIncludes() });
    return successResponse(res, result, 'Quotation duplicated', 201);
  } catch (error) {
    next(error);
  }
};
