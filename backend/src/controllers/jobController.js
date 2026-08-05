const { Op } = require('sequelize');
const { Job, Shipment, Customer, User, Document } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');
const { Notification } = require('../models');

const getIncludes = () => [
  { association: 'shipment', attributes: ['id', 'shipmentNumber', 'status', 'mode'] },
  { association: 'customer', attributes: ['id', 'companyName'] },
  { association: 'assignedUser', attributes: ['id', 'name', 'email', 'avatar'] },
  { association: 'creator', attributes: ['id', 'name', 'email'] },
];

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { status, type, priority, assignedTo, shipmentId, search } = req.query;

    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (priority) where.priority = priority;
    if (assignedTo) where.assignedTo = assignedTo;
    if (shipmentId) where.shipmentId = shipmentId;
    if (search) {
      where[Op.or] = [
        { jobNumber: { [Op.like]: `%${search}%` } },
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Job.findAndCountAll({
      where,
      include: getIncludes(),
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    return successResponse(res, rows, 'Jobs retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const job = await Job.findByPk(req.params.id, { include: getIncludes() });
    if (!job) return errorResponse(res, 'Job not found', 404);
    return successResponse(res, job, 'Job retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const data = { ...req.body, createdBy: req.user.id };
    const job = await Job.create(data);

    // Notify assigned user
    if (job.assignedTo) {
      await Notification.create({
        userId: job.assignedTo,
        type: 'job_assigned',
        title: 'New Job Assigned',
        message: `You have been assigned to job: ${job.jobNumber} - ${job.title}`,
        referenceId: job.id,
        referenceType: 'job',
      });
      if (req.io) {
        req.io.to(`user:${job.assignedTo}`).emit('notification:new', { type: 'job_assigned', jobNumber: job.jobNumber });
      }
    }

    const result = await Job.findByPk(job.id, { include: getIncludes() });
    return successResponse(res, result, 'Job created', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const job = await Job.findByPk(req.params.id);
    if (!job) return errorResponse(res, 'Job not found', 404);

    const prevAssignee = job.assignedTo;
    await job.update(req.body);

    // Notify new assignee if changed
    if (req.body.assignedTo && req.body.assignedTo !== prevAssignee) {
      await Notification.create({
        userId: req.body.assignedTo,
        type: 'job_assigned',
        title: 'Job Assigned',
        message: `You have been assigned to job: ${job.jobNumber} - ${job.title}`,
        referenceId: job.id,
        referenceType: 'job',
      });
      if (req.io) {
        req.io.to(`user:${req.body.assignedTo}`).emit('notification:new', { type: 'job_assigned', jobNumber: job.jobNumber });
      }
    }

    const result = await Job.findByPk(job.id, { include: getIncludes() });
    return successResponse(res, result, 'Job updated');
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const job = await Job.findByPk(req.params.id);
    if (!job) return errorResponse(res, 'Job not found', 404);
    if (job.status === 'in_progress') {
      return errorResponse(res, 'Cannot delete an in-progress job', 400);
    }
    await job.destroy();
    return successResponse(res, null, 'Job deleted');
  } catch (error) {
    next(error);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const job = await Job.findByPk(req.params.id);
    if (!job) return errorResponse(res, 'Job not found', 404);

    const updates = { status };
    if (status === 'in_progress' && !job.startedAt) updates.startedAt = new Date();
    if (status === 'completed') updates.completedAt = new Date();

    await job.update(updates);
    return successResponse(res, job, `Job status updated to ${status}`);
  } catch (error) {
    next(error);
  }
};

exports.assign = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const job = await Job.findByPk(req.params.id);
    if (!job) return errorResponse(res, 'Job not found', 404);

    const user = await User.findByPk(userId);
    if (!user) return errorResponse(res, 'User not found', 404);

    await job.update({ assignedTo: userId });

    await Notification.create({
      userId,
      type: 'job_assigned',
      title: 'Job Assigned',
      message: `Job ${job.jobNumber} has been assigned to you`,
      referenceId: job.id,
      referenceType: 'job',
    });

    return successResponse(res, job, 'Job assigned successfully');
  } catch (error) {
    next(error);
  }
};
