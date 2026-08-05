const { Op } = require('sequelize');
const { Event, User } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');

const ALLOWED_SORT = ['createdAt', 'updatedAt', 'eventDate', 'eventNumber', 'eventType'];

const getIncludes = () => [
  { association: 'creator', attributes: ['id', 'name', 'email'] },
];

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const {
      entityType,
      entityId,
      eventType,
      isPublic,
      search,
      dateFrom,
      dateTo,
      sortBy = 'eventDate',
      sortOrder = 'DESC',
    } = req.query;

    const where = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (eventType) where.eventType = eventType;
    if (isPublic !== undefined) where.isPublic = isPublic === 'true';

    if (dateFrom || dateTo) {
      where.eventDate = {};
      if (dateFrom) where.eventDate[Op.gte] = new Date(dateFrom);
      if (dateTo) where.eventDate[Op.lte] = new Date(dateTo);
    }

    if (search) {
      where[Op.or] = [
        { eventNumber: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { location: { [Op.like]: `%${search}%` } },
        { remarks: { [Op.like]: `%${search}%` } },
      ];
    }

    const sortField = ALLOWED_SORT.includes(sortBy) ? sortBy : 'eventDate';
    const { count, rows } = await Event.findAndCountAll({
      where,
      include: getIncludes(),
      order: [[sortField, sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    return successResponse(res, rows, 'Events retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getByEntity = async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;

    const validEntityTypes = ['SHIPMENT', 'FF_JOB', 'SERVICE_JOB', 'QUOTATION'];
    if (!validEntityTypes.includes(entityType)) {
      return errorResponse(res, `Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}`, 400);
    }

    const events = await Event.findAll({
      where: { entityType, entityId },
      include: getIncludes(),
      order: [['eventDate', 'DESC']],
    });

    return successResponse(res, events, 'Events retrieved for entity');
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const event = await Event.findByPk(req.params.id, { include: getIncludes() });
    if (!event) return errorResponse(res, 'Event not found', 404);
    return successResponse(res, event, 'Event retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const {
      entityType,
      entityId,
      eventType,
      eventDate,
      location,
      description,
      remarks,
      attachments = [],
      isPublic = true,
    } = req.body;

    const validEntityTypes = ['SHIPMENT', 'FF_JOB', 'SERVICE_JOB', 'QUOTATION'];
    if (!validEntityTypes.includes(entityType)) {
      return errorResponse(res, `Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}`, 400);
    }

    if (!entityId) return errorResponse(res, 'entityId is required', 400);
    if (!eventType) return errorResponse(res, 'eventType is required', 400);

    const event = await Event.create({
      entityType,
      entityId,
      eventType,
      eventDate: eventDate || new Date(),
      location,
      description,
      remarks,
      attachments,
      isPublic,
      createdBy: req.user.id,
    });

    const result = await Event.findByPk(event.id, { include: getIncludes() });

    if (req.io) {
      req.io.emit('event:created', { id: result.id, entityType, entityId, eventType });
    }

    return successResponse(res, result, 'Event created', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const event = await Event.findByPk(req.params.id);
    if (!event) return errorResponse(res, 'Event not found', 404);

    // Only creator or admin can edit
    if (event.createdBy !== req.user.id && req.user.role !== 'admin') {
      return errorResponse(res, 'Unauthorized to edit this event', 403);
    }

    const allowedFields = ['eventType', 'eventDate', 'location', 'description', 'remarks', 'attachments', 'isPublic'];
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    }

    await event.update(updateData);
    const result = await Event.findByPk(event.id, { include: getIncludes() });
    return successResponse(res, result, 'Event updated');
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const event = await Event.findByPk(req.params.id);
    if (!event) return errorResponse(res, 'Event not found', 404);

    if (event.createdBy !== req.user.id && req.user.role !== 'admin') {
      return errorResponse(res, 'Unauthorized to delete this event', 403);
    }

    await event.destroy();
    return successResponse(res, null, 'Event deleted');
  } catch (error) {
    next(error);
  }
};
