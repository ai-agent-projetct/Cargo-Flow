const { Op } = require('sequelize');
const { portalWhere } = require('../middleware/portalScope');
const { FFJob, Quotation, Customer, User, Company, Event } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');

const ALLOWED_SORT = ['createdAt', 'updatedAt', 'jobNumber', 'status', 'etd', 'eta'];

const VALID_TRANSITIONS = {
  created: ['booked', 'cancelled'],
  booked: ['received', 'cancelled'],
  received: ['confirmed', 'cancelled'],
  confirmed: ['nomination_generated', 'hbl_generated', 'hawb_generated', 'in_transit', 'cancelled'],
  nomination_generated: ['in_transit', 'cancelled'],
  hbl_generated: ['in_transit', 'cancelled'],
  hawb_generated: ['in_transit', 'cancelled'],
  in_transit: ['arrived', 'cancelled'],
  arrived: ['completed', 'cancelled'],
  completed: ['accounting_closure'],
  accounting_closure: [],
  cancelled: [],
};

const getIncludes = () => [
  { association: 'customer', attributes: ['id', 'companyName', 'contactName', 'email', 'address', 'city', 'state', 'country', 'postalCode'] },
  { association: 'shipper', attributes: ['id', 'companyName', 'contactName', 'email', 'address', 'city', 'state', 'country', 'postalCode'] },
  { association: 'consignee', attributes: ['id', 'companyName', 'contactName', 'email', 'address', 'city', 'state', 'country', 'postalCode'] },
  { association: 'quotation', attributes: ['id', 'quoteNumber', 'quotationNumber', 'totalAmount', 'currency'] },
  { association: 'assignedUser', attributes: ['id', 'name', 'email'] },
  { association: 'creator', attributes: ['id', 'name', 'email'] },
  { association: 'salesAgent', attributes: ['id', 'name', 'email'] },
  { association: 'company', attributes: ['id', 'name'] },
  { association: 'originPort', attributes: ['id', 'name', 'code', 'city', 'country', 'type'] },
  { association: 'destinationPort', attributes: ['id', 'name', 'code', 'city', 'country', 'type'] },
];

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const {
      status,
      transportMode,
      direction,
      customerId,
      search,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = req.query;

    // A portal login only ever sees its own customer's records.
    const where = { ...portalWhere(req) };
    if (status) where.status = status;
    if (transportMode) where.transportMode = transportMode;
    if (direction) where.direction = direction;
    if (customerId) where.customerId = customerId;

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt[Op.gte] = new Date(dateFrom);
      if (dateTo) where.createdAt[Op.lte] = new Date(dateTo);
    }

    if (search) {
      where[Op.or] = [
        { jobNumber: { [Op.like]: `%${search}%` } },
        { mblNumber: { [Op.like]: `%${search}%` } },
        { hblNumber: { [Op.like]: `%${search}%` } },
        { awbNumber: { [Op.like]: `%${search}%` } },
        { hawbNumber: { [Op.like]: `%${search}%` } },
        { commodity: { [Op.like]: `%${search}%` } },
        { vesselName: { [Op.like]: `%${search}%` } },
      ];
    }

    const sortField = ALLOWED_SORT.includes(sortBy) ? sortBy : 'createdAt';
    const { count, rows } = await FFJob.findAndCountAll({
      where,
      include: getIncludes(),
      order: [[sortField, sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    return successResponse(res, rows, 'FF Jobs retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const job = await FFJob.findByPk(req.params.id, { include: getIncludes() });
    if (!job) return errorResponse(res, 'FF Job not found', 404);

    // Fetch related events
    const events = await Event.findAll({
      where: { entityType: 'FF_JOB', entityId: job.id },
      order: [['eventDate', 'DESC']],
      include: [{ association: 'creator', attributes: ['id', 'name', 'email'] }],
    });

    const result = job.toJSON();
    result.events = events;

    return successResponse(res, result, 'FF Job retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const data = { ...req.body, createdBy: req.user.id };

    // Validate quotation if provided
    if (data.quotationId) {
      const quotation = await Quotation.findByPk(data.quotationId);
      if (!quotation) return errorResponse(res, 'Quotation not found', 404);
      if (!data.customerId) data.customerId = quotation.customerId;
    }

    if (!data.customerId) return errorResponse(res, 'customerId is required', 400);
    if (!data.transportMode) return errorResponse(res, 'transportMode is required', 400);
    if (!data.direction) return errorResponse(res, 'direction is required', 400);
    if (!data.cargoType) return errorResponse(res, 'cargoType is required', 400);
    if (!data.jobType) {
      const jobTypeMap = { AIR: 'AIR_FREIGHT', SEA: 'SEA_FREIGHT', ROAD: 'ROAD_FREIGHT', RAIL: 'RAIL_FREIGHT' };
      data.jobType = jobTypeMap[data.transportMode] || 'SEA_FREIGHT';
    }

    const job = await FFJob.create(data);

    // Update quotation to link FF Job if provided
    if (data.quotationId) {
      await Quotation.update(
        { ffJobId: job.id, status: 'converted' },
        { where: { id: data.quotationId } }
      );
    }

    // Create initial event
    await Event.create({
      entityType: 'FF_JOB',
      entityId: job.id,
      eventType: 'CREATED',
      eventDate: new Date(),
      description: `FF Job ${job.jobNumber} created`,
      createdBy: req.user.id,
      isPublic: false,
    });

    const result = await FFJob.findByPk(job.id, { include: getIncludes() });

    if (req.io) req.io.emit('ffJob:created', { id: result.id, jobNumber: result.jobNumber });

    return successResponse(res, result, 'FF Job created', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const job = await FFJob.findByPk(req.params.id);
    if (!job) return errorResponse(res, 'FF Job not found', 404);

    if (['accounting_closure', 'cancelled'].includes(job.status)) {
      return errorResponse(res, `Cannot edit a ${job.status} job`, 400);
    }

    await job.update(req.body);
    const result = await FFJob.findByPk(job.id, { include: getIncludes() });
    return successResponse(res, result, 'FF Job updated');
  } catch (error) {
    next(error);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { status, remarks, location, eventDate } = req.body;
    const job = await FFJob.findByPk(req.params.id);
    if (!job) return errorResponse(res, 'FF Job not found', 404);

    const allowed = VALID_TRANSITIONS[job.status];
    if (!allowed || !allowed.includes(status)) {
      return errorResponse(res, `Cannot transition from ${job.status} to ${status}`, 400);
    }

    const updateData = { status };
    if (status === 'in_transit' && !job.atd) updateData.atd = eventDate || new Date();
    if (status === 'arrived' && !job.ata) updateData.ata = eventDate || new Date();
    if (remarks) updateData.remarks = remarks;

    await job.update(updateData);

    // Create tracking event
    const eventTypeMap = {
      confirmed: 'CONFIRMED',
      in_transit: 'DEPARTED',
      arrived: 'ARRIVED',
      delivered: 'DELIVERED',
      cancelled: 'CANCELLED',
    };

    await Event.create({
      entityType: 'FF_JOB',
      entityId: job.id,
      eventType: eventTypeMap[status] || 'CUSTOM',
      eventDate: eventDate || new Date(),
      location: location || '',
      description: `Job status changed to ${status}`,
      remarks,
      createdBy: req.user.id,
      isPublic: true,
    });

    if (req.io) req.io.emit('ffJob:statusUpdated', { id: job.id, jobNumber: job.jobNumber, status });

    const result = await FFJob.findByPk(job.id, { include: getIncludes() });
    return successResponse(res, result, `FF Job status updated to ${status}`);
  } catch (error) {
    next(error);
  }
};

exports.addTrackingEvent = async (req, res, next) => {
  try {
    const job = await FFJob.findByPk(req.params.id);
    if (!job) return errorResponse(res, 'FF Job not found', 404);

    const { eventType, eventDate, location, description, remarks, isPublic = true, attachments = [] } = req.body;

    if (!eventType) return errorResponse(res, 'eventType is required', 400);

    const event = await Event.create({
      entityType: 'FF_JOB',
      entityId: job.id,
      eventType,
      eventDate: eventDate || new Date(),
      location,
      description,
      remarks,
      attachments,
      createdBy: req.user.id,
      isPublic,
    });

    const result = await Event.findByPk(event.id, {
      include: [{ association: 'creator', attributes: ['id', 'name', 'email'] }],
    });

    if (req.io) req.io.emit('ffJob:eventAdded', { jobId: job.id, jobNumber: job.jobNumber, event: result });

    return successResponse(res, result, 'Tracking event added', 201);
  } catch (error) {
    next(error);
  }
};

exports.addDocument = async (req, res, next) => {
  try {
    const job = await FFJob.findByPk(req.params.id);
    if (!job) return errorResponse(res, 'FF Job not found', 404);

    const { type, name, url, notes } = req.body;
    if (!type || !name) return errorResponse(res, 'Document type and name are required', 400);

    const existingDocs = job.documents || [];
    const newDoc = {
      id: require('crypto').randomUUID(),
      type,
      name,
      url: url || null,
      notes: notes || null,
      uploadedAt: new Date().toISOString(),
      uploadedBy: req.user.id,
    };

    await job.update({ documents: [...existingDocs, newDoc] });

    return successResponse(res, newDoc, 'Document added to FF Job', 201);
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const job = await FFJob.findByPk(req.params.id);
    if (!job) return errorResponse(res, 'FF Job not found', 404);

    if (job.status !== 'created') {
      return errorResponse(res, 'Only newly created FF jobs can be deleted', 400);
    }

    // Unlink from quotation if linked
    if (job.quotationId) {
      await Quotation.update(
        { ffJobId: null, status: 'accepted' },
        { where: { id: job.quotationId, ffJobId: job.id } }
      );
    }

    await job.destroy();
    return successResponse(res, null, 'FF Job deleted');
  } catch (error) {
    next(error);
  }
};

exports.getStats = async (req, res, next) => {
  try {
    const statuses = ['created', 'booked', 'received', 'confirmed', 'nomination_generated', 'hbl_generated', 'hawb_generated', 'in_transit', 'arrived', 'completed', 'accounting_closure', 'cancelled'];
    const byStatus = {};

    await Promise.all(
      statuses.map(async (status) => {
        const count = await FFJob.count({ where: { status } });
        byStatus[status] = { count };
      })
    );

    const total = await FFJob.count();

    return successResponse(res, { byStatus, total }, 'FF Job stats retrieved');
  } catch (error) {
    next(error);
  }
};

exports.getUserJobs = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { status } = req.query;

    const { Customer: CustomerModel } = require('../models');
    const customer = await CustomerModel.findOne({ where: { userId: req.user.id } });

    const where = customer ? { customerId: customer.id } : { customerId: null };
    if (status) where.status = status;

    const { count, rows } = await FFJob.findAndCountAll({
      where,
      include: getIncludes(),
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    return successResponse(res, rows, 'User FF Jobs retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getTracking = async (req, res, next) => {
  try {
    const job = await FFJob.findByPk(req.params.id);
    if (!job) return errorResponse(res, 'FF Job not found', 404);

    const events = await Event.findAll({
      where: { entityType: 'FF_JOB', entityId: job.id },
      order: [['eventDate', 'DESC']],
      include: [{ association: 'creator', attributes: ['id', 'name', 'email'] }],
    });

    return successResponse(res, events, 'Tracking events retrieved');
  } catch (error) {
    next(error);
  }
};
