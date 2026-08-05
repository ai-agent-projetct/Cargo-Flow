const { Op } = require('sequelize');
const { ServiceJob, Quotation, Customer, User, Company, Event } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');

const ALLOWED_SORT = ['createdAt', 'updatedAt', 'jobNumber', 'status', 'requestDate', 'completionDate'];

const VALID_TRANSITIONS = {
  pending: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

const getIncludes = () => [
  { association: 'customer', attributes: ['id', 'companyName', 'contactName', 'email'] },
  { association: 'quotation', attributes: ['id', 'quoteNumber', 'quotationNumber', 'totalAmount', 'currency'] },
  { association: 'assignedUser', attributes: ['id', 'name', 'email'] },
  { association: 'creator', attributes: ['id', 'name', 'email'] },
];

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const {
      status,
      serviceType,
      customerId,
      search,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = req.query;

    const where = {};
    if (status) where.status = status;
    if (serviceType) where.serviceType = serviceType;
    if (customerId) where.customerId = customerId;

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt[Op.gte] = new Date(dateFrom);
      if (dateTo) where.createdAt[Op.lte] = new Date(dateTo);
    }

    if (search) {
      where[Op.or] = [
        { jobNumber: { [Op.like]: `%${search}%` } },
        { origin: { [Op.like]: `%${search}%` } },
        { destination: { [Op.like]: `%${search}%` } },
        { remarks: { [Op.like]: `%${search}%` } },
      ];
    }

    const sortField = ALLOWED_SORT.includes(sortBy) ? sortBy : 'createdAt';
    const { count, rows } = await ServiceJob.findAndCountAll({
      where,
      include: getIncludes(),
      order: [[sortField, sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    return successResponse(res, rows, 'Service Jobs retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const job = await ServiceJob.findByPk(req.params.id, { include: getIncludes() });
    if (!job) return errorResponse(res, 'Service Job not found', 404);

    const events = await Event.findAll({
      where: { entityType: 'SERVICE_JOB', entityId: job.id },
      order: [['eventDate', 'DESC']],
      include: [{ association: 'creator', attributes: ['id', 'name', 'email'] }],
    });

    const result = job.toJSON();
    result.events = events;

    return successResponse(res, result, 'Service Job retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const data = { ...req.body, createdBy: req.user.id };

    if (data.quotationId) {
      const quotation = await Quotation.findByPk(data.quotationId);
      if (!quotation) return errorResponse(res, 'Quotation not found', 404);
      if (!data.customerId) data.customerId = quotation.customerId;
    }

    if (!data.customerId) return errorResponse(res, 'customerId is required', 400);
    if (!data.serviceType) return errorResponse(res, 'serviceType is required', 400);

    // Calculate total from charges if provided
    if (data.charges && Array.isArray(data.charges)) {
      data.totalAmount = data.charges.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
    }

    const job = await ServiceJob.create(data);

    // Update quotation to link service job if provided
    if (data.quotationId) {
      await Quotation.update(
        { serviceJobId: job.id, status: 'converted' },
        { where: { id: data.quotationId } }
      );
    }

    // Create initial event
    await Event.create({
      entityType: 'SERVICE_JOB',
      entityId: job.id,
      eventType: 'CREATED',
      eventDate: new Date(),
      description: `Service Job ${job.jobNumber} created for ${data.serviceType}`,
      createdBy: req.user.id,
      isPublic: false,
    });

    const result = await ServiceJob.findByPk(job.id, { include: getIncludes() });

    if (req.io) req.io.emit('serviceJob:created', { id: result.id, jobNumber: result.jobNumber });

    return successResponse(res, result, 'Service Job created', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const job = await ServiceJob.findByPk(req.params.id);
    if (!job) return errorResponse(res, 'Service Job not found', 404);

    if (['completed', 'cancelled'].includes(job.status)) {
      return errorResponse(res, `Cannot edit a ${job.status} job`, 400);
    }

    const updateData = { ...req.body };

    // Recalculate total if charges updated
    if (updateData.charges && Array.isArray(updateData.charges)) {
      updateData.totalAmount = updateData.charges.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
    }

    await job.update(updateData);
    const result = await ServiceJob.findByPk(job.id, { include: getIncludes() });
    return successResponse(res, result, 'Service Job updated');
  } catch (error) {
    next(error);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { status, remarks, location, eventDate } = req.body;
    const job = await ServiceJob.findByPk(req.params.id);
    if (!job) return errorResponse(res, 'Service Job not found', 404);

    const allowed = VALID_TRANSITIONS[job.status];
    if (!allowed || !allowed.includes(status)) {
      return errorResponse(res, `Cannot transition from ${job.status} to ${status}`, 400);
    }

    const updateData = { status };
    if (status === 'completed') updateData.completionDate = new Date();
    if (remarks) updateData.remarks = remarks;

    await job.update(updateData);

    const eventTypeMap = {
      in_progress: 'CONFIRMED',
      completed: 'DELIVERED',
      cancelled: 'CANCELLED',
    };

    await Event.create({
      entityType: 'SERVICE_JOB',
      entityId: job.id,
      eventType: eventTypeMap[status] || 'CUSTOM',
      eventDate: eventDate || new Date(),
      location: location || '',
      description: `Service job status changed to ${status}`,
      remarks,
      createdBy: req.user.id,
      isPublic: true,
    });

    if (req.io) req.io.emit('serviceJob:statusUpdated', { id: job.id, jobNumber: job.jobNumber, status });

    const result = await ServiceJob.findByPk(job.id, { include: getIncludes() });
    return successResponse(res, result, `Service Job status updated to ${status}`);
  } catch (error) {
    next(error);
  }
};

exports.addCharge = async (req, res, next) => {
  try {
    const job = await ServiceJob.findByPk(req.params.id);
    if (!job) return errorResponse(res, 'Service Job not found', 404);

    if (['completed', 'cancelled'].includes(job.status)) {
      return errorResponse(res, `Cannot add charges to a ${job.status} job`, 400);
    }

    const { service, description, amount, currency } = req.body;
    if (!service || amount === undefined) return errorResponse(res, 'service and amount are required', 400);

    const existingCharges = job.charges || [];
    const newCharge = {
      id: require('crypto').randomUUID(),
      service,
      description: description || service,
      amount: parseFloat(amount),
      currency: currency || job.currency,
    };

    const updatedCharges = [...existingCharges, newCharge];
    const newTotal = updatedCharges.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);

    await job.update({ charges: updatedCharges, totalAmount: newTotal });

    return successResponse(res, newCharge, 'Charge added to Service Job', 201);
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const job = await ServiceJob.findByPk(req.params.id);
    if (!job) return errorResponse(res, 'Service Job not found', 404);

    if (job.status !== 'pending') {
      return errorResponse(res, 'Only pending service jobs can be deleted', 400);
    }

    if (job.quotationId) {
      await Quotation.update(
        { serviceJobId: null, status: 'accepted' },
        { where: { id: job.quotationId, serviceJobId: job.id } }
      );
    }

    await job.destroy();
    return successResponse(res, null, 'Service Job deleted');
  } catch (error) {
    next(error);
  }
};

exports.getStats = async (req, res, next) => {
  try {
    const statuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    const byStatus = {};

    await Promise.all(
      statuses.map(async (status) => {
        const [count, totalAmount] = await Promise.all([
          ServiceJob.count({ where: { status } }),
          ServiceJob.sum('totalAmount', { where: { status } }),
        ]);
        byStatus[status] = { count, totalAmount: parseFloat(totalAmount) || 0 };
      })
    );

    const total = await ServiceJob.count();

    return successResponse(res, { byStatus, total }, 'Service Job stats retrieved');
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

    const { count, rows } = await ServiceJob.findAndCountAll({
      where,
      include: getIncludes(),
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    return successResponse(res, rows, 'User Service Jobs retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};
