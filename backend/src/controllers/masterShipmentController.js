const { Op } = require('sequelize');
const { MasterShipment, Customer, Port } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');

const ALLOWED_SORT = ['createdAt', 'updatedAt', 'masterShipmentNumber', 'status', 'etd', 'eta'];

const VALID_TRANSITIONS = {
  created: ['ext_booked', 'cancelled', 'completed'],
  ext_booked: ['cancelled', 'completed', 'created'],
  completed: ['ext_booked', 'created'],
  cancelled: ['created'],
};

const getIncludes = () => [
  { association: 'customer', attributes: ['id', 'companyName', 'contactName', 'email', 'address', 'city', 'state', 'country', 'postalCode'] },
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
      cargoType,
      customerId,
      search,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = req.query;

    const where = {};
    if (status) where.status = status;
    if (transportMode) where.transportMode = transportMode;
    if (direction) where.direction = direction;
    if (cargoType) where.cargoType = cargoType;
    if (customerId) where.customerId = customerId;

    if (search) {
      where[Op.or] = [
        { masterShipmentNumber: { [Op.like]: `%${search}%` } },
        { mblNumber: { [Op.like]: `%${search}%` } },
        { vesselName: { [Op.like]: `%${search}%` } },
        { commodity: { [Op.like]: `%${search}%` } },
        { origin: { [Op.like]: `%${search}%` } },
        { destination: { [Op.like]: `%${search}%` } },
      ];
    }

    const sortField = ALLOWED_SORT.includes(sortBy) ? sortBy : 'createdAt';
    const { count, rows } = await MasterShipment.findAndCountAll({
      where,
      include: getIncludes(),
      order: [[sortField, sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    return successResponse(res, rows, 'Master Shipments retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const record = await MasterShipment.findByPk(req.params.id, { include: getIncludes() });
    if (!record) return errorResponse(res, 'Master Shipment not found', 404);
    return successResponse(res, record, 'Master Shipment retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { houseShipmentId, ...body } = req.body;
    const data = { ...body, createdBy: req.user.id };
    const record = await MasterShipment.create(data);

    if (houseShipmentId) {
      const { FFJob } = require('../models');
      const house = await FFJob.findByPk(houseShipmentId);
      if (house) {
        await house.update({ masterShipmentId: record.id });
      }
    }

    const result = await MasterShipment.findByPk(record.id, { include: getIncludes() });

    if (req.io) req.io.emit('masterShipment:created', { id: result.id, masterShipmentNumber: result.masterShipmentNumber });

    return successResponse(res, result, 'Master Shipment created', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const record = await MasterShipment.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Master Shipment not found', 404);

    if (record.status === 'cancelled') {
      return errorResponse(res, `Cannot edit a ${record.status} master shipment`, 400);
    }

    await record.update(req.body);
    const result = await MasterShipment.findByPk(record.id, { include: getIncludes() });
    return successResponse(res, result, 'Master Shipment updated');
  } catch (error) {
    next(error);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { status, remarks } = req.body;
    const record = await MasterShipment.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Master Shipment not found', 404);

    const allowed = VALID_TRANSITIONS[record.status];
    if (!allowed || !allowed.includes(status)) {
      return errorResponse(res, `Cannot transition from ${record.status} to ${status}`, 400);
    }

    const updateData = { status };
    if (status === 'ext_booked' && !record.atd) updateData.atd = new Date();
    if (status === 'completed' && !record.ata) updateData.ata = new Date();

    const activityLog = record.activityLog || [];
    activityLog.unshift({
      id: require('crypto').randomUUID(),
      type: 'status',
      message: `Status changed to ${status}`,
      remarks: remarks || null,
      createdAt: new Date().toISOString(),
      createdBy: req.user.id,
    });
    updateData.activityLog = activityLog;

    await record.update(updateData);

    if (req.io) req.io.emit('masterShipment:statusUpdated', { id: record.id, masterShipmentNumber: record.masterShipmentNumber, status });

    const result = await MasterShipment.findByPk(record.id, { include: getIncludes() });
    return successResponse(res, result, `Master Shipment status updated to ${status}`);
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const record = await MasterShipment.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Master Shipment not found', 404);

    if (record.status !== 'created') {
      return errorResponse(res, 'Only master shipments in Created status can be deleted', 400);
    }

    const { FFJob } = require('../models');
    await FFJob.update({ masterShipmentId: null }, { where: { masterShipmentId: record.id } });

    await record.destroy();
    return successResponse(res, null, 'Master Shipment deleted');
  } catch (error) {
    next(error);
  }
};

// GET /master-shipments/:id/houses - houses currently attached to this master
exports.getHouses = async (req, res, next) => {
  try {
    const record = await MasterShipment.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Master Shipment not found', 404);

    const { FFJob } = require('../models');
    const houses = await FFJob.findAll({
      where: { masterShipmentId: record.id },
      attributes: ['id', 'jobNumber', 'hblNumber', 'shipmentDate', 'status', 'containerNumbers', 'transportMode', 'revenue', 'documents'],
      order: [['createdAt', 'ASC']],
    });

    return successResponse(res, houses, 'Attached houses retrieved');
  } catch (error) {
    next(error);
  }
};

// GET /master-shipments/:id/available-houses - houses with no master (or
// already attached to this one) for the "Select Houses to Attach" modal
exports.getAvailableHouses = async (req, res, next) => {
  try {
    const record = await MasterShipment.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Master Shipment not found', 404);

    const { Op } = require('sequelize');
    const { FFJob } = require('../models');
    const { search } = req.query;

    const where = {
      [Op.or]: [{ masterShipmentId: null }, { masterShipmentId: record.id }],
    };
    if (search) {
      where[Op.and] = [{
        [Op.or]: [
          { jobNumber: { [Op.like]: `%${search}%` } },
          { hblNumber: { [Op.like]: `%${search}%` } },
        ],
      }];
    }

    const houses = await FFJob.findAll({
      where,
      attributes: ['id', 'jobNumber', 'hblNumber', 'shipmentDate', 'status', 'containerNumbers', 'transportMode', 'masterShipmentId'],
      order: [['createdAt', 'DESC']],
      limit: 200,
    });

    return successResponse(res, houses, 'Available houses retrieved');
  } catch (error) {
    next(error);
  }
};

// POST /master-shipments/:id/attach-houses - body: { houseIds: [] }
exports.attachHouses = async (req, res, next) => {
  try {
    const record = await MasterShipment.findByPk(req.params.id);
    if (!record) return errorResponse(res, 'Master Shipment not found', 404);

    const { houseIds } = req.body;
    if (!Array.isArray(houseIds)) {
      return errorResponse(res, 'houseIds must be an array', 400);
    }

    const { FFJob } = require('../models');

    // Detach houses that were attached but are no longer selected
    await FFJob.update(
      { masterShipmentId: null },
      { where: { masterShipmentId: record.id, id: { [require('sequelize').Op.notIn]: houseIds.length ? houseIds : [null] } } }
    );

    if (houseIds.length) {
      await FFJob.update({ masterShipmentId: record.id }, { where: { id: houseIds } });
    }

    const houses = await FFJob.findAll({
      where: { masterShipmentId: record.id },
      attributes: ['id', 'jobNumber', 'hblNumber', 'shipmentDate', 'status', 'containerNumbers', 'transportMode'],
      order: [['createdAt', 'ASC']],
    });

    return successResponse(res, houses, 'Houses attached');
  } catch (error) {
    next(error);
  }
};

exports.getStats = async (req, res, next) => {
  try {
    const statuses = ['created', 'ext_booked', 'cancelled', 'completed'];
    const byStatus = {};

    await Promise.all(
      statuses.map(async (status) => {
        const count = await MasterShipment.count({ where: { status } });
        byStatus[status] = { count };
      })
    );

    const total = await MasterShipment.count();

    return successResponse(res, { byStatus, total }, 'Master Shipment stats retrieved');
  } catch (error) {
    next(error);
  }
};
