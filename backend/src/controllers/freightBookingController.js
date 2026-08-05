const { Op } = require('sequelize');
const { FreightBooking, FFJob, Carrier, Customer, Company, User } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');

const ALLOWED_SORT = ['createdAt', 'updatedAt', 'bookingNumber', 'status', 'etd', 'eta'];

const getIncludes = () => [
  { association: 'customer', attributes: ['id', 'companyName', 'contactName', 'email'] },
  { association: 'carrier', attributes: ['id', 'name', 'code', 'type'] },
  { association: 'ffJob', attributes: ['id', 'jobNumber', 'status'] },
  { association: 'creator', attributes: ['id', 'name', 'email'] },
];

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const {
      status,
      transportMode,
      cargoType,
      customerId,
      carrierId,
      ffJobId,
      search,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = req.query;

    const where = {};
    if (status) where.status = status;
    if (transportMode) where.transportMode = transportMode;
    if (cargoType) where.cargoType = cargoType;
    if (customerId) where.customerId = customerId;
    if (carrierId) where.carrierId = carrierId;
    if (ffJobId) where.ffJobId = ffJobId;

    if (dateFrom || dateTo) {
      where.etd = {};
      if (dateFrom) where.etd[Op.gte] = new Date(dateFrom);
      if (dateTo) where.etd[Op.lte] = new Date(dateTo);
    }

    if (search) {
      where[Op.or] = [
        { bookingNumber: { [Op.like]: `%${search}%` } },
        { bookingReference: { [Op.like]: `%${search}%` } },
        { origin: { [Op.like]: `%${search}%` } },
        { destination: { [Op.like]: `%${search}%` } },
        { commodity: { [Op.like]: `%${search}%` } },
      ];
    }

    const sortField = ALLOWED_SORT.includes(sortBy) ? sortBy : 'createdAt';
    const { count, rows } = await FreightBooking.findAndCountAll({
      where,
      include: getIncludes(),
      order: [[sortField, sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    return successResponse(res, rows, 'Freight bookings retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const booking = await FreightBooking.findByPk(req.params.id, { include: getIncludes() });
    if (!booking) return errorResponse(res, 'Freight booking not found', 404);
    return successResponse(res, booking, 'Freight booking retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const data = { ...req.body, createdBy: req.user.id };

    if (!data.customerId) return errorResponse(res, 'customerId is required', 400);

    // Validate FF Job if provided
    if (data.ffJobId) {
      const ffJob = await FFJob.findByPk(data.ffJobId);
      if (!ffJob) return errorResponse(res, 'FF Job not found', 404);
    }

    const booking = await FreightBooking.create(data);
    const result = await FreightBooking.findByPk(booking.id, { include: getIncludes() });

    if (req.io) req.io.emit('freightBooking:created', { id: result.id, bookingNumber: result.bookingNumber });

    return successResponse(res, result, 'Freight booking created', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const booking = await FreightBooking.findByPk(req.params.id);
    if (!booking) return errorResponse(res, 'Freight booking not found', 404);

    if (['confirmed', 'cancelled'].includes(booking.status)) {
      return errorResponse(res, `Cannot edit a ${booking.status} booking`, 400);
    }

    await booking.update(req.body);
    const result = await FreightBooking.findByPk(booking.id, { include: getIncludes() });
    return successResponse(res, result, 'Freight booking updated');
  } catch (error) {
    next(error);
  }
};

exports.submit = async (req, res, next) => {
  try {
    const booking = await FreightBooking.findByPk(req.params.id);
    if (!booking) return errorResponse(res, 'Freight booking not found', 404);
    if (booking.status !== 'draft') return errorResponse(res, 'Only draft bookings can be submitted', 400);

    await booking.update({ status: 'submitted' });
    const result = await FreightBooking.findByPk(booking.id, { include: getIncludes() });
    return successResponse(res, result, 'Freight booking submitted');
  } catch (error) {
    next(error);
  }
};

exports.confirm = async (req, res, next) => {
  try {
    const booking = await FreightBooking.findByPk(req.params.id);
    if (!booking) return errorResponse(res, 'Freight booking not found', 404);

    if (!['draft', 'submitted'].includes(booking.status)) {
      return errorResponse(res, 'Only draft or submitted bookings can be confirmed', 400);
    }

    const updateData = { status: 'confirmed' };
    if (req.body.bookingReference) updateData.bookingReference = req.body.bookingReference;

    await booking.update(updateData);
    const result = await FreightBooking.findByPk(booking.id, { include: getIncludes() });

    if (req.io) req.io.emit('freightBooking:confirmed', { id: booking.id, bookingNumber: booking.bookingNumber });

    return successResponse(res, result, 'Freight booking confirmed');
  } catch (error) {
    next(error);
  }
};

exports.cancel = async (req, res, next) => {
  try {
    const booking = await FreightBooking.findByPk(req.params.id);
    if (!booking) return errorResponse(res, 'Freight booking not found', 404);
    if (booking.status === 'cancelled') return errorResponse(res, 'Booking already cancelled', 400);

    await booking.update({ status: 'cancelled' });
    const result = await FreightBooking.findByPk(booking.id, { include: getIncludes() });
    return successResponse(res, result, 'Freight booking cancelled');
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const booking = await FreightBooking.findByPk(req.params.id);
    if (!booking) return errorResponse(res, 'Freight booking not found', 404);

    if (!['draft', 'cancelled'].includes(booking.status)) {
      return errorResponse(res, 'Only draft or cancelled bookings can be deleted', 400);
    }

    await booking.destroy();
    return successResponse(res, null, 'Freight booking deleted');
  } catch (error) {
    next(error);
  }
};

exports.getStats = async (req, res, next) => {
  try {
    const statuses = ['draft', 'submitted', 'confirmed', 'cancelled'];
    const byStatus = {};

    await Promise.all(
      statuses.map(async (status) => {
        const count = await FreightBooking.count({ where: { status } });
        byStatus[status] = { count };
      })
    );

    return successResponse(res, { byStatus }, 'Freight booking stats retrieved');
  } catch (error) {
    next(error);
  }
};
