// Operations, Sales & CRM and ETL reports.
//
// Merged into the accounting report engine, so every one of them renders in
// the existing ReportView screen as { columns, rows, totals } with no new
// front-end component. Each report declares the ACL model it reads, and the
// route checks that rather than one blanket permission, so an operations user
// can read shipment reports without holding invoice rights.
//
// Money comes from charge lines (estimated) and from what has been invoiced
// out and billed in (actual). Every figure is in company currency, because
// charge lines store their converted totals.

const { Op } = require('sequelize');

const round = (v, dp = 2) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  const f = 10 ** dp;
  return Math.round((n + Number.EPSILON) * f) / f;
};
const sum = (rows, key) => round(rows.reduce((s, r) => s + (Number(r[key]) || 0), 0));
const pct = (part, whole) => (Number(whole) ? round((Number(part) / Number(whole)) * 100) : 0);

// The date a shipment is reported under: when it moved if known, else when it
// was due to move, else when it was opened.
const jobDate = (j) => j.shipmentDate || j.etd || j.createdAt;
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const month = (d) => (d ? new Date(d).toISOString().slice(0, 7) : 'Undated');

const inWindow = (ctx, d) => {
  const v = day(d);
  if (!v) return !ctx.dateFrom && !ctx.dateTo;
  if (ctx.dateFrom && v < ctx.dateFrom) return false;
  if (ctx.dateTo && v > ctx.dateTo) return false;
  return true;
};

// ponytail: one TEU per container, because containers here are stored as bare
// numbers with no size. Read the size from the container master once it
// carries one, and count 40ft/45ft boxes as two.
const teuOf = (j) => (Array.isArray(j.containerNumbers) ? j.containerNumbers.length : 0);

const MONEY = { align: 'right', type: 'money' };
const NUM = { align: 'right' };

/** Shipments in the report window, with party and owner names resolved. */
const loadJobs = async (ctx, where = {}) => {
  const { FFJob } = ctx.models;
  const jobs = await FFJob.findAll({ where, order: [['createdAt', 'DESC']] });
  return jobs.map((j) => j.toJSON()).filter((j) => inWindow(ctx, jobDate(j)));
};

/**
 * Names for every id a shipment or charge can carry. Customers, shippers and
 * consignees live in `customers`; vendors on charge lines live in
 * `organizations`; owners in `users`. Ids are UUIDs, so one merged map is safe.
 */
const nameMap = async (ctx) => {
  const { Customer, Organization, User } = ctx.models;
  const [customers, orgs, users] = await Promise.all([
    Customer.findAll({ attributes: ['id', 'companyName', 'contactName'], raw: true }),
    Organization.findAll({ attributes: ['id', 'name', 'companyName'], raw: true }),
    User.findAll({ attributes: ['id', 'name', 'email'], raw: true }),
  ]);
  const m = new Map();
  customers.forEach((c) => m.set(c.id, c.companyName || c.contactName));
  orgs.forEach((o) => m.set(o.id, o.companyName || o.name));
  users.forEach((u) => m.set(u.id, u.name || u.email));
  return (id, fallback = 'Unassigned') => (id && m.get(id)) || fallback;
};

/** Charge lines for a set of parents, grouped by parent id. */
const chargesByParent = async (ctx, parentType, ids) => {
  if (!ids.length) return new Map();
  const { ChargeLine } = ctx.models;
  const lines = await ChargeLine.findAll({
    where: { parentType, parentId: { [Op.in]: ids }, isActive: true },
    raw: true,
  });
  const out = new Map();
  for (const l of lines) {
    if (!out.has(l.parentId)) out.set(l.parentId, []);
    out.get(l.parentId).push(l);
  }
  return out;
};

const lane = (j) => `${j.originCountry || j.origin || '?'} to ${j.destinationCountry || j.destination || '?'}`;

/** Group rows by a key and fold each group with an accumulator. */
const groupBy = (items, keyFn, init, fold) => {
  const m = new Map();
  for (const it of items) {
    const k = keyFn(it);
    if (!m.has(k)) m.set(k, init(k, it));
    fold(m.get(k), it);
  }
  return [...m.values()];
};

// ---------------------------------------------------------------------------
// Operations > Reporting
// ---------------------------------------------------------------------------

const shipmentProfit = async (ctx) => {
  const name = await nameMap(ctx);
  const jobs = await loadJobs(ctx);
  const rows = jobs.map((j) => ({
    job: j.jobNumber,
    date: day(jobDate(j)),
    customer: name(j.customerId),
    mode: j.transportMode,
    type: j.cargoType,
    lane: lane(j),
    chargeableWeight: round(j.chargeableWeight, 3),
    estRevenue: round(j.estimatedRevenue),
    estCost: round(j.estimatedCost),
    estMargin: round(j.estimatedMargin),
    estMarginPct: round(j.estimatedMarginPercentage),
    actRevenue: round(j.receivedRevenue),
    actCost: round(j.paidCost),
    actMargin: round(Number(j.receivedRevenue || 0) - Number(j.paidCost || 0)),
  }));
  const totals = {
    estRevenue: sum(rows, 'estRevenue'),
    estCost: sum(rows, 'estCost'),
    estMargin: sum(rows, 'estMargin'),
    actRevenue: sum(rows, 'actRevenue'),
    actCost: sum(rows, 'actCost'),
    actMargin: sum(rows, 'actMargin'),
  };
  totals.estMarginPct = pct(totals.estMargin, totals.estRevenue);
  return {
    columns: [
      { key: 'job', label: 'Shipment' },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'customer', label: 'Customer' },
      { key: 'mode', label: 'Mode' },
      { key: 'type', label: 'Type' },
      { key: 'lane', label: 'Lane' },
      { key: 'chargeableWeight', label: 'Chargeable Wt (kg)', ...NUM },
      { key: 'estRevenue', label: 'Est. Revenue', ...MONEY },
      { key: 'estCost', label: 'Est. Cost', ...MONEY },
      { key: 'estMargin', label: 'Est. Margin', ...MONEY },
      { key: 'estMarginPct', label: 'Margin %', ...NUM },
      { key: 'actRevenue', label: 'Invoiced', ...MONEY },
      { key: 'actCost', label: 'Billed', ...MONEY },
      { key: 'actMargin', label: 'Actual Margin', ...MONEY },
    ],
    rows,
    totals,
  };
};

/** Estimated against actual per charge, across every shipment in the window. */
const chargewiseEstimatedActual = async (ctx) => {
  const jobs = await loadJobs(ctx);
  const byParent = await chargesByParent(ctx, 'house_shipment', jobs.map((j) => j.id));
  const lines = [...byParent.values()].flat();
  const rows = groupBy(
    lines,
    (l) => l.chargeCode || l.chargeDescription,
    (k, l) => ({
      code: l.chargeCode || '-',
      charge: l.chargeDescription,
      estRevenue: 0, actRevenue: 0, estCost: 0, actCost: 0, shipments: new Set(),
    }),
    (acc, l) => {
      acc.shipments.add(l.parentId);
      if (l.side === 'revenue' || l.side === 'both') {
        acc.estRevenue += Number(l.totalSellAmountIncl) || Number(l.totalSellAmount) || 0;
        acc.actRevenue += Number(l.invoicedAmount) || 0;
      }
      if (l.side === 'cost' || l.side === 'both') {
        acc.estCost += Number(l.totalCostAmountIncl) || Number(l.totalCostAmount) || 0;
        acc.actCost += Number(l.billedAmount) || 0;
      }
    },
  ).map((r) => ({
    code: r.code,
    charge: r.charge,
    shipments: r.shipments.size,
    estRevenue: round(r.estRevenue),
    actRevenue: round(r.actRevenue),
    revenueVariance: round(r.actRevenue - r.estRevenue),
    estCost: round(r.estCost),
    actCost: round(r.actCost),
    costVariance: round(r.actCost - r.estCost),
  })).sort((a, b) => b.estRevenue - a.estRevenue);

  return {
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'charge', label: 'Charge' },
      { key: 'shipments', label: 'Shipments', ...NUM },
      { key: 'estRevenue', label: 'Est. Revenue', ...MONEY },
      { key: 'actRevenue', label: 'Act. Revenue', ...MONEY },
      { key: 'revenueVariance', label: 'Revenue Var.', ...MONEY },
      { key: 'estCost', label: 'Est. Cost', ...MONEY },
      { key: 'actCost', label: 'Act. Cost', ...MONEY },
      { key: 'costVariance', label: 'Cost Var.', ...MONEY },
    ],
    rows,
    totals: Object.fromEntries(
      ['estRevenue', 'actRevenue', 'revenueVariance', 'estCost', 'actCost', 'costVariance']
        .map((k) => [k, sum(rows, k)]),
    ),
  };
};

/** One row per party, built from whichever party field `pick` selects. */
const partyReport = (pick, partyLabel) => async (ctx) => {
  const name = await nameMap(ctx);
  const jobs = await loadJobs(ctx);
  const rows = groupBy(
    jobs,
    (j) => pick(j) || 'none',
    (k) => ({
      party: k === 'none' ? 'Not set' : name(k),
      shipments: 0, sea: 0, air: 0, road: 0, other: 0,
      grossWeight: 0, volume: 0, teu: 0, revenue: 0, cost: 0, margin: 0,
    }),
    (acc, j) => {
      acc.shipments += 1;
      const m = String(j.transportMode || '').toUpperCase();
      if (m === 'SEA') acc.sea += 1;
      else if (m === 'AIR' || m === 'COURIER') acc.air += 1;
      else if (m === 'ROAD') acc.road += 1;
      else acc.other += 1;
      acc.grossWeight += Number(j.grossWeight) || 0;
      acc.volume += Number(j.volume) || 0;
      acc.teu += teuOf(j);
      acc.revenue += Number(j.estimatedRevenue) || 0;
      acc.cost += Number(j.estimatedCost) || 0;
      acc.margin += Number(j.estimatedMargin) || 0;
    },
  ).map((r) => ({
    ...r,
    grossWeight: round(r.grossWeight, 3),
    volume: round(r.volume, 3),
    revenue: round(r.revenue),
    cost: round(r.cost),
    margin: round(r.margin),
    marginPct: pct(r.margin, r.revenue),
  })).sort((a, b) => b.revenue - a.revenue);

  return {
    columns: [
      { key: 'party', label: partyLabel },
      { key: 'shipments', label: 'Shipments', ...NUM },
      { key: 'sea', label: 'Sea', ...NUM },
      { key: 'air', label: 'Air', ...NUM },
      { key: 'road', label: 'Road', ...NUM },
      { key: 'grossWeight', label: 'Gross Wt (kg)', ...NUM },
      { key: 'volume', label: 'Volume (m3)', ...NUM },
      { key: 'teu', label: 'TEU', ...NUM },
      { key: 'revenue', label: 'Revenue', ...MONEY },
      { key: 'cost', label: 'Cost', ...MONEY },
      { key: 'margin', label: 'Margin', ...MONEY },
      { key: 'marginPct', label: 'Margin %', ...NUM },
    ],
    rows,
    totals: Object.fromEntries(
      ['shipments', 'sea', 'air', 'road', 'grossWeight', 'volume', 'teu', 'revenue', 'cost', 'margin']
        .map((k) => [k, sum(rows, k)]),
    ),
  };
};

/** Shipment volume per customer per month - the trend a sales review reads. */
const customerVolume = async (ctx) => {
  const name = await nameMap(ctx);
  const jobs = await loadJobs(ctx);
  const rows = groupBy(
    jobs,
    (j) => `${j.customerId || 'none'}|${month(jobDate(j))}`,
    (k, j) => ({
      customer: name(j.customerId, 'Not set'),
      month: month(jobDate(j)),
      shipments: 0, grossWeight: 0, chargeableWeight: 0, volume: 0, teu: 0,
    }),
    (acc, j) => {
      acc.shipments += 1;
      acc.grossWeight += Number(j.grossWeight) || 0;
      acc.chargeableWeight += Number(j.chargeableWeight) || 0;
      acc.volume += Number(j.volume) || 0;
      acc.teu += teuOf(j);
    },
  ).map((r) => ({
    ...r,
    grossWeight: round(r.grossWeight, 3),
    chargeableWeight: round(r.chargeableWeight, 3),
    volume: round(r.volume, 3),
  })).sort((a, b) => a.customer.localeCompare(b.customer) || a.month.localeCompare(b.month));

  return {
    columns: [
      { key: 'customer', label: 'Customer' },
      { key: 'month', label: 'Month' },
      { key: 'shipments', label: 'Shipments', ...NUM },
      { key: 'grossWeight', label: 'Gross Wt (kg)', ...NUM },
      { key: 'chargeableWeight', label: 'Chargeable Wt (kg)', ...NUM },
      { key: 'volume', label: 'Volume (m3)', ...NUM },
      { key: 'teu', label: 'TEU', ...NUM },
    ],
    rows,
    totals: Object.fromEntries(
      ['shipments', 'grossWeight', 'chargeableWeight', 'volume', 'teu'].map((k) => [k, sum(rows, k)]),
    ),
  };
};

// Shipment statuses folded into the stages a customer service desk reports on.
const STATUS_BUCKET = {
  created: 'open', booked: 'open', confirmed: 'open', nomination_generated: 'open',
  received: 'open', hbl_generated: 'open', hawb_generated: 'open',
  in_transit: 'inTransit',
  arrived: 'arrived',
  completed: 'delivered', delivered: 'delivered', accounting_closure: 'closed',
  cancelled: 'cancelled',
};

const customerStatus = async (ctx) => {
  const name = await nameMap(ctx);
  const jobs = await loadJobs(ctx);
  const rows = groupBy(
    jobs,
    (j) => j.customerId || 'none',
    (k) => ({
      customer: k === 'none' ? 'Not set' : name(k),
      total: 0, open: 0, inTransit: 0, arrived: 0, delivered: 0, closed: 0, cancelled: 0,
    }),
    (acc, j) => {
      acc.total += 1;
      const b = STATUS_BUCKET[j.status] || 'open';
      acc[b] += 1;
    },
  ).sort((a, b) => b.total - a.total);
  return {
    columns: [
      { key: 'customer', label: 'Customer' },
      { key: 'total', label: 'Shipments', ...NUM },
      { key: 'open', label: 'Open', ...NUM },
      { key: 'inTransit', label: 'In Transit', ...NUM },
      { key: 'arrived', label: 'Arrived', ...NUM },
      { key: 'delivered', label: 'Delivered', ...NUM },
      { key: 'closed', label: 'Closed', ...NUM },
      { key: 'cancelled', label: 'Cancelled', ...NUM },
    ],
    rows,
    totals: Object.fromEntries(
      ['total', 'open', 'inTransit', 'arrived', 'delivered', 'closed', 'cancelled'].map((k) => [k, sum(rows, k)]),
    ),
  };
};

const salesByShippingLine = async (ctx) => {
  const jobs = await loadJobs(ctx);
  const rows = groupBy(
    jobs,
    (j) => j.carrier || 'Not set',
    (k) => ({ carrier: k, shipments: 0, teu: 0, chargeableWeight: 0, revenue: 0, cost: 0, margin: 0 }),
    (acc, j) => {
      acc.shipments += 1;
      acc.teu += teuOf(j);
      acc.chargeableWeight += Number(j.chargeableWeight) || 0;
      acc.revenue += Number(j.estimatedRevenue) || 0;
      acc.cost += Number(j.estimatedCost) || 0;
      acc.margin += Number(j.estimatedMargin) || 0;
    },
  ).map((r) => ({
    ...r,
    chargeableWeight: round(r.chargeableWeight, 3),
    revenue: round(r.revenue),
    cost: round(r.cost),
    margin: round(r.margin),
    marginPct: pct(r.margin, r.revenue),
  })).sort((a, b) => b.revenue - a.revenue);
  return {
    columns: [
      { key: 'carrier', label: 'Carrier / Shipping Line' },
      { key: 'shipments', label: 'Shipments', ...NUM },
      { key: 'teu', label: 'TEU', ...NUM },
      { key: 'chargeableWeight', label: 'Chargeable Wt (kg)', ...NUM },
      { key: 'revenue', label: 'Revenue', ...MONEY },
      { key: 'cost', label: 'Cost', ...MONEY },
      { key: 'margin', label: 'Margin', ...MONEY },
      { key: 'marginPct', label: 'Margin %', ...NUM },
    ],
    rows,
    totals: Object.fromEntries(
      ['shipments', 'teu', 'chargeableWeight', 'revenue', 'cost', 'margin'].map((k) => [k, sum(rows, k)]),
    ),
  };
};

/** Customs declarations raised on service jobs and house shipments. */
const customDuty = async (ctx) => {
  const { ServiceJob } = ctx.models;
  const name = await nameMap(ctx);
  const sjobs = (await ServiceJob.findAll({ where: { hasCustoms: true } }))
    .map((s) => s.toJSON())
    .filter((s) => inWindow(ctx, s.customsDeclarationDate || s.requestDate || s.createdAt));
  const jobs = (await loadJobs(ctx)).filter((j) => j.customs && Object.keys(j.customs).length);

  const rows = [
    ...sjobs.map((s) => ({
      reference: s.jobNumber,
      kind: 'Service job',
      customer: name(s.customerId),
      declaration: s.customsDeclarationNumber || '-',
      declarationDate: s.customsDeclarationDate,
      beType: s.customsBeType || '-',
      boe: s.boeNumber || '-',
      location: s.customsLocation || '-',
      cleared: s.customsClearanceDatetime ? day(s.customsClearanceDatetime) : 'Pending',
      clearanceRevenue: round(s.estimatedRevenue),
    })),
    ...jobs.map((j) => ({
      reference: j.jobNumber,
      kind: 'House shipment',
      customer: name(j.customerId),
      declaration: j.customs.declarationNumber || j.customs.billOfEntry || '-',
      declarationDate: j.customs.declarationDate || null,
      beType: j.customs.beType || '-',
      boe: j.customs.boeNumber || '-',
      location: j.customs.location || '-',
      cleared: j.customs.clearedAt ? day(j.customs.clearedAt) : 'Pending',
      clearanceRevenue: 0,
    })),
  ];
  return {
    columns: [
      { key: 'reference', label: 'Reference' },
      { key: 'kind', label: 'Record' },
      { key: 'customer', label: 'Customer' },
      { key: 'declaration', label: 'Declaration No.' },
      { key: 'declarationDate', label: 'Declared', type: 'date' },
      { key: 'beType', label: 'BE Type' },
      { key: 'boe', label: 'Bill of Entry' },
      { key: 'location', label: 'Customs Location' },
      { key: 'cleared', label: 'Cleared' },
      { key: 'clearanceRevenue', label: 'Job Revenue', ...MONEY },
    ],
    rows,
    totals: { clearanceRevenue: sum(rows, 'clearanceRevenue') },
  };
};

// ---------------------------------------------------------------------------
// ETL > Reporting
// ---------------------------------------------------------------------------

/** Houses grouped under their master: what each consol carried and earned. */
const consolidatedHouseShipments = async (ctx) => {
  const { MasterShipment } = ctx.models;
  const name = await nameMap(ctx);
  const jobs = (await loadJobs(ctx)).filter((j) => j.masterShipmentId);
  const masters = new Map(
    (await MasterShipment.findAll({
      where: { id: { [Op.in]: [...new Set(jobs.map((j) => j.masterShipmentId))] } },
      raw: true,
    })).map((m) => [m.id, m]),
  );
  const rows = jobs.map((j) => {
    const m = masters.get(j.masterShipmentId) || {};
    return {
      master: m.masterShipmentNumber || '-',
      mbl: m.mblNumber || '-',
      house: j.jobNumber,
      hbl: j.hblNumber || j.hawbNumber || '-',
      customer: name(j.customerId),
      grossWeight: round(j.grossWeight, 3),
      volume: round(j.volume, 3),
      revenue: round(j.estimatedRevenue),
      cost: round(j.estimatedCost),
      margin: round(j.estimatedMargin),
    };
  }).sort((a, b) => a.master.localeCompare(b.master));
  return {
    columns: [
      { key: 'master', label: 'Master Shipment' },
      { key: 'mbl', label: 'MBL' },
      { key: 'house', label: 'House Shipment' },
      { key: 'hbl', label: 'HBL / HAWB' },
      { key: 'customer', label: 'Customer' },
      { key: 'grossWeight', label: 'Gross Wt (kg)', ...NUM },
      { key: 'volume', label: 'Volume (m3)', ...NUM },
      { key: 'revenue', label: 'Revenue', ...MONEY },
      { key: 'cost', label: 'Cost', ...MONEY },
      { key: 'margin', label: 'Margin', ...MONEY },
    ],
    rows,
    totals: Object.fromEntries(
      ['grossWeight', 'volume', 'revenue', 'cost', 'margin'].map((k) => [k, sum(rows, k)]),
    ),
  };
};

/** The pivot: mode by direction by month. */
const shipmentAnalysis = async (ctx) => {
  const jobs = await loadJobs(ctx);
  const rows = groupBy(
    jobs,
    (j) => `${month(jobDate(j))}|${j.transportMode}|${j.direction}`,
    (k, j) => ({
      month: month(jobDate(j)),
      mode: j.transportMode || '-',
      direction: j.direction || '-',
      shipments: 0, chargeableWeight: 0, volume: 0, teu: 0, revenue: 0, margin: 0,
    }),
    (acc, j) => {
      acc.shipments += 1;
      acc.chargeableWeight += Number(j.chargeableWeight) || 0;
      acc.volume += Number(j.volume) || 0;
      acc.teu += teuOf(j);
      acc.revenue += Number(j.estimatedRevenue) || 0;
      acc.margin += Number(j.estimatedMargin) || 0;
    },
  ).map((r) => ({
    ...r,
    chargeableWeight: round(r.chargeableWeight, 3),
    volume: round(r.volume, 3),
    revenue: round(r.revenue),
    margin: round(r.margin),
  })).sort((a, b) => b.month.localeCompare(a.month) || a.mode.localeCompare(b.mode));
  return {
    columns: [
      { key: 'month', label: 'Month' },
      { key: 'mode', label: 'Mode' },
      { key: 'direction', label: 'Direction' },
      { key: 'shipments', label: 'Shipments', ...NUM },
      { key: 'chargeableWeight', label: 'Chargeable Wt (kg)', ...NUM },
      { key: 'volume', label: 'Volume (m3)', ...NUM },
      { key: 'teu', label: 'TEU', ...NUM },
      { key: 'revenue', label: 'Revenue', ...MONEY },
      { key: 'margin', label: 'Margin', ...MONEY },
    ],
    rows,
    totals: Object.fromEntries(
      ['shipments', 'chargeableWeight', 'volume', 'teu', 'revenue', 'margin'].map((k) => [k, sum(rows, k)]),
    ),
  };
};

const shipmentDocumentAnalysis = async (ctx) => {
  const name = await nameMap(ctx);
  const jobs = await loadJobs(ctx);
  const rows = jobs.map((j) => {
    const docs = Array.isArray(j.documents) ? j.documents : [];
    const kinds = new Set(docs.map((d) => String(d.type || d.name || 'Other')));
    const has = (re) => [...kinds].some((k) => re.test(k));
    return {
      job: j.jobNumber,
      customer: name(j.customerId),
      mode: j.transportMode,
      documents: docs.length,
      billOfLading: has(/b\/?l|bill of lading|hbl|mbl/i) ? 'Yes' : 'No',
      airWaybill: has(/awb|air ?waybill/i) ? 'Yes' : 'No',
      invoice: has(/invoice/i) ? 'Yes' : 'No',
      packingList: has(/packing/i) ? 'Yes' : 'No',
      certificateOfOrigin: has(/origin|coo/i) ? 'Yes' : 'No',
    };
  });
  return {
    columns: [
      { key: 'job', label: 'Shipment' },
      { key: 'customer', label: 'Customer' },
      { key: 'mode', label: 'Mode' },
      { key: 'documents', label: 'Documents', ...NUM },
      { key: 'billOfLading', label: 'B/L' },
      { key: 'airWaybill', label: 'AWB' },
      { key: 'invoice', label: 'Commercial Invoice' },
      { key: 'packingList', label: 'Packing List' },
      { key: 'certificateOfOrigin', label: 'Cert. of Origin' },
    ],
    rows,
    totals: { documents: sum(rows, 'documents') },
  };
};

const tradelineWise = async (ctx) => {
  const jobs = await loadJobs(ctx);
  const rows = groupBy(
    jobs,
    (j) => `${lane(j)}|${j.transportMode}`,
    (k, j) => ({
      lane: lane(j), mode: j.transportMode || '-',
      shipments: 0, carriers: new Set(), teu: 0, chargeableWeight: 0, revenue: 0, margin: 0,
    }),
    (acc, j) => {
      acc.shipments += 1;
      if (j.carrier) acc.carriers.add(j.carrier);
      acc.teu += teuOf(j);
      acc.chargeableWeight += Number(j.chargeableWeight) || 0;
      acc.revenue += Number(j.estimatedRevenue) || 0;
      acc.margin += Number(j.estimatedMargin) || 0;
    },
  ).map((r) => ({
    lane: r.lane,
    mode: r.mode,
    shipments: r.shipments,
    carriers: r.carriers.size ? [...r.carriers].join(', ') : '-',
    teu: r.teu,
    chargeableWeight: round(r.chargeableWeight, 3),
    revenue: round(r.revenue),
    margin: round(r.margin),
    marginPct: pct(r.margin, r.revenue),
  })).sort((a, b) => b.revenue - a.revenue);
  return {
    columns: [
      { key: 'lane', label: 'Trade Lane' },
      { key: 'mode', label: 'Mode' },
      { key: 'shipments', label: 'Shipments', ...NUM },
      { key: 'carriers', label: 'Carriers' },
      { key: 'teu', label: 'TEU', ...NUM },
      { key: 'chargeableWeight', label: 'Chargeable Wt (kg)', ...NUM },
      { key: 'revenue', label: 'Revenue', ...MONEY },
      { key: 'margin', label: 'Margin', ...MONEY },
      { key: 'marginPct', label: 'Margin %', ...NUM },
    ],
    rows,
    totals: Object.fromEntries(['shipments', 'teu', 'chargeableWeight', 'revenue', 'margin'].map((k) => [k, sum(rows, k)])),
  };
};

const salespersonTeuProfit = async (ctx) => {
  const name = await nameMap(ctx);
  const jobs = await loadJobs(ctx);
  const rows = groupBy(
    jobs,
    (j) => j.salesAgentId || j.assignedTo || 'none',
    (k) => ({ salesperson: k === 'none' ? 'Not assigned' : name(k), shipments: 0, teu: 0, chargeableWeight: 0, revenue: 0, cost: 0, margin: 0 }),
    (acc, j) => {
      acc.shipments += 1;
      acc.teu += teuOf(j);
      acc.chargeableWeight += Number(j.chargeableWeight) || 0;
      acc.revenue += Number(j.estimatedRevenue) || 0;
      acc.cost += Number(j.estimatedCost) || 0;
      acc.margin += Number(j.estimatedMargin) || 0;
    },
  ).map((r) => ({
    ...r,
    chargeableWeight: round(r.chargeableWeight, 3),
    revenue: round(r.revenue),
    cost: round(r.cost),
    margin: round(r.margin),
    marginPct: pct(r.margin, r.revenue),
  })).sort((a, b) => b.margin - a.margin);
  return {
    columns: [
      { key: 'salesperson', label: 'Salesperson' },
      { key: 'shipments', label: 'Shipments', ...NUM },
      { key: 'teu', label: 'TEU', ...NUM },
      { key: 'chargeableWeight', label: 'Chargeable Wt (kg)', ...NUM },
      { key: 'revenue', label: 'Revenue', ...MONEY },
      { key: 'cost', label: 'Cost', ...MONEY },
      { key: 'margin', label: 'Gross Profit', ...MONEY },
      { key: 'marginPct', label: 'GP %', ...NUM },
    ],
    rows,
    totals: Object.fromEntries(['shipments', 'teu', 'chargeableWeight', 'revenue', 'cost', 'margin'].map((k) => [k, sum(rows, k)])),
  };
};

/** Posted customer invoices per customer: billed, settled, outstanding. */
const customerWiseBilling = async (ctx) => {
  const { AccountMove } = ctx.models;
  const moves = (await AccountMove.findAll({
    where: { moveType: { [Op.in]: ['out_invoice', 'out_refund', 'out_debit'] }, state: 'posted' },
    raw: true,
  })).filter((m) => inWindow(ctx, m.invoiceDate));
  const sign = { out_invoice: 1, out_debit: 1, out_refund: -1 };
  const rows = groupBy(
    moves,
    (m) => m.partner || 'Not set',
    (k) => ({ customer: k, documents: 0, invoiced: 0, credited: 0, outstanding: 0 }),
    (acc, m) => {
      acc.documents += 1;
      const amt = Number(m.amountTotal) || 0;
      if (m.moveType === 'out_refund') acc.credited += amt;
      else acc.invoiced += amt;
      acc.outstanding += (Number(m.amountResidual) || 0) * (sign[m.moveType] || 1);
    },
  ).map((r) => ({
    ...r,
    invoiced: round(r.invoiced),
    credited: round(r.credited),
    net: round(r.invoiced - r.credited),
    collected: round(r.invoiced - r.credited - r.outstanding),
    outstanding: round(r.outstanding),
  })).sort((a, b) => b.net - a.net);
  return {
    columns: [
      { key: 'customer', label: 'Customer' },
      { key: 'documents', label: 'Documents', ...NUM },
      { key: 'invoiced', label: 'Invoiced', ...MONEY },
      { key: 'credited', label: 'Credited', ...MONEY },
      { key: 'net', label: 'Net Billed', ...MONEY },
      { key: 'collected', label: 'Collected', ...MONEY },
      { key: 'outstanding', label: 'Outstanding', ...MONEY },
    ],
    rows,
    totals: Object.fromEntries(['documents', 'invoiced', 'credited', 'net', 'collected', 'outstanding'].map((k) => [k, sum(rows, k)])),
  };
};

/** Cost charges a vendor has not billed yet - what is still to come in. */
const pendingCarrierInvoice = async (ctx) => {
  const { ChargeLine } = ctx.models;
  const name = await nameMap(ctx);
  const jobs = await loadJobs(ctx);
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const lines = (await ChargeLine.findAll({
    where: {
      parentType: { [Op.in]: ['house_shipment', 'master_shipment', 'service_job'] },
      side: 'cost',
      isActive: true,
      billingStatus: { [Op.in]: ['no', 'partial'] },
    },
    raw: true,
  })).filter((l) => l.parentType !== 'house_shipment' || jobById.has(l.parentId));

  const rows = lines.map((l) => {
    const j = jobById.get(l.parentId) || {};
    return {
      vendor: name(l.creditorPartnerId, 'Vendor not set'),
      shipment: j.jobNumber || l.parentType.replace('_', ' '),
      charge: l.chargeDescription,
      expected: round(Number(l.totalCostAmountIncl) || Number(l.totalCostAmount)),
      billed: round(l.billedAmount),
      pending: round(l.residualAmount),
      status: l.billingStatus === 'partial' ? 'Part billed' : 'Not billed',
    };
  }).sort((a, b) => a.vendor.localeCompare(b.vendor) || b.pending - a.pending);
  return {
    columns: [
      { key: 'vendor', label: 'Vendor / Carrier' },
      { key: 'shipment', label: 'Shipment' },
      { key: 'charge', label: 'Charge' },
      { key: 'expected', label: 'Expected', ...MONEY },
      { key: 'billed', label: 'Billed', ...MONEY },
      { key: 'pending', label: 'Pending', ...MONEY },
      { key: 'status', label: 'Status' },
    ],
    rows,
    totals: { expected: sum(rows, 'expected'), billed: sum(rows, 'billed'), pending: sum(rows, 'pending') },
  };
};

/** Every cost charge by code: what is paid for each service, and how evenly. */
const chargeWiseCostAnalysis = async (ctx) => {
  const jobs = await loadJobs(ctx);
  const byParent = await chargesByParent(ctx, 'house_shipment', jobs.map((j) => j.id));
  const lines = [...byParent.values()].flat().filter((l) => l.side === 'cost');
  const rows = groupBy(
    lines,
    (l) => l.chargeCode || l.chargeDescription,
    (k, l) => ({ code: l.chargeCode || '-', charge: l.chargeDescription, lines: 0, total: 0, billed: 0, rates: [] }),
    (acc, l) => {
      acc.lines += 1;
      acc.total += Number(l.totalCostAmount) || 0;
      acc.billed += Number(l.billedAmount) || 0;
      acc.rates.push(Number(l.costAmountRate) || 0);
    },
  ).map((r) => ({
    code: r.code,
    charge: r.charge,
    lines: r.lines,
    avgRate: round(r.rates.reduce((s, x) => s + x, 0) / (r.rates.length || 1), 4),
    minRate: round(Math.min(...r.rates), 4),
    maxRate: round(Math.max(...r.rates), 4),
    total: round(r.total),
    billed: round(r.billed),
    unbilled: round(r.total - r.billed),
  })).sort((a, b) => b.total - a.total);
  return {
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'charge', label: 'Charge' },
      { key: 'lines', label: 'Lines', ...NUM },
      { key: 'avgRate', label: 'Avg Rate', ...NUM },
      { key: 'minRate', label: 'Min Rate', ...NUM },
      { key: 'maxRate', label: 'Max Rate', ...NUM },
      { key: 'total', label: 'Total Cost', ...MONEY },
      { key: 'billed', label: 'Billed', ...MONEY },
      { key: 'unbilled', label: 'Unbilled', ...MONEY },
    ],
    rows,
    totals: { lines: sum(rows, 'lines'), total: sum(rows, 'total'), billed: sum(rows, 'billed'), unbilled: sum(rows, 'unbilled') },
  };
};

// --- Data discrepancy reports ----------------------------------------------
// These are exception lists: an empty report is the good outcome.

const discrepancy = (title, pick, reason) => ({
  title,
  acl: 'house.shipment',
  build: async (ctx) => {
    const name = await nameMap(ctx);
    const jobs = await loadJobs(ctx);
    const byParent = await chargesByParent(ctx, 'house_shipment', jobs.map((j) => j.id));
    const rows = jobs
      .filter((j) => pick(j, byParent.get(j.id) || []))
      .map((j) => ({
        job: j.jobNumber,
        date: day(jobDate(j)),
        customer: name(j.customerId),
        mode: j.transportMode,
        type: j.cargoType,
        status: j.status,
        issue: reason,
      }));
    return {
      columns: [
        { key: 'job', label: 'Shipment' },
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'customer', label: 'Customer' },
        { key: 'mode', label: 'Mode' },
        { key: 'type', label: 'Type' },
        { key: 'status', label: 'Status' },
        { key: 'issue', label: 'Issue' },
      ],
      rows,
      totals: {},
    };
  },
});

/** Posted invoices and bills that name no shipment, consol or service job. */
const accountingWithoutShipment = async (ctx) => {
  const { AccountMove } = ctx.models;
  const empty = (v) => !Array.isArray(v) || !v.length;
  const moves = (await AccountMove.findAll({
    where: {
      moveType: { [Op.in]: ['out_invoice', 'out_refund', 'out_debit', 'in_invoice', 'in_refund', 'in_debit'] },
      state: 'posted',
    },
    raw: true,
  }))
    .filter((m) => inWindow(ctx, m.invoiceDate))
    .filter((m) => empty(m.houseShipmentRefs) && empty(m.masterShipmentRefs) && empty(m.serviceJobRefs));
  const label = {
    out_invoice: 'Customer invoice', out_refund: 'Credit note', out_debit: 'Debit note',
    in_invoice: 'Vendor bill', in_refund: 'Vendor refund', in_debit: 'Vendor debit note',
  };
  const rows = moves.map((m) => ({
    document: m.name,
    kind: label[m.moveType] || m.moveType,
    date: m.invoiceDate,
    partner: m.partner,
    amount: round(m.amountTotal),
    issue: 'Not linked to any shipment, consol or service job',
  }));
  return {
    columns: [
      { key: 'document', label: 'Document' },
      { key: 'kind', label: 'Type' },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'partner', label: 'Partner' },
      { key: 'amount', label: 'Amount', ...MONEY },
      { key: 'issue', label: 'Issue' },
    ],
    rows,
    totals: { amount: sum(rows, 'amount') },
  };
};

// ---------------------------------------------------------------------------
// Sales & CRM > Reports
// ---------------------------------------------------------------------------

const quoteStatusAnalysis = async (ctx) => {
  const { Quotation } = ctx.models;
  const quotes = (await Quotation.findAll({ raw: true })).filter((q) => inWindow(ctx, q.createdAt));
  const rows = groupBy(
    quotes,
    (q) => q.status || 'draft',
    (k) => ({ status: k, quotes: 0, multimodal: 0, revenue: 0, cost: 0, margin: 0 }),
    (acc, q) => {
      acc.quotes += 1;
      if (q.isMultimodal) acc.multimodal += 1;
      acc.revenue += Number(q.estimatedRevenue) || Number(q.totalSellRate) || 0;
      acc.cost += Number(q.estimatedCost) || Number(q.totalBuyRate) || 0;
      acc.margin += Number(q.estimatedMargin) || Number(q.profit) || 0;
    },
  ).map((r) => ({
    ...r,
    status: r.status.replace(/_/g, ' '),
    revenue: round(r.revenue),
    cost: round(r.cost),
    margin: round(r.margin),
    marginPct: pct(r.margin, r.revenue),
    share: pct(r.quotes, quotes.length),
  })).sort((a, b) => b.quotes - a.quotes);
  return {
    columns: [
      { key: 'status', label: 'Status' },
      { key: 'quotes', label: 'Quotations', ...NUM },
      { key: 'share', label: 'Share %', ...NUM },
      { key: 'multimodal', label: 'Multimodal', ...NUM },
      { key: 'revenue', label: 'Quoted Revenue', ...MONEY },
      { key: 'cost', label: 'Quoted Cost', ...MONEY },
      { key: 'margin', label: 'Quoted Margin', ...MONEY },
      { key: 'marginPct', label: 'Margin %', ...NUM },
    ],
    rows,
    totals: Object.fromEntries(['quotes', 'multimodal', 'revenue', 'cost', 'margin'].map((k) => [k, sum(rows, k)])),
  };
};

const chargesWiseQuotation = async (ctx) => {
  const { ChargeLine, Quotation } = ctx.models;
  const quotes = (await Quotation.findAll({ attributes: ['id', 'createdAt'], raw: true }))
    .filter((q) => inWindow(ctx, q.createdAt));
  const ids = quotes.map((q) => q.id);
  const lines = ids.length
    ? await ChargeLine.findAll({ where: { parentType: 'quote', parentId: { [Op.in]: ids }, isActive: true }, raw: true })
    : [];
  const rows = groupBy(
    lines,
    (l) => l.chargeCode || l.chargeDescription,
    (k, l) => ({ code: l.chargeCode || '-', charge: l.chargeDescription, quotes: new Set(), buy: 0, sell: 0, n: 0, fromVendor: 0 }),
    (acc, l) => {
      acc.quotes.add(l.parentId);
      acc.n += 1;
      acc.buy += Number(l.totalCostAmount) || 0;
      acc.sell += Number(l.totalSellAmount) || 0;
      if (l.chargeSource === 'vendor_portal') acc.fromVendor += 1;
    },
  ).map((r) => ({
    code: r.code,
    charge: r.charge,
    quotes: r.quotes.size,
    lines: r.n,
    vendorPriced: r.fromVendor,
    buy: round(r.buy),
    sell: round(r.sell),
    margin: round(r.sell - r.buy),
    marginPct: pct(r.sell - r.buy, r.sell),
  })).sort((a, b) => b.sell - a.sell);
  return {
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'charge', label: 'Charge' },
      { key: 'quotes', label: 'Quotations', ...NUM },
      { key: 'lines', label: 'Lines', ...NUM },
      { key: 'vendorPriced', label: 'From Vendor Portal', ...NUM },
      { key: 'buy', label: 'Buy', ...MONEY },
      { key: 'sell', label: 'Sell', ...MONEY },
      { key: 'margin', label: 'Margin', ...MONEY },
      { key: 'marginPct', label: 'Margin %', ...NUM },
    ],
    rows,
    totals: Object.fromEntries(['quotes', 'lines', 'vendorPriced', 'buy', 'sell', 'margin'].map((k) => [k, sum(rows, k)])),
  };
};

const opportunityDetail = async (ctx) => {
  const { Opportunity, CrmStage, Lead, Prospect } = ctx.models;
  const name = await nameMap(ctx);
  const [opps, stages, leads, prospects] = await Promise.all([
    Opportunity.findAll({ raw: true }),
    CrmStage.findAll({ raw: true }),
    Lead.findAll({ attributes: ['id', 'leadNumber', 'leadSource'], raw: true }),
    Prospect.findAll({ attributes: ['id', 'name'], raw: true }),
  ]);
  const stageName = new Map(stages.map((s) => [s.id, s.name]));
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const prospectName = new Map(prospects.map((p) => [p.id, p.name]));
  const rows = opps.filter((o) => inWindow(ctx, o.createdAt)).map((o) => {
    const lead = leadById.get(o.leadId);
    return {
      opportunity: o.name,
      created: day(o.createdAt),
      stage: stageName.get(o.stageId) || o.stage,
      lead: lead ? lead.leadNumber : '-',
      source: lead ? (lead.leadSource || '-') : (o.opportunitySource || '-'),
      prospect: prospectName.get(o.prospectId) || name(o.customerId, '-'),
      mode: o.transportMode,
      lane: `${o.originCountry || o.origin || '?'} to ${o.destinationCountry || o.destination || '?'}`,
      revenue: round(o.estimatedRevenue),
      probability: Number(o.probability) || 0,
      weighted: round((Number(o.estimatedRevenue) || 0) * ((Number(o.probability) || 0) / 100)),
      owner: name(o.assignedTo),
      closeDate: o.expectedCloseDate,
    };
  }).sort((a, b) => b.weighted - a.weighted);
  return {
    columns: [
      { key: 'opportunity', label: 'Opportunity' },
      { key: 'created', label: 'Created', type: 'date' },
      { key: 'stage', label: 'Stage' },
      { key: 'lead', label: 'Lead' },
      { key: 'source', label: 'Source' },
      { key: 'prospect', label: 'Prospect / Customer' },
      { key: 'mode', label: 'Mode' },
      { key: 'lane', label: 'Lane' },
      { key: 'revenue', label: 'Expected Revenue', ...MONEY },
      { key: 'probability', label: 'Probability %', ...NUM },
      { key: 'weighted', label: 'Weighted', ...MONEY },
      { key: 'owner', label: 'Owner' },
      { key: 'closeDate', label: 'Expected Close', type: 'date' },
    ],
    rows,
    totals: { revenue: sum(rows, 'revenue'), weighted: sum(rows, 'weighted') },
  };
};

const salesAgent = async (ctx) => {
  const { Lead, Opportunity, Quotation, User } = ctx.models;
  const [users, leads, opps, quotes] = await Promise.all([
    User.findAll({ attributes: ['id', 'name', 'email'], raw: true }),
    Lead.findAll({ attributes: ['id', 'assignedTo', 'status', 'date'], raw: true }),
    Opportunity.findAll({ attributes: ['id', 'assignedTo', 'stage', 'estimatedRevenue', 'createdAt'], raw: true }),
    Quotation.findAll({ attributes: ['id', 'createdBy', 'status', 'estimatedRevenue', 'estimatedMargin', 'createdAt'], raw: true }),
  ]);
  const rows = users.map((u) => {
    const myLeads = leads.filter((l) => l.assignedTo === u.id && inWindow(ctx, l.date));
    const myOpps = opps.filter((o) => o.assignedTo === u.id && inWindow(ctx, o.createdAt));
    const myQuotes = quotes.filter((q) => q.createdBy === u.id && inWindow(ctx, q.createdAt));
    const accepted = myQuotes.filter((q) => ['accepted', 'approved', 'converted'].includes(q.status));
    return {
      agent: u.name || u.email,
      leads: myLeads.length,
      converted: myLeads.filter((l) => l.status === 'converted').length,
      opportunities: myOpps.length,
      won: myOpps.filter((o) => o.stage === 'won').length,
      quotes: myQuotes.length,
      accepted: accepted.length,
      quotedRevenue: round(myQuotes.reduce((s, q) => s + (Number(q.estimatedRevenue) || 0), 0)),
      wonMargin: round(accepted.reduce((s, q) => s + (Number(q.estimatedMargin) || 0), 0)),
      hitRate: pct(accepted.length, myQuotes.length),
    };
  }).filter((r) => r.leads || r.opportunities || r.quotes)
    .sort((a, b) => b.quotedRevenue - a.quotedRevenue);
  return {
    columns: [
      { key: 'agent', label: 'Sales Agent' },
      { key: 'leads', label: 'Leads', ...NUM },
      { key: 'converted', label: 'Converted', ...NUM },
      { key: 'opportunities', label: 'Opportunities', ...NUM },
      { key: 'won', label: 'Won', ...NUM },
      { key: 'quotes', label: 'Quotations', ...NUM },
      { key: 'accepted', label: 'Accepted', ...NUM },
      { key: 'hitRate', label: 'Hit Rate %', ...NUM },
      { key: 'quotedRevenue', label: 'Quoted Revenue', ...MONEY },
      { key: 'wonMargin', label: 'Won Margin', ...MONEY },
    ],
    rows,
    totals: Object.fromEntries(
      ['leads', 'converted', 'opportunities', 'won', 'quotes', 'accepted', 'quotedRevenue', 'wonMargin'].map((k) => [k, sum(rows, k)]),
    ),
  };
};

/** Every recorded customer visit, flattened out of the opportunities. */
const customerVisit = async (ctx) => {
  const { Opportunity } = ctx.models;
  const name = await nameMap(ctx);
  const opps = await Opportunity.findAll({ raw: true });
  const rows = [];
  for (const o of opps) {
    const visits = Array.isArray(o.customerVisits) ? o.customerVisits : [];
    for (const v of visits) {
      if (!inWindow(ctx, v.date)) continue;
      rows.push({
        date: v.date,
        opportunity: o.name,
        customer: o.contactName ? `${o.contactName}` : name(o.customerId, '-'),
        visitedBy: v.visitedBy || name(o.assignedTo),
        purpose: v.purpose || '-',
        outcome: v.outcome || '-',
        nextAction: v.nextAction || '-',
      });
    }
  }
  rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return {
    columns: [
      { key: 'date', label: 'Visit Date', type: 'date' },
      { key: 'opportunity', label: 'Opportunity' },
      { key: 'customer', label: 'Contact' },
      { key: 'visitedBy', label: 'Visited By' },
      { key: 'purpose', label: 'Purpose' },
      { key: 'outcome', label: 'Outcome' },
      { key: 'nextAction', label: 'Next Action' },
    ],
    rows,
    totals: {},
  };
};

// ---------------------------------------------------------------------------

const withAcl = (acl, title, build) => ({ title, acl, build });

const FREIGHT_REPORTS = {
  // Operations > Reporting
  'shipment-profit': withAcl('house.shipment', 'Shipment Profit Report', shipmentProfit),
  'chargewise-estimated-actual': withAcl('house.shipment', 'Charge Wise Shipment Estimated VS Actual', chargewiseEstimatedActual),
  'customer-wise-shipments': withAcl('house.shipment', 'Customer Wise Report', partyReport((j) => j.customerId, 'Customer')),
  'shipper-wise': withAcl('house.shipment', 'Shipper Wise Report', partyReport((j) => j.shipperId, 'Shipper')),
  'customer-volume': withAcl('house.shipment', 'Customer Volume Report', customerVolume),
  'customer-status': withAcl('house.shipment', 'Customer Status Report', customerStatus),
  'sales-by-customer': withAcl('house.shipment', 'Sales Report by Customer', partyReport((j) => j.customerId, 'Customer')),
  'sales-by-shipping-line': withAcl('house.shipment', 'Sales Report by Shipping Lines', salesByShippingLine),
  'custom-duty': withAcl('house.shipment', 'Custom Duty Report', customDuty),

  // ETL > Reporting
  'consolidated-house-shipment': withAcl('house.shipment', 'Consolidated House Shipment Report', consolidatedHouseShipments),
  'shipment-analysis': withAcl('house.shipment', 'Shipment Analysis', shipmentAnalysis),
  'shipment-document-analysis': withAcl('house.shipment', 'Shipment Document Analysis', shipmentDocumentAnalysis),
  'carrier-wise-teu': withAcl('house.shipment', 'Carrier Wise Invoice / TEUs Report', salesByShippingLine),
  'customer-wise-billing': withAcl('invoice', 'Customer Wise Billing Report', customerWiseBilling),
  'salesperson-teu-profit': withAcl('house.shipment', 'Salesperson Wise TEUs and Profitability Report', salespersonTeuProfit),
  'shipment-profitability': withAcl('house.shipment', 'Shipment Profitability Report', shipmentProfit),
  'tradeline-wise': withAcl('house.shipment', 'Tradeline Wise Carrier / TEUs / Invoice Report', tradelineWise),
  'pending-carrier-invoice': withAcl('charge.line', 'Pending Carrier Invoice Report (Outstanding)', pendingCarrierInvoice),
  'charge-wise-cost-analysis': withAcl('charge.line', 'Charge Wise Cost Analysis', chargeWiseCostAnalysis),
  'accounting-without-shipment': withAcl('invoice', 'Accounting Without Shipment', accountingWithoutShipment),
  'shipment-without-container': discrepancy(
    'Shipment Without Container Number',
    // Only FCL: bulk, break bulk and ro-ro cargo is not containerised, so a
    // missing container number on those is correct, not a discrepancy.
    (j) => String(j.transportMode).toUpperCase() === 'SEA'
      && String(j.cargoType).toUpperCase() === 'FCL'
      && !(Array.isArray(j.containerNumbers) && j.containerNumbers.length),
    'Full-container sea shipment with no container number',
  ),
  'shipment-without-cost': discrepancy(
    'Shipment Without Cost Charges',
    (j, lines) => j.status !== 'cancelled' && !lines.some((l) => l.side === 'cost' || l.side === 'both'),
    'No cost charge recorded - margin is overstated',
  ),
  'shipment-without-revenue': discrepancy(
    'Shipment Without Revenue Charges',
    (j, lines) => j.status !== 'cancelled' && !lines.some((l) => l.side === 'revenue' || l.side === 'both'),
    'No revenue charge recorded - nothing will be invoiced',
  ),

  // Sales & CRM > Reports
  'quote-status-analysis': withAcl('quotation', 'Quote Analysis by Status', quoteStatusAnalysis),
  'charges-wise-quotation': withAcl('quotation', 'Charges Wise Quotation Report', chargesWiseQuotation),
  'opportunity-detail': withAcl('crm.prospect.opportunity', 'Opportunity Detail Report', opportunityDetail),
  'sales-agent': withAcl('crm.prospect.lead', 'Sales Agent Report', salesAgent),
  'customer-visit': withAcl('crm.prospect.opportunity', 'Customer Visit Report', customerVisit),
};

module.exports = { FREIGHT_REPORTS, teuOf, jobDate };
