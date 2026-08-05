const { Op, fn, col } = require('sequelize');
const { Opportunity, Customer, User } = require('../models');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');

const ALLOWED_SORT = ['createdAt', 'updatedAt', 'name', 'stage', 'estimatedRevenue', 'expectedCloseDate', 'probability'];

const getIncludes = () => [
  { association: 'customer', attributes: ['id', 'companyName', 'contactName', 'email'] },
  { association: 'assignee', attributes: ['id', 'name', 'email'] },
  { association: 'creator', attributes: ['id', 'name', 'email'] },
];

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const {
      stage,
      assignedTo,
      customerId,
      transportMode,
      direction,
      priority,
      search,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = req.query;

    const where = {};
    if (stage) where.stage = stage;
    if (assignedTo) where.assignedTo = assignedTo;
    if (customerId) where.customerId = customerId;
    if (transportMode) where.transportMode = transportMode;
    if (direction) where.direction = direction;
    if (priority) where.priority = priority;

    if (dateFrom || dateTo) {
      where.expectedCloseDate = {};
      if (dateFrom) where.expectedCloseDate[Op.gte] = dateFrom;
      if (dateTo) where.expectedCloseDate[Op.lte] = dateTo;
    }

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { contactName: { [Op.like]: `%${search}%` } },
        { contactEmail: { [Op.like]: `%${search}%` } },
        { origin: { [Op.like]: `%${search}%` } },
        { destination: { [Op.like]: `%${search}%` } },
      ];
    }

    const sortField = ALLOWED_SORT.includes(sortBy) ? sortBy : 'createdAt';
    const { count, rows } = await Opportunity.findAndCountAll({
      where,
      include: getIncludes(),
      order: [[sortField, sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    return successResponse(res, rows, 'Opportunities retrieved', 200, getPaginationMeta(count, page, limit));
  } catch (error) {
    next(error);
  }
};

exports.getKanban = async (req, res, next) => {
  try {
    const stages = ['new', 'qualified', 'proposition', 'negotiation', 'won', 'lost'];
    const kanban = {};

    await Promise.all(
      stages.map(async (stage) => {
        const opportunities = await Opportunity.findAll({
          where: { stage },
          include: getIncludes(),
          order: [['updatedAt', 'DESC']],
        });
        const totalRevenue = opportunities.reduce((sum, o) => sum + (parseFloat(o.estimatedRevenue) || 0), 0);
        kanban[stage] = { items: opportunities, count: opportunities.length, totalRevenue };
      })
    );

    return successResponse(res, kanban, 'Kanban board retrieved');
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const opp = await Opportunity.findByPk(req.params.id, { include: getIncludes() });
    if (!opp) return errorResponse(res, 'Opportunity not found', 404);
    return successResponse(res, opp, 'Opportunity retrieved');
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const data = { ...req.body, createdBy: req.user.id };

    if (!data.name) return errorResponse(res, 'name is required', 400);

    const opp = await Opportunity.create(data);
    const result = await Opportunity.findByPk(opp.id, { include: getIncludes() });

    if (req.io) req.io.emit('opportunity:created', { id: result.id, name: result.name, stage: result.stage });

    return successResponse(res, result, 'Opportunity created', 201);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const opp = await Opportunity.findByPk(req.params.id);
    if (!opp) return errorResponse(res, 'Opportunity not found', 404);

    await opp.update(req.body);
    const result = await Opportunity.findByPk(opp.id, { include: getIncludes() });
    return successResponse(res, result, 'Opportunity updated');
  } catch (error) {
    next(error);
  }
};

exports.updateStage = async (req, res, next) => {
  try {
    const { stage, lostReason } = req.body;
    const opp = await Opportunity.findByPk(req.params.id);
    if (!opp) return errorResponse(res, 'Opportunity not found', 404);

    const validStages = ['new', 'qualified', 'proposition', 'negotiation', 'won', 'lost'];
    if (!validStages.includes(stage)) {
      return errorResponse(res, `Invalid stage. Valid: ${validStages.join(', ')}`, 400);
    }

    const updateData = { stage };
    if (stage === 'won') {
      updateData.wonDate = new Date();
      updateData.probability = 100;
    }
    if (stage === 'lost') {
      updateData.lostReason = lostReason || null;
      updateData.probability = 0;
    }

    await opp.update(updateData);
    const result = await Opportunity.findByPk(opp.id, { include: getIncludes() });

    if (req.io) req.io.emit('opportunity:stageUpdated', { id: opp.id, stage });

    return successResponse(res, result, `Opportunity moved to ${stage}`);
  } catch (error) {
    next(error);
  }
};

exports.markWon = async (req, res, next) => {
  try {
    const opp = await Opportunity.findByPk(req.params.id);
    if (!opp) return errorResponse(res, 'Opportunity not found', 404);

    await opp.update({ stage: 'won', wonDate: new Date(), probability: 100 });
    const result = await Opportunity.findByPk(opp.id, { include: getIncludes() });

    if (req.io) req.io.emit('opportunity:won', { id: opp.id, name: opp.name });

    return successResponse(res, result, 'Opportunity marked as won');
  } catch (error) {
    next(error);
  }
};

exports.markLost = async (req, res, next) => {
  try {
    const { lostReason } = req.body;
    const opp = await Opportunity.findByPk(req.params.id);
    if (!opp) return errorResponse(res, 'Opportunity not found', 404);

    await opp.update({ stage: 'lost', lostReason: lostReason || null, probability: 0 });
    const result = await Opportunity.findByPk(opp.id, { include: getIncludes() });

    if (req.io) req.io.emit('opportunity:lost', { id: opp.id, name: opp.name });

    return successResponse(res, result, 'Opportunity marked as lost');
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const opp = await Opportunity.findByPk(req.params.id);
    if (!opp) return errorResponse(res, 'Opportunity not found', 404);

    await opp.destroy();
    return successResponse(res, null, 'Opportunity deleted');
  } catch (error) {
    next(error);
  }
};

exports.getStats = async (req, res, next) => {
  try {
    const stages = ['new', 'qualified', 'proposition', 'negotiation', 'won', 'lost'];
    const byStage = {};

    await Promise.all(
      stages.map(async (stage) => {
        const [count, revenue] = await Promise.all([
          Opportunity.count({ where: { stage } }),
          Opportunity.sum('estimatedRevenue', { where: { stage } }),
        ]);
        byStage[stage] = { count, estimatedRevenue: parseFloat(revenue) || 0 };
      })
    );

    const totalActive = await Opportunity.count({ where: { stage: { [Op.notIn]: ['won', 'lost'] } } });
    const totalRevenuePipeline = await Opportunity.sum('estimatedRevenue', {
      where: { stage: { [Op.notIn]: ['won', 'lost'] } },
    });

    return successResponse(res, {
      byStage,
      totalActive,
      totalRevenuePipeline: parseFloat(totalRevenuePipeline) || 0,
    }, 'Opportunity stats retrieved');
  } catch (error) {
    next(error);
  }
};
