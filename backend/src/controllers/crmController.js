// Sales & CRM: stages, teams, targets, quote templates, prospects and leads.
//
// The plain lists go through the shared CRUD factory. Leads get their own
// handlers because converting a lead to an opportunity is a real transition
// with a gate on it, and because the conversion has to carry the lane and
// cargo detail across so nobody retypes it.

const { Op, fn, col } = require('sequelize');
const {
  CrmStage, SalesTeam, SalesTarget, QuoteTemplate, Prospect, Lead,
  Opportunity, Organization, User, Port, Quotation, FFJob,
} = require('../models');
const { crudController } = require('./crudFactory');
const { successResponse, errorResponse, getPagination, getPaginationMeta } = require('../utils/helpers');
const { companyWhere, defaultCompanyId } = require('../middleware/companyScope');

const num = (v, d = 0) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : d;
};

// --- stages -----------------------------------------------------------------
const stages = crudController({
  model: CrmStage,
  label: 'Stage',
  searchFields: ['name'],
  filterFields: ['kind', 'isActive'],
  order: [['kind', 'ASC'], ['sequence', 'ASC']],
  guardDelete: async (stage) => {
    if (stage.kind === 'lead') {
      const used = await Lead.count({ where: { stageId: stage.id } });
      if (used) return `${used} lead(s) are in this stage. Move them first.`;
    } else {
      const used = await Opportunity.count({ where: { stageId: stage.id } });
      if (used) return `${used} opportunity(ies) are in this stage. Move them first.`;
    }
    return null;
  },
});

// --- sales teams ------------------------------------------------------------
const teams = crudController({
  model: SalesTeam,
  label: 'Sales team',
  searchFields: ['name', 'code'],
  filterFields: ['isActive'],
  order: [['sequence', 'ASC']],
  include: [{ model: User, as: 'leader', attributes: ['id', 'name', 'email'] }],
  beforeWrite: (body) => ({
    ...body,
    memberIds: Array.isArray(body.memberIds) ? body.memberIds : [],
  }),
  guardDelete: async (team) => {
    const [leads, opps] = await Promise.all([
      Lead.count({ where: { salesTeamId: team.id } }),
      Opportunity.count({ where: { salesTeamId: team.id } }),
    ]);
    if (leads || opps) {
      return `This team owns ${leads} lead(s) and ${opps} opportunity(ies). Reassign them first.`;
    }
    return null;
  },
});

// Members are returned resolved, not as raw ids, so the form can show names.
teams.getMembers = async (req, res, next) => {
  try {
    const team = await SalesTeam.findByPk(req.params.id);
    if (!team) return errorResponse(res, 'Sales team not found', 404);
    const ids = Array.isArray(team.memberIds) ? team.memberIds : [];
    const members = ids.length
      ? await User.findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id', 'name', 'email', 'role'] })
      : [];
    return successResponse(res, members, 'Team members retrieved');
  } catch (error) {
    next(error);
  }
};

// --- quote templates --------------------------------------------------------
const templates = crudController({
  model: QuoteTemplate,
  label: 'Quote template',
  searchFields: ['name'],
  filterFields: ['templateFor', 'transportMode', 'shipmentType', 'isActive'],
  order: [['sequence', 'ASC']],
});

// --- prospects --------------------------------------------------------------
const prospects = crudController({
  model: Prospect,
  label: 'Prospect',
  searchFields: ['name', 'contactName', 'email', 'prospectNumber'],
  filterFields: ['isActive', 'industry', 'clientTag', 'salesTeamId', 'assignedTo', 'country'],
  order: [['createdAt', 'DESC']],
  include: [
    { model: User, as: 'assignedUser', attributes: ['id', 'name', 'email'] },
    { model: SalesTeam, as: 'salesTeam', attributes: ['id', 'name'] },
  ],
  detailInclude: [
    { model: User, as: 'assignedUser', attributes: ['id', 'name', 'email'] },
    { model: SalesTeam, as: 'salesTeam', attributes: ['id', 'name'] },
    { model: Organization, as: 'relatedPartner', attributes: ['id', 'name', 'companyName'] },
    { model: Lead, as: 'leads' },
  ],
  beforeWrite: (body, req) => ({
    ...body,
    companyId: body.companyId || defaultCompanyId(req),
    createdBy: body.createdBy || (req.user ? req.user.id : null),
  }),
  guardDelete: async (prospect) => {
    const leads = await Lead.count({ where: { prospectId: prospect.id } });
    if (leads) return `${leads} lead(s) belong to this prospect. Delete or reassign them first.`;
    return null;
  },
});

// Turn a prospect into a real customer account. The prospect is kept and
// linked rather than deleted, so the pipeline history survives the conversion.
prospects.convertToOrganization = async (req, res, next) => {
  try {
    const prospect = await Prospect.findByPk(req.params.id);
    if (!prospect) return errorResponse(res, 'Prospect not found', 404);
    if (prospect.relatedPartnerId) {
      return errorResponse(res, 'This prospect has already been converted to an organization', 409);
    }

    const org = await Organization.create({
      companyType: 'company',
      name: prospect.name,
      companyName: prospect.name,
      streetName: prospect.street1,
      street2: prospect.street2,
      city: prospect.city,
      state: prospect.state,
      country: prospect.country,
      zip: prospect.zip,
      contactPerson: prospect.contactName,
      jobPosition: prospect.designation,
      email: prospect.email,
      phone: prospect.phone,
      mobile: prospect.mobile,
      website: prospect.website,
      industry: prospect.industry,
      partyTypes: prospect.partyTypes && prospect.partyTypes.length ? prospect.partyTypes : ['Customer'],
      salesperson: prospect.assignedTo,
      currency: prospect.turnoverCurrency || 'AED',
      notes: prospect.remarks,
      isActive: true,
      createdBy: req.user ? req.user.id : null,
      ...(req.body || {}),
    });

    await prospect.update({ relatedPartnerId: org.id, convertedAt: new Date() });
    return successResponse(res, { prospect, organization: org }, 'Prospect converted to an organization', 201);
  } catch (error) {
    next(error);
  }
};

// --- sales targets ----------------------------------------------------------
const targets = crudController({
  model: SalesTarget,
  label: 'Sales target',
  searchFields: ['name'],
  filterFields: ['userId', 'salesTeamId', 'targetParameter', 'transportMode', 'isActive'],
  order: [['dateFrom', 'DESC']],
  include: [
    { model: User, as: 'salesperson', attributes: ['id', 'name', 'email'] },
    { model: SalesTeam, as: 'salesTeam', attributes: ['id', 'name'] },
  ],
  beforeWrite: (body, req) => ({
    ...body,
    companyId: body.companyId || defaultCompanyId(req),
    createdBy: body.createdBy || (req.user ? req.user.id : null),
  }),
});

/**
 * Achieved figure for one target, measured from live records in its window.
 * Each parameter reads the source that actually carries it, so the number on
 * the dashboard is the same number the underlying report would produce.
 */
const computeAchieved = async (target) => {
  const from = target.dateFrom;
  const to = target.dateTo;
  const modeWhere = target.transportMode ? { transportMode: target.transportMode } : {};

  if (target.targetParameter === 'quotation') {
    return Quotation.count({
      where: {
        createdBy: target.userId,
        createdAt: { [Op.between]: [new Date(from), new Date(`${to}T23:59:59`)] },
        ...modeWhere,
      },
    });
  }

  // Everything else is measured on shipments the salesperson owns.
  const jobs = await FFJob.findAll({
    where: {
      salesAgentId: target.userId,
      shipmentDate: { [Op.between]: [from, to] },
      ...modeWhere,
    },
    attributes: ['id', 'grossWeight', 'volume', 'chargeableWeight', 'containerNumbers',
      'estimatedRevenue', 'estimatedMargin'],
  });

  switch (target.targetParameter) {
    case 'weight':
      return jobs.reduce((s, j) => s + num(j.chargeableWeight || j.grossWeight), 0);
    case 'volume':
      return jobs.reduce((s, j) => s + num(j.volume), 0);
    case 'teu':
      // A 40ft counts as 2 TEU; without a size we count 1 per container.
      return jobs.reduce((s, j) => {
        const cnts = Array.isArray(j.containerNumbers) ? j.containerNumbers : [];
        return s + cnts.reduce((n, c) => n + (/40|45/.test(String(c && (c.type || c.size) || '')) ? 2 : 1), 0);
      }, 0);
    case 'gross_revenue':
      return jobs.reduce((s, j) => s + num(j.estimatedRevenue), 0);
    case 'gross_margin':
      return jobs.reduce((s, j) => s + num(j.estimatedMargin), 0);
    default:
      return 0;
  }
};

targets.recompute = async (req, res, next) => {
  try {
    const where = req.params.id ? { id: req.params.id } : { isActive: true };
    const rows = await SalesTarget.findAll({ where });
    if (!rows.length) return errorResponse(res, 'No targets to recompute', 404);

    const updated = [];
    for (const t of rows) {
      const achieved = await computeAchieved(t);
      const pct = num(t.targetValue) ? (achieved / num(t.targetValue)) * 100 : 0;
      let incentive = 0;
      if (t.incentiveType === 'percentage') {
        incentive = (achieved * num(t.incentiveUnit)) / 100;
      } else if (t.incentiveType === 'amount') {
        incentive = achieved >= num(t.targetValue) ? num(t.incentiveUnit) : 0;
      }
      await t.update({
        achievedValue: Number(achieved.toFixed(3)),
        achievedPercentage: Number(pct.toFixed(4)),
        incentiveEarned: Number(incentive.toFixed(2)),
        lastComputedAt: new Date(),
      });
      updated.push(t);
    }
    return successResponse(res, updated, `${updated.length} target(s) recomputed`);
  } catch (error) {
    next(error);
  }
};

// --- leads ------------------------------------------------------------------
const leadInclude = [
  { model: Prospect, as: 'prospect', attributes: ['id', 'name', 'prospectNumber', 'industry', 'clientTag'] },
  { model: CrmStage, as: 'stage', attributes: ['id', 'name', 'sequence', 'isCreateOpportunity', 'isLost'] },
  { model: User, as: 'assignedUser', attributes: ['id', 'name', 'email'] },
  { model: SalesTeam, as: 'salesTeam', attributes: ['id', 'name'] },
];

const leads = {
  getAll: async (req, res, next) => {
    try {
      const { page, limit, offset } = getPagination(req.query);
      const where = { ...companyWhere(req) };
      const {
        search, stageId, status, transportMode, leadCategory, assignedTo,
        salesTeamId, prospectId, dateFrom, dateTo,
      } = req.query;

      if (stageId) where.stageId = stageId;
      if (status) where.status = status;
      if (transportMode) where.transportMode = transportMode;
      if (leadCategory) where.leadCategory = leadCategory;
      if (assignedTo) where.assignedTo = assignedTo;
      if (salesTeamId) where.salesTeamId = salesTeamId;
      if (prospectId) where.prospectId = prospectId;
      if (dateFrom && dateTo) where.date = { [Op.between]: [dateFrom, dateTo] };
      else if (dateFrom) where.date = { [Op.gte]: dateFrom };
      else if (dateTo) where.date = { [Op.lte]: dateTo };

      if (search) {
        where[Op.or] = [
          { leadNumber: { [Op.like]: `%${search}%` } },
          { name: { [Op.like]: `%${search}%` } },
          { contactName: { [Op.like]: `%${search}%` } },
          { commodity: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
        ];
      }

      const { count, rows } = await Lead.findAndCountAll({
        where, include: leadInclude, order: [['date', 'DESC'], ['leadNumber', 'DESC']],
        limit, offset, distinct: true,
      });
      return successResponse(res, rows, 'Leads retrieved', 200, getPaginationMeta(count, page, limit));
    } catch (error) {
      next(error);
    }
  },

  getById: async (req, res, next) => {
    try {
      const lead = await Lead.findByPk(req.params.id, {
        include: [
          ...leadInclude,
          { model: Port, as: 'portOfLoading', attributes: ['id', 'name', 'code'] },
          { model: Port, as: 'portOfDischarge', attributes: ['id', 'name', 'code'] },
          { model: Opportunity, as: 'opportunity', attributes: ['id', 'name', 'stage'] },
        ],
      });
      if (!lead) return errorResponse(res, 'Lead not found', 404);
      return successResponse(res, { ...lead.toJSON(), actions: leadActions(lead) }, 'Lead retrieved');
    } catch (error) {
      next(error);
    }
  },

  create: async (req, res, next) => {
    try {
      if (!req.body.prospectId) {
        return errorResponse(res, 'A lead must belong to a prospect', 422);
      }
      const prospect = await Prospect.findByPk(req.body.prospectId);
      if (!prospect) return errorResponse(res, 'Prospect not found', 422);

      // Default the stage to the first one rather than leaving the lead
      // stage-less, which would hide it from the kanban board.
      let stageId = req.body.stageId;
      if (!stageId) {
        const first = await CrmStage.findOne({
          where: { kind: 'lead', isActive: true }, order: [['sequence', 'ASC']],
        });
        stageId = first ? first.id : null;
      }

      const lead = await Lead.create({
        // Contact details fall back to the prospect's, so a lead raised from
        // the prospect screen is already complete.
        contactName: prospect.contactName,
        designation: prospect.designation,
        department: prospect.department,
        email: prospect.email,
        phone: prospect.phone,
        mobile: prospect.mobile,
        street: prospect.street1,
        city: prospect.city,
        country: prospect.country,
        assignedTo: prospect.assignedTo,
        salesTeamId: prospect.salesTeamId,
        ...req.body,
        stageId,
        leadNumber: req.body.leadNumber || (await nextLeadNumber()),
        companyId: req.body.companyId || defaultCompanyId(req),
        createdBy: req.user ? req.user.id : null,
      });

      const fresh = await Lead.findByPk(lead.id, { include: leadInclude });
      return successResponse(res, fresh, 'Lead created', 201);
    } catch (error) {
      next(error);
    }
  },

  update: async (req, res, next) => {
    try {
      const lead = await Lead.findByPk(req.params.id);
      if (!lead) return errorResponse(res, 'Lead not found', 404);
      if (lead.status === 'converted' && req.body.stageId && req.body.stageId !== lead.stageId) {
        return errorResponse(
          res,
          'This lead has been converted to an opportunity; move the opportunity instead',
          409,
        );
      }
      const payload = { ...req.body };
      delete payload.id;
      delete payload.opportunityId;
      delete payload.status;
      await lead.update(payload);
      const fresh = await Lead.findByPk(lead.id, { include: leadInclude });
      return successResponse(res, fresh, 'Lead updated');
    } catch (error) {
      next(error);
    }
  },

  remove: async (req, res, next) => {
    try {
      const lead = await Lead.findByPk(req.params.id);
      if (!lead) return errorResponse(res, 'Lead not found', 404);
      if (lead.opportunityId) {
        return errorResponse(
          res,
          'This lead produced an opportunity and cannot be deleted. Mark it lost instead.',
          409,
        );
      }
      await lead.destroy();
      return successResponse(res, null, 'Lead deleted');
    } catch (error) {
      next(error);
    }
  },

  // Move a lead along the pipeline. The target stage decides what becomes
  // possible next, which is why it is re-read here rather than trusted.
  setStage: async (req, res, next) => {
    try {
      const lead = await Lead.findByPk(req.params.id);
      if (!lead) return errorResponse(res, 'Lead not found', 404);
      const stage = await CrmStage.findOne({ where: { id: req.body.stageId, kind: 'lead' } });
      if (!stage) return errorResponse(res, 'Lead stage not found', 422);

      const patch = { stageId: stage.id };
      if (stage.isLost) {
        patch.status = 'lost';
        patch.lostReason = req.body.lostReason || lead.lostReason || 'Marked unqualified';
      } else if (lead.status === 'lost') {
        patch.status = 'open';
        patch.lostReason = null;
      }
      await lead.update(patch);
      const fresh = await Lead.findByPk(lead.id, { include: leadInclude });
      return successResponse(res, { ...fresh.toJSON(), actions: leadActions(fresh) }, 'Lead stage updated');
    } catch (error) {
      next(error);
    }
  },

  // The gate: only a stage flagged `isCreateOpportunity` may be promoted, and
  // only once. Everything the lane carries is copied across so the
  // opportunity opens pre-filled.
  convertToOpportunity: async (req, res, next) => {
    try {
      const lead = await Lead.findByPk(req.params.id, {
        include: [{ model: CrmStage, as: 'stage' }, { model: Prospect, as: 'prospect' }],
      });
      if (!lead) return errorResponse(res, 'Lead not found', 404);
      if (lead.opportunityId) {
        return errorResponse(res, 'This lead has already been converted to an opportunity', 409);
      }
      if (!lead.stage || !lead.stage.isCreateOpportunity) {
        return errorResponse(
          res,
          'Move this lead to a stage that allows opportunity creation first',
          409,
        );
      }

      const firstStage = await CrmStage.findOne({
        where: { kind: 'opportunity', isActive: true }, order: [['sequence', 'ASC']],
      });
      const prospect = lead.prospect;

      const opportunity = await Opportunity.create({
        name: lead.name,
        customerId: prospect && prospect.relatedPartnerId ? prospect.relatedPartnerId : null,
        contactName: lead.contactName,
        contactEmail: lead.email,
        contactPhone: lead.phone || lead.mobile,
        contactDesignation: lead.designation,
        contactDepartment: lead.department,
        stage: 'new',
        stageId: firstStage ? firstStage.id : null,
        leadId: lead.id,
        prospectId: lead.prospectId,
        isCreateFromLead: true,
        opportunityType: prospect && prospect.relatedPartnerId ? 'existing' : 'new',
        opportunityFor: 'shipment',
        opportunitySource: lead.leadSource === 'inbound' ? 'online' : 'offline',
        transportMode: lead.transportMode === 'MULTIMODAL' ? null : lead.transportMode,
        shipmentType: lead.shipmentType,
        direction: lead.direction,
        commodity: lead.commodity,
        origin: lead.pickupLocation || lead.originCountry,
        destination: lead.deliveryLocation || lead.destinationCountry,
        originCountry: lead.originCountry,
        destinationCountry: lead.destinationCountry,
        portOfLoadingId: lead.portOfLoadingId,
        portOfDischargeId: lead.portOfDischargeId,
        pickupLocationType: lead.pickupLocationType,
        deliveryLocationType: lead.deliveryLocationType,
        estimatedRevenue: lead.expectedAnnualRevenue,
        expectedCloseDate: lead.targetDate,
        probability: lead.leadCategory === 'hot' ? 70 : (lead.leadCategory === 'warm' ? 40 : 20),
        priority: lead.leadCategory === 'hot' ? 'high' : (lead.leadCategory === 'cold' ? 'low' : 'normal'),
        salesTeamId: lead.salesTeamId,
        assignedTo: lead.assignedTo,
        createdBy: req.user ? req.user.id : null,
        companyId: lead.companyId || defaultCompanyId(req),
        notes: [lead.notes, lead.remarks].filter(Boolean).join('\n'),
        ...(req.body || {}),
      });

      await lead.update({
        opportunityId: opportunity.id,
        status: 'converted',
        convertedAt: new Date(),
      });

      return successResponse(
        res, { lead: await Lead.findByPk(lead.id, { include: leadInclude }), opportunity },
        'Lead converted to an opportunity', 201,
      );
    } catch (error) {
      next(error);
    }
  },

  // Kanban payload: one column per stage with its leads and column totals.
  kanban: async (req, res, next) => {
    try {
      const where = { ...companyWhere(req) };
      if (req.query.assignedTo) where.assignedTo = req.query.assignedTo;
      if (req.query.salesTeamId) where.salesTeamId = req.query.salesTeamId;

      const [stageRows, leadRows] = await Promise.all([
        CrmStage.findAll({ where: { kind: 'lead', isActive: true }, order: [['sequence', 'ASC']] }),
        Lead.findAll({ where, include: leadInclude, order: [['date', 'DESC']] }),
      ]);

      const columns = stageRows.map((s) => {
        const items = leadRows.filter((l) => l.stageId === s.id);
        return {
          stage: s,
          count: items.length,
          expectedRevenue: Number(
            items.reduce((sum, l) => sum + num(l.expectedAnnualRevenue), 0).toFixed(2),
          ),
          leads: items,
        };
      });
      const unstaged = leadRows.filter((l) => !l.stageId);
      if (unstaged.length) {
        columns.push({
          stage: { id: null, name: 'Unstaged', sequence: 999 },
          count: unstaged.length,
          expectedRevenue: Number(
            unstaged.reduce((sum, l) => sum + num(l.expectedAnnualRevenue), 0).toFixed(2),
          ),
          leads: unstaged,
        });
      }
      return successResponse(res, columns, 'Lead pipeline retrieved');
    } catch (error) {
      next(error);
    }
  },
};

const leadActions = (lead) => ({
  edit: lead.status !== 'converted',
  setStage: lead.status !== 'converted',
  convertToOpportunity: lead.status === 'open'
    && !lead.opportunityId
    && !!(lead.stage && lead.stage.isCreateOpportunity),
  openOpportunity: !!lead.opportunityId,
  markLost: lead.status === 'open',
  reopen: lead.status === 'lost',
  delete: !lead.opportunityId,
});

const nextLeadNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `LEAD/${year}/`;
  const last = await Lead.findOne({
    where: { leadNumber: { [Op.like]: `${prefix}%` } },
    order: [['leadNumber', 'DESC']],
    attributes: ['leadNumber'],
  });
  const n = last ? parseInt(String(last.leadNumber).split('/').pop(), 10) + 1 : 1;
  return `${prefix}${String(n).padStart(5, '0')}`;
};

// --- pipeline dashboard -----------------------------------------------------
// Sales & CRM > Sales Strategy > Dashboard. One call, because the page shows
// the funnel, the team split and the target progress together.
const dashboard = async (req, res, next) => {
  try {
    const where = { ...companyWhere(req) };
    if (req.query.salesTeamId) where.salesTeamId = req.query.salesTeamId;
    if (req.query.assignedTo) where.assignedTo = req.query.assignedTo;

    const [
      prospectCount, leadTotals, oppStageRows, targetRows, teamRows, wonQuotes,
    ] = await Promise.all([
      Prospect.count({ where: { isActive: true } }),
      Lead.findAll({
        where,
        attributes: [
          'status',
          [fn('COUNT', col('id')), 'count'],
          [fn('SUM', col('expectedAnnualRevenue')), 'revenue'],
        ],
        group: ['status'],
        raw: true,
      }),
      Opportunity.findAll({
        attributes: [
          'stage',
          [fn('COUNT', col('id')), 'count'],
          [fn('SUM', col('estimatedRevenue')), 'revenue'],
        ],
        group: ['stage'],
        raw: true,
      }),
      SalesTarget.findAll({
        where: { isActive: true },
        include: [{ model: User, as: 'salesperson', attributes: ['id', 'name'] }],
        order: [['dateFrom', 'DESC']],
        limit: 12,
      }),
      SalesTeam.findAll({ where: { isActive: true }, order: [['sequence', 'ASC']] }),
      Quotation.findAll({
        attributes: [
          'status',
          [fn('COUNT', col('id')), 'count'],
          [fn('SUM', col('estimatedRevenue')), 'revenue'],
          [fn('SUM', col('estimatedMargin')), 'margin'],
        ],
        group: ['status'],
        raw: true,
      }),
    ]);

    const asMap = (rows, key) => rows.reduce((acc, r) => {
      acc[r[key] || 'unknown'] = {
        count: Number(r.count) || 0,
        revenue: Number(r.revenue) || 0,
        margin: r.margin != null ? Number(r.margin) : undefined,
      };
      return acc;
    }, {});

    const leadsByStatus = asMap(leadTotals, 'status');
    const quotesByStatus = asMap(wonQuotes, 'status');
    const openLeads = leadsByStatus.open ? leadsByStatus.open.count : 0;
    const convertedLeads = leadsByStatus.converted ? leadsByStatus.converted.count : 0;

    // Funnel conversion is only meaningful where the stage below it has
    // records, so each rate guards its own denominator.
    const totalLeads = Object.values(leadsByStatus).reduce((s, v) => s + v.count, 0);
    const totalOpps = Object.values(asMap(oppStageRows, 'stage')).reduce((s, v) => s + v.count, 0);
    const totalQuotes = Object.values(quotesByStatus).reduce((s, v) => s + v.count, 0);

    return successResponse(res, {
      funnel: {
        prospects: prospectCount,
        leads: totalLeads,
        opportunities: totalOpps,
        quotations: totalQuotes,
        leadToOpportunityRate: totalLeads ? Number(((convertedLeads / totalLeads) * 100).toFixed(2)) : 0,
        openLeads,
      },
      leadsByStatus,
      opportunitiesByStage: asMap(oppStageRows, 'stage'),
      quotationsByStatus: quotesByStatus,
      targets: targetRows,
      teams: teamRows,
    }, 'Sales dashboard retrieved');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  stages, teams, templates, prospects, targets, leads, dashboard,
  computeAchieved, nextLeadNumber,
};
