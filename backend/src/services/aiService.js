const { Op } = require('sequelize');
const {
  FFJob, Consolidation, CFSReceipt, CFSDelivery,
  Organization, Invoice, Quotation,
} = require('../models');
const provider = require('./aiProvider');

// The model provider (Gemini or Claude) is selected in aiProvider from whichever
// key is present. Keys are read from the environment so they never land in the
// repo; without one the AI routes report "not configured" rather than failing
// at import time.
const isConfigured = () => provider.isConfigured();

const SYSTEM_PROMPT = `You are the CargoFlo assistant — an operations copilot embedded in a freight-forwarding ERP.

You help operations, sales, and finance staff understand and act on live data: house shipments,
master shipments, export consolidations, CFS receive/delivery entries, organizations (customers,
shippers, consignees, carriers, agents), quotations, invoices, opportunities, and service jobs.

How to work:
- Reach for a tool whenever the answer depends on live data. Do not answer operational questions
  from memory or guesswork — query, then answer from what you got back.
- Prefer one well-scoped query over several broad ones. Use the filters the tools expose.
- Reference records by their business number (SEA-E-LCL-H-N-2026-01843, CNSL-2024-00022, A-74: admin),
  not internal UUIDs, unless the user asks for the id.
- Money is AED unless a record says otherwise. Always name the currency.

Writing:
- Lead with the answer. Supporting detail after.
- Keep it brief. Use a short table when comparing several records; prose otherwise.
- If a query returns nothing, say so plainly and suggest what filter to loosen.

Mutations:
- create_* and update_* tools change real records. Before calling one, state exactly what you are
  about to change and ask the user to confirm — unless they have already confirmed that specific
  change in this conversation.`;

// ─── Read tools ──────────────────────────────────────────────────────────────
// Each maps to a Sequelize query. Descriptions are prescriptive about *when* to
// call, which measurably improves tool selection.

const READ_TOOLS = [
  {
    name: 'query_house_shipments',
    description: 'Search house shipments (the core freight job record). Call this for any question about shipments, jobs, bookings, HBLs, routes, shipment status, or shipment revenue/cost. Returns job number, route, parties, status, and financials.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by workflow state: created, booked, received, confirmed, nomination_generated, hbl_generated, hawb_generated, in_transit, arrived, completed, accounting_closure, cancelled' },
        transportMode: { type: 'string', description: 'SEA, AIR, ROAD, or RAIL' },
        direction: { type: 'string', description: 'EXPORT, IMPORT, or LOCAL' },
        search: { type: 'string', description: 'Free-text match on job number, HBL number, origin, or destination' },
        limit: { type: 'integer', description: 'Max rows (default 25, max 100)' },
      },
    },
  },
  {
    name: 'query_organizations',
    description: 'Search the partner master — customers, shippers, consignees, carriers, agents. Call this for questions about who a party is, their contact details, country, VAT/identification number, credit limit, or payment terms.',
    input_schema: {
      type: 'object',
      properties: {
        companyType: { type: 'string', description: 'person (Individual) or company' },
        country: { type: 'string' },
        search: { type: 'string', description: 'Free-text match on name, email, phone, customer code, or VAT' },
        limit: { type: 'integer' },
      },
    },
  },
  {
    name: 'query_consolidations',
    description: 'Search export console generations (consolidations grouping multiple house shipments under one MBL). Call this for questions about consolidations, MBLs, or which houses are grouped together.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'draft, confirmed, in_transit, arrived, completed, cancelled' },
        search: { type: 'string', description: 'Match on consolidation number or MBL number' },
        limit: { type: 'integer' },
      },
    },
  },
  {
    name: 'query_cfs',
    description: 'Search CFS receive entries or delivery entries (container freight station gate-in / gate-out records). Call this for warehouse, CFS, stuffing, or gate movement questions.',
    input_schema: {
      type: 'object',
      properties: {
        kind: { type: 'string', description: 'receipt or delivery', enum: ['receipt', 'delivery'] },
        status: { type: 'string' },
        search: { type: 'string' },
        limit: { type: 'integer' },
      },
      required: ['kind'],
    },
  },
  {
    name: 'query_financials',
    description: 'Search invoices or quotations. Call this for billing, revenue, outstanding balance, or quote questions.',
    input_schema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['invoice', 'quotation'] },
        status: { type: 'string' },
        search: { type: 'string' },
        limit: { type: 'integer' },
      },
      required: ['kind'],
    },
  },
  {
    name: 'aggregate_shipments',
    description: 'Group and count/sum house shipments. Call this instead of query_house_shipments when the user asks "how many", "total", "breakdown by", "top N", or wants a distribution rather than a list of records.',
    input_schema: {
      type: 'object',
      properties: {
        groupBy: { type: 'string', description: 'Field to group by', enum: ['status', 'transportMode', 'direction', 'cargoType', 'origin', 'destination'] },
        metric: { type: 'string', description: 'count, revenue, or cost', enum: ['count', 'revenue', 'cost'] },
      },
      required: ['groupBy'],
    },
  },
];

// ─── Write tools ─────────────────────────────────────────────────────────────
// Gated: the model is instructed to confirm first, and the executor additionally
// refuses unless the request carries allowWrites.

const WRITE_TOOLS = [
  {
    name: 'update_shipment_status',
    description: 'Change a house shipment\'s workflow status. Destructive — confirm the shipment number and target status with the user before calling.',
    input_schema: {
      type: 'object',
      properties: {
        jobNumber: { type: 'string', description: 'The house shipment job number, e.g. SEA-E-LCL-H-N-2026-01843' },
        status: { type: 'string', description: 'Target workflow state' },
      },
      required: ['jobNumber', 'status'],
    },
  },
  {
    name: 'create_organization',
    description: 'Create a new organization (customer, shipper, consignee, carrier, or agent). Confirm the name and type with the user before calling.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        companyType: { type: 'string', enum: ['person', 'company'] },
        email: { type: 'string' },
        phone: { type: 'string' },
        country: { type: 'string' },
        city: { type: 'string' },
      },
      required: ['name', 'companyType'],
    },
  },
];

const clamp = (n, def = 25) => Math.min(Math.max(parseInt(n, 10) || def, 1), 100);

const like = (fields, term) => ({ [Op.or]: fields.map((f) => ({ [f]: { [Op.like]: `%${term}%` } })) });

// Executes a tool call against the database and returns a plain-JS result the
// model can read. Throws are caught by the caller and returned as is_error.
const executeTool = async (name, input = {}, { allowWrites = false } = {}) => {
  const limit = clamp(input.limit);

  switch (name) {
    case 'query_house_shipments': {
      const where = {};
      if (input.status) where.status = input.status;
      if (input.transportMode) where.transportMode = input.transportMode;
      if (input.direction) where.direction = input.direction;
      if (input.search) Object.assign(where, like(['jobNumber', 'hblNumber', 'origin', 'destination'], input.search));
      const rows = await FFJob.findAll({ where, limit, order: [['createdAt', 'DESC']] });
      return rows.map((r) => {
        // Money lives in one JSON column on FFJob.
        const money = r.revenue || {};
        return {
          jobNumber: r.jobNumber, hbl: r.hblNumber, mbl: r.mblNumber, status: r.status,
          mode: r.transportMode, direction: r.direction, cargoType: r.cargoType,
          route: [r.origin, r.destination].filter(Boolean).join(' → ') || null,
          etd: r.etd, eta: r.eta, carrier: r.carrier, vessel: r.vesselName,
          estimatedRevenue: money.estReceivable ?? 0,
          estimatedCost: money.estPayable ?? 0,
          estimatedMargin: money.estMargin ?? 0,
        };
      });
    }

    case 'query_organizations': {
      const where = { parentId: null };
      if (input.companyType) where.companyType = input.companyType;
      if (input.country) where.country = input.country;
      if (input.search) Object.assign(where, like(['name', 'email', 'phone', 'customerCode', 'vat'], input.search));
      const rows = await Organization.findAll({ where, limit });
      return rows.map((r) => ({
        code: r.customerCode, name: r.name, type: r.companyType,
        email: r.email, phone: r.phone, city: r.city, country: r.country,
        vat: r.vat, approvedCreditLimit: r.approvedCreditLimit, paymentTerms: r.paymentTerms,
      }));
    }

    case 'query_consolidations': {
      const where = {};
      if (input.status) where.status = input.status;
      if (input.search) Object.assign(where, like(['consolidationNumber', 'mblNumber'], input.search));
      const rows = await Consolidation.findAll({ where, limit, order: [['createdAt', 'DESC']] });
      return rows.map((r) => ({
        consolidationNumber: r.consolidationNumber, mbl: r.mblNumber, status: r.status,
        agent: r.carrier, mode: r.transportMode,
        houseCount: (r.houseShipmentIds || []).length,
      }));
    }

    case 'query_cfs': {
      const Model = input.kind === 'delivery' ? CFSDelivery : CFSReceipt;
      const where = {};
      if (input.status) where.status = input.status;
      const numberField = input.kind === 'delivery' ? 'deliveryNumber' : 'receiptNumber';
      if (input.search) Object.assign(where, like([numberField, 'cfsLocation'], input.search));
      const rows = await Model.findAll({ where, limit, order: [['createdAt', 'DESC']] });
      return rows.map((r) => ({
        number: r[numberField], status: r.status, cfs: r.cfsLocation,
        date: r.gateInDate || r.gateOutDate, mode: r.transportMode, cargoType: r.cargoType,
      }));
    }

    case 'query_financials': {
      const Model = input.kind === 'quotation' ? Quotation : Invoice;
      const where = {};
      if (input.status) where.status = input.status;
      const rows = await Model.findAll({ where, limit, order: [['createdAt', 'DESC']] });
      return rows.map((r) => r.toJSON());
    }

    case 'aggregate_shipments': {
      const metric = input.metric || 'count';
      // Revenue/cost live inside a JSON column, so sum in JS rather than SQL.
      const rows = await FFJob.findAll({
        attributes: [input.groupBy, 'revenue'],
        raw: true,
      });
      const totals = {};
      for (const r of rows) {
        const key = r[input.groupBy] || '(none)';
        const money = r.revenue || {};
        const add = metric === 'count' ? 1
          : Number((metric === 'revenue' ? money.estReceivable : money.estPayable) || 0);
        totals[key] = (totals[key] || 0) + add;
      }
      return {
        metric,
        groupBy: input.groupBy,
        rows: Object.entries(totals)
          .map(([group, value]) => ({ group, value: Math.round(value * 100) / 100 }))
          .sort((a, b) => b.value - a.value),
      };
    }

    case 'update_shipment_status': {
      if (!allowWrites) return { refused: 'Writes are disabled for this request. Ask the user to confirm, then retry with writes enabled.' };
      const job = await FFJob.findOne({ where: { jobNumber: input.jobNumber } });
      if (!job) return { error: `No house shipment found with job number ${input.jobNumber}` };
      const before = job.status;
      await job.update({ status: input.status });
      return { jobNumber: job.jobNumber, statusBefore: before, statusAfter: job.status };
    }

    case 'create_organization': {
      if (!allowWrites) return { refused: 'Writes are disabled for this request. Ask the user to confirm, then retry with writes enabled.' };
      const org = await Organization.create({
        name: input.name,
        companyType: input.companyType,
        email: input.email || null,
        phone: input.phone || null,
        country: input.country || null,
        city: input.city || null,
        companyName: input.companyType === 'company' ? input.name : null,
      });
      return { id: org.id, name: org.name, customerCode: org.customerCode, created: true };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
};

// The provider runs the agentic loop; this layer owns the tool surface and the
// allowWrites gate, so mutations stay off unless the caller opted in.
const chat = async ({ messages, allowWrites = false, maxIterations = 8 }) => provider.runAgentLoop({
  system: SYSTEM_PROMPT,
  tools: [...READ_TOOLS, ...WRITE_TOOLS],
  messages,
  maxIterations,
  execute: (name, input) => executeTool(name, input, { allowWrites }),
});

module.exports = {
  chat,
  executeTool,
  isConfigured,
  activeModel: provider.activeModel,
  providerName: provider.providerName,
  READ_TOOLS,
  WRITE_TOOLS,
};
