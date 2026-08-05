const { TrackingEvent, Shipment, Port, User } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');
const { Notification } = require('../models');

exports.getByShipment = async (req, res, next) => {
  try {
    const { shipmentId } = req.params;
    const shipment = await Shipment.findByPk(shipmentId);
    if (!shipment) return errorResponse(res, 'Shipment not found', 404);

    const events = await TrackingEvent.findAll({
      where: { shipmentId },
      include: [
        { association: 'port', attributes: ['name', 'code', 'country'] },
        { association: 'creator', attributes: ['id', 'name'] },
      ],
      order: [['eventDate', 'DESC']],
    });

    return successResponse(res, { shipment: { id: shipment.id, shipmentNumber: shipment.shipmentNumber, status: shipment.status }, events }, 'Tracking events retrieved');
  } catch (error) {
    next(error);
  }
};

exports.addEvent = async (req, res, next) => {
  try {
    const { shipmentId } = req.params;
    const shipment = await Shipment.findByPk(shipmentId);
    if (!shipment) return errorResponse(res, 'Shipment not found', 404);

    const data = { ...req.body, shipmentId, createdBy: req.user.id };
    const event = await TrackingEvent.create(data);

    // Update shipment current location
    if (req.body.location) {
      await shipment.update({ currentLocation: req.body.location });
    }

    // Create notification for customer's account manager
    if (shipment.assignedTo) {
      await Notification.create({
        userId: shipment.assignedTo,
        type: 'shipment_update',
        title: 'New Tracking Event',
        message: `Shipment ${shipment.shipmentNumber}: ${event.status}`,
        referenceId: shipment.id,
        referenceType: 'shipment',
      });
    }

    if (req.io) {
      req.io.emit('tracking:updated', {
        shipmentId,
        shipmentNumber: shipment.shipmentNumber,
        event: { id: event.id, status: event.status, location: event.location, eventDate: event.eventDate },
      });
    }

    const result = await TrackingEvent.findByPk(event.id, {
      include: [
        { association: 'port', attributes: ['name', 'code', 'country'] },
        { association: 'creator', attributes: ['id', 'name'] },
      ],
    });

    return successResponse(res, result, 'Tracking event added', 201);
  } catch (error) {
    next(error);
  }
};

exports.updateEvent = async (req, res, next) => {
  try {
    const event = await TrackingEvent.findByPk(req.params.id);
    if (!event) return errorResponse(res, 'Tracking event not found', 404);
    await event.update(req.body);
    return successResponse(res, event, 'Tracking event updated');
  } catch (error) {
    next(error);
  }
};

exports.deleteEvent = async (req, res, next) => {
  try {
    const event = await TrackingEvent.findByPk(req.params.id);
    if (!event) return errorResponse(res, 'Tracking event not found', 404);
    await event.destroy();
    return successResponse(res, null, 'Tracking event deleted');
  } catch (error) {
    next(error);
  }
};

exports.getPublicTracking = async (req, res, next) => {
  try {
    const { shipmentNumber } = req.params;
    const shipment = await Shipment.findOne({
      where: { shipmentNumber },
      attributes: ['id', 'shipmentNumber', 'status', 'mode', 'shipmentType', 'estimatedDeparture', 'estimatedArrival', 'actualDeparture', 'actualArrival', 'currentLocation'],
      include: [
        { association: 'originPort', attributes: ['name', 'code', 'country'] },
        { association: 'destinationPort', attributes: ['name', 'code', 'country'] },
        { association: 'carrier', attributes: ['name', 'code'] },
      ],
    });

    if (!shipment) return errorResponse(res, 'Shipment not found', 404);

    const events = await TrackingEvent.findAll({
      where: { shipmentId: shipment.id, isPublic: true },
      include: [{ association: 'port', attributes: ['name', 'code', 'country'] }],
      order: [['eventDate', 'DESC']],
    });

    return successResponse(res, { shipment, events }, 'Tracking info retrieved');
  } catch (error) {
    next(error);
  }
};
