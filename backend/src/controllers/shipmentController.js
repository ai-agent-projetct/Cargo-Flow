const { Op } = require('sequelize');
const { portalWhere } = require('../middleware/portalScope');
const { Shipment, Customer, User, Port, Carrier, TrackingEvent, Job, Invoice, Document, Container } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');
const { sendShipmentUpdateEmail } = require('../utils/emailService');

const getIncludes = (full = false) => {
  const base = [
    { association: 'customer', attributes: ['id', 'companyName', 'contactName', 'email'] },
    { association: 'creator', attributes: ['id', 'name', 'email'] },
    { association: 'assignedUser', attributes: ['id', 'name', 'email'] },
    { association: 'originPort', attributes: ['id', 'name', 'code', 'country'] },
    { association: 'destinationPort', attributes: ['id', 'name', 'code', 'country'] },
    { association: 'carrier', attributes: ['id', 'name', 'code', 'type'] },
  ];
  if (full) {
    base.push(
      { association: 'trackingEvents', order: [['eventDate', 'DESC']], include: [{ association: 'port', attributes: ['name', 'code'] }] },
      { association: 'containers' },
      { association: 'documents', include: [{ association: 'uploader', attributes: ['id', 'name'] }] },
      { association: 'invoices', attributes: ['id', 'invoiceNumber', 'status', 'totalAmount', 'currency'] },
      { association: 'jobs', attributes: ['id', 'jobNumber', 'title', 'status'] }
    );
  }
  return base;
};

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { status, mode, shipmentType, customerId, carrierId, search, sortBy = 'createdAt', sortOrder = 'DESC' } = req.query;

    // A portal login only ever sees its own customer's records.
    const where = { ...portalWhere(req) };
    if (status) where.status = status;
    if (mode) where.mode = mode;
    if (shipmentType) where.shipmentType = shipmentType;
    if (customerId) where.customerId = customerId;
    if (carrierId) where.carrierId = carrierId;

    if (search) {
      where[Op.or] = [
        { shipmentNumber: { [Op.like]: `%${search}%` } },
        { masterBL: { [Op.like]: `%${search}%` } },
        { houseBL: { [Op.like]: `%${search}%` } },
        { vesselName: { [Op.like]: `%${search}%` } },
        { commodity: { [Op.like]: `%${search}%` } },
      ];
    }

    const ALLOWED_SORT = ['createdAt', 'updatedAt', 'status', 'estimatedArrival', 'estimatedDeparture'];
    const sortField = ALLOWED_SORT.includes(sortBy) ? sortBy : 'createdAt';

    const { count, rows } = await Shipment.findAndCountAll({
      where,
      include: getIncludes(false),
      order: [[sortField, sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    return successResponse(res, rows, 'Shipments retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const shipment = await Shipment.findByPk(req.params.id, { include: getIncludes(true) });
    if (!shipment) return errorResponse(res, 'Shipment not found', 404);
    return successResponse(res, shipment, 'Shipment retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const data = { ...req.body, createdBy: req.user.id };
    const shipment = await Shipment.create(data);

    // Create initial tracking event
    await TrackingEvent.create({
      shipmentId: shipment.id,
      eventType: 'booking_confirmed',
      status: 'Booking Confirmed',
      description: 'Shipment booking has been confirmed',
      eventDate: new Date(),
      createdBy: req.user.id,
    });

    const result = await Shipment.findByPk(shipment.id, { include: getIncludes(true) });

    if (req.io) req.io.emit('shipment:created', { id: result.id, shipmentNumber: result.shipmentNumber });

    return successResponse(res, result, 'Shipment created', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const shipment = await Shipment.findByPk(req.params.id);
    if (!shipment) return errorResponse(res, 'Shipment not found', 404);

    if (shipment.status === 'cancelled') {
      return errorResponse(res, 'Cannot update a cancelled shipment', 400);
    }

    await shipment.update(req.body);
    const result = await Shipment.findByPk(shipment.id, { include: getIncludes(false) });
    return successResponse(res, result, 'Shipment updated');
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const shipment = await Shipment.findByPk(req.params.id);
    if (!shipment) return errorResponse(res, 'Shipment not found', 404);
    if (!['booking_confirmed', 'cancelled'].includes(shipment.status)) {
      return errorResponse(res, 'Only new or cancelled shipments can be deleted', 400);
    }
    await shipment.destroy();
    return successResponse(res, null, 'Shipment deleted');
  } catch (error) {
    next(error);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { status, location, note, notify = false } = req.body;
    const shipment = await Shipment.findByPk(req.params.id, {
      include: [{ association: 'customer' }],
    });
    if (!shipment) return errorResponse(res, 'Shipment not found', 404);

    const validStatuses = ['booking_confirmed', 'cargo_received', 'customs_clearance', 'loaded', 'departed', 'in_transit', 'arrived', 'delivered', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return errorResponse(res, 'Invalid status', 400);
    }

    const updateData = { status };
    if (location) updateData.currentLocation = location;
    if (status === 'departed') updateData.actualDeparture = new Date();
    if (status === 'arrived') updateData.actualArrival = new Date();
    if (status === 'delivered') updateData.deliveredAt = new Date();

    await shipment.update(updateData);

    // Create tracking event
    await TrackingEvent.create({
      shipmentId: shipment.id,
      eventType: status === 'cargo_received' ? 'cargo_received' : status === 'departed' ? 'departed' : status === 'arrived' ? 'arrived_at_port' : status === 'delivered' ? 'delivered' : 'other',
      status: status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      location: location || null,
      description: note || `Status updated to ${status.replace(/_/g, ' ')}`,
      eventDate: new Date(),
      createdBy: req.user.id,
    });

    if (notify && shipment.customer?.email) {
      await sendShipmentUpdateEmail(shipment, shipment.customer.email, `Your shipment status has been updated to: ${status.replace(/_/g, ' ')}`).catch(() => {});
    }

    if (req.io) {
      req.io.emit('shipment:statusUpdated', { id: shipment.id, shipmentNumber: shipment.shipmentNumber, status });
    }

    return successResponse(res, shipment, `Shipment status updated to ${status}`);
  } catch (error) {
    next(error);
  }
};

exports.assign = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const shipment = await Shipment.findByPk(req.params.id);
    if (!shipment) return errorResponse(res, 'Shipment not found', 404);

    const user = await User.findByPk(userId);
    if (!user) return errorResponse(res, 'User not found', 404);

    await shipment.update({ assignedTo: userId });

    if (req.io) {
      req.io.to(`user:${userId}`).emit('shipment:assigned', { id: shipment.id, shipmentNumber: shipment.shipmentNumber });
    }

    return successResponse(res, shipment, 'Shipment assigned');
  } catch (error) {
    next(error);
  }
};

exports.getStats = async (req, res, next) => {
  try {
    const { fn, col } = require('sequelize');
    const stats = await Shipment.findAll({
      attributes: ['status', [fn('COUNT', col('id')), 'count']],
      group: ['status'],
      raw: true,
    });
    return successResponse(res, stats, 'Shipment stats');
  } catch (error) {
    next(error);
  }
};
