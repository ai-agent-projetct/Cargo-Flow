// Liner Agency reports, served by the shared report engine so each renders in
// the existing ReportView as { columns, rows, totals }.
//
// The instance's report wizards take a "report type" selection; each type is a
// report id here (Operation Report > Vessel = nvocc-op-vessel, and so on), so
// the date filters ReportView already has are all a report needs.
const { Op } = require('sequelize');
const { AGENCY_MODELS: A } = require('./models');

const round = (v) => Math.round((Number(v) || 0) * 100) / 100;
const sum = (rows, k) => round(rows.reduce((s, r) => s + (Number(r[k]) || 0), 0));
const day = (d) => (d ? String(d).slice(0, 10) : null);
const inWindow = (ctx, d) => {
  const v = day(d);
  if (!v) return !ctx.dateFrom && !ctx.dateTo;
  return (!ctx.dateFrom || v >= ctx.dateFrom) && (!ctx.dateTo || v <= ctx.dateTo);
};
const MONEY = { align: 'right', type: 'money' };
const NUM = { align: 'right' };
const svc = () => require('./service');

const jobs = async (ctx, where = {}) => {
  const rows = (await A.job.findAll({ where, order: [['shipmentDate', 'DESC']], raw: true }))
    .filter((j) => inWindow(ctx, j.shipmentDate));
  return svc().labelsFor(ctx.models, 'job', rows);
};

const chargesFor = async (ctx, ids) => {
  if (!ids.length) return new Map();
  const lines = await ctx.models.ChargeLine.findAll({
    where: { parentType: 'nvocc_job', parentId: { [Op.in]: ids }, isActive: true }, raw: true,
  });
  return lines.reduce((m, l) => m.set(l.parentId, [...(m.get(l.parentId) || []), l]), new Map());
};

const containersFor = async (ctx, ids) => {
  if (!ids.length) return new Map();
  const rows = await svc().labelsFor(ctx.models, 'container-line',
    await A['container-line'].findAll({ where: { jobId: { [Op.in]: ids } }, raw: true }));
  return rows.reduce((m, c) => m.set(c.jobId, [...(m.get(c.jobId) || []), c]), new Map());
};

const boxSummary = (containers) => {
  const by = containers.reduce((m, c) => m.set((c._labels || {}).containerTypeId || '?', (m.get((c._labels || {}).containerTypeId || '?') || 0) + 1), new Map());
  return [...by].map(([t, n]) => `${n}x${t}`).join(', ');
};

const money = (lines, side, field = side === 'cost' ? 'totalCostAmount' : 'totalSellAmount') => round(
  (lines || []).filter((l) => l.side === side || l.side === 'both').reduce((s, l) => s + Number(l[field] || 0), 0),
);

// ── Booking > CRO ───────────────────────────────────────────────────────────
const croRows = async (ctx) => {
  const bookings = (await A['pre-booking'].findAll({ order: [['date', 'DESC']], raw: true })).filter((b) => inWindow(ctx, b.date));
  const labelled = await svc().labelsFor(ctx.models, 'pre-booking', bookings);
  const boxes = await svc().labelsFor(ctx.models, 'pre-booking-container',
    await A['pre-booking-container'].findAll({ where: { preBookingId: { [Op.in]: bookings.map((b) => b.id) } }, raw: true }));
  const types = new Map((await A['container-type'].findAll({ raw: true })).map((t) => [t.id, t]));
  return labelled.map((b) => {
    const mine = boxes.filter((x) => x.preBookingId === b.id);
    const qty = mine.reduce((s, x) => s + (Number(x.quantity) || 0), 0);
    const teu = mine.reduce((s, x) => s + (Number(x.quantity) || 0) * (Number((types.get(x.containerTypeId) || {}).teu) || 1), 0);
    return {
      cro: b.croNo, booking: b.name, date: day(b.date), customer: b._labels.clientId || '',
      pol: b._labels.portOfLoadingId || '', pod: b._labels.portOfDischargeId || '', line: b._labels.carrierId || '',
      vessel: b._labels.vesselId || '', voyage: b.voyageNumber || '',
      boxes: mine.map((x) => `${x.quantity}x${x._labels.containerTypeId || ''}`).join(', '), containers: qty, teu,
      status: b.state, job: b._labels.exportJobId || '',
    };
  });
};

const croOperation = async (ctx) => {
  const rows = await croRows(ctx);
  return {
    columns: [
      { key: 'cro', label: 'CRO No' }, { key: 'booking', label: 'Booking No' }, { key: 'date', label: 'Date', type: 'date' },
      { key: 'customer', label: 'Customer' }, { key: 'pol', label: 'POL' }, { key: 'pod', label: 'POD' },
      { key: 'line', label: 'Shipping Line' }, { key: 'vessel', label: 'Vessel' }, { key: 'voyage', label: 'Voyage' },
      { key: 'boxes', label: 'Equipment' }, { key: 'containers', label: 'Containers', ...NUM }, { key: 'teu', label: 'TEU', ...NUM },
      { key: 'status', label: 'Status' }, { key: 'job', label: 'Export Job' },
    ],
    rows,
    totals: { containers: sum(rows, 'containers'), teu: sum(rows, 'teu') },
  };
};

const croCustomer = async (ctx) => {
  const by = new Map();
  for (const r of await croRows(ctx)) {
    const g = by.get(r.customer) || { customer: r.customer || 'Unassigned', bookings: 0, approved: 0, converted: 0, cancelled: 0, containers: 0, teu: 0 };
    g.bookings += 1;
    if (['accept', 'edit_approved_job'].includes(r.status)) g.approved += 1;
    if (r.job) g.converted += 1;
    if (['cancel', 'expire', 'reject'].includes(r.status)) g.cancelled += 1;
    g.containers += r.containers;
    g.teu += r.teu;
    by.set(r.customer, g);
  }
  const rows = [...by.values()].sort((a, b) => b.teu - a.teu);
  return {
    columns: [
      { key: 'customer', label: 'Customer' }, { key: 'bookings', label: 'Bookings', ...NUM }, { key: 'approved', label: 'Approved', ...NUM },
      { key: 'converted', label: 'Converted to Job', ...NUM }, { key: 'cancelled', label: 'Cancelled / Expired', ...NUM },
      { key: 'containers', label: 'Containers', ...NUM }, { key: 'teu', label: 'TEU', ...NUM },
    ],
    rows,
    totals: ['bookings', 'approved', 'converted', 'cancelled', 'containers', 'teu'].reduce((t, k) => ({ ...t, [k]: sum(rows, k) }), {}),
  };
};

// ── Operations > Freight Manifest Report ────────────────────────────────────
const freightManifest = async (ctx) => {
  const list = await jobs(ctx, { shipmentType: 'export' });
  const { manifestRows, MANIFEST_COLS } = require('./actions');
  const rows = await manifestRows(ctx.models, list);
  return {
    columns: MANIFEST_COLS.map(([key, label]) => ({ key, label, ...(['teu', 'packages', 'grossWeight', 'volume'].includes(key) ? NUM : {}) })),
    rows,
    totals: { teu: sum(rows, 'teu'), packages: sum(rows, 'packages'), grossWeight: sum(rows, 'grossWeight'), volume: sum(rows, 'volume') },
  };
};

const freightSummary = async (ctx) => {
  const list = await jobs(ctx, { shipmentType: 'export' });
  const charges = await chargesFor(ctx, list.map((j) => j.id));
  const by = new Map();
  for (const j of list) {
    const k = `${j._labels.destinationPortId || 'Unknown'}|${j._labels.vesselId || ''}|${j.voyageNumber || ''}`;
    const g = by.get(k) || { pod: j._labels.destinationPortId || 'Unknown', vessel: j._labels.vesselId || '', voyage: j.voyageNumber || '', bls: 0, teu: 0, weight: 0, prepaid: 0, collect: 0 };
    g.bls += 1;
    g.teu += Number(j.teuTotal) || 0;
    g.weight += Number(j.grossWeight) || 0;
    const rev = money(charges.get(j.id), 'revenue');
    if (j.paymentTerms === 'ccx') g.collect += rev; else g.prepaid += rev;
    by.set(k, g);
  }
  const rows = [...by.values()].map((g) => ({ ...g, weight: round(g.weight), prepaid: round(g.prepaid), collect: round(g.collect), total: round(g.prepaid + g.collect) }));
  return {
    columns: [
      { key: 'pod', label: 'Port of Discharge' }, { key: 'vessel', label: 'Vessel' }, { key: 'voyage', label: 'Voyage' },
      { key: 'bls', label: 'BLs', ...NUM }, { key: 'teu', label: 'TEU', ...NUM }, { key: 'weight', label: 'Gross Wt (KG)', ...NUM },
      { key: 'prepaid', label: 'Prepaid Freight', ...MONEY }, { key: 'collect', label: 'Collect Freight', ...MONEY }, { key: 'total', label: 'Total', ...MONEY },
    ],
    rows,
    totals: ['bls', 'teu', 'weight', 'prepaid', 'collect', 'total'].reduce((t, k) => ({ ...t, [k]: sum(rows, k) }), {}),
  };
};

const freightRecap = async (ctx) => {
  const list = await jobs(ctx, { shipmentType: 'export' });
  const boxes = await containersFor(ctx, list.map((j) => j.id));
  const by = new Map();
  for (const j of list) {
    for (const c of boxes.get(j.id) || []) {
      const k = `${c._labels.containerTypeId}|${c.soc}|${c.isEmptyContainer ? 'E' : 'F'}`;
      const g = by.get(k) || { type: c._labels.containerTypeId || '?', soc: c.soc === 'Y' ? 'SOC' : 'COC', status: c.isEmptyContainer ? 'Empty' : 'Laden', boxes: 0, teu: 0, weight: 0 };
      g.boxes += 1;
      g.teu += Number(c.noOfTeu) || 1;
      g.weight += Number(c.grossWeight) || 0;
      by.set(k, g);
    }
  }
  const rows = [...by.values()].map((g) => ({ ...g, weight: round(g.weight) }));
  return {
    columns: [
      { key: 'type', label: 'Container Type' }, { key: 'soc', label: 'Ownership' }, { key: 'status', label: 'Full / Empty' },
      { key: 'boxes', label: 'Containers', ...NUM }, { key: 'teu', label: 'TEU', ...NUM }, { key: 'weight', label: 'Gross Wt (KG)', ...NUM },
    ],
    rows,
    totals: { boxes: sum(rows, 'boxes'), teu: sum(rows, 'teu'), weight: sum(rows, 'weight') },
  };
};

// ── Operations > Operation Report ───────────────────────────────────────────
const opVessel = async (ctx) => {
  const list = await jobs(ctx);
  const by = new Map();
  for (const j of list) {
    const k = `${j._labels.vesselId || 'No vessel'}|${j.voyageNumber || ''}`;
    const g = by.get(k) || { vessel: j._labels.vesselId || 'No vessel', voyage: j.voyageNumber || '', exportJobs: 0, importJobs: 0, exportTeu: 0, importTeu: 0, margin: 0 };
    if (j.shipmentType === 'import') { g.importJobs += 1; g.importTeu += Number(j.teuTotal) || 0; } else { g.exportJobs += 1; g.exportTeu += Number(j.teuTotal) || 0; }
    g.margin += Number(j.estimatedMargin) || 0;
    by.set(k, g);
  }
  const rows = [...by.values()].map((g) => ({ ...g, margin: round(g.margin) }));
  return {
    columns: [
      { key: 'vessel', label: 'Vessel' }, { key: 'voyage', label: 'Voyage' },
      { key: 'exportJobs', label: 'Export Jobs', ...NUM }, { key: 'exportTeu', label: 'Export TEU', ...NUM },
      { key: 'importJobs', label: 'Import Jobs', ...NUM }, { key: 'importTeu', label: 'Import TEU', ...NUM },
      { key: 'margin', label: 'Est. Margin', ...MONEY },
    ],
    rows,
    totals: ['exportJobs', 'exportTeu', 'importJobs', 'importTeu', 'margin'].reduce((t, k) => ({ ...t, [k]: sum(rows, k) }), {}),
  };
};

const containerRows = async (ctx, where = {}) => {
  const list = await jobs(ctx, where);
  const boxes = await containersFor(ctx, list.map((j) => j.id));
  const regIds = [...boxes.values()].flat().map((c) => c.containerRegistryId).filter(Boolean);
  const regs = await svc().labelsFor(ctx.models, 'container-registry',
    regIds.length ? await A['container-registry'].findAll({ where: { id: { [Op.in]: regIds } }, raw: true }) : []);
  const regById = new Map(regs.map((r) => [r.id, r]));
  const rows = [];
  for (const j of list) {
    for (const c of boxes.get(j.id) || []) {
      const reg = regById.get(c.containerRegistryId);
      rows.push({
        container: c.containerNumber || 'TBA', type: c._labels.containerTypeId || '', soc: c.soc, seal: c.sealNumber || '',
        job: j.name, bl: j.hblNumber || '', direction: j.shipmentType, pol: j._labels.originPortId || '', pod: j._labels.destinationPortId || '',
        vessel: j._labels.vesselId || '', voyage: j.voyageNumber || '', weight: Number(c.grossWeight) || 0,
        lastActivity: reg ? (reg._labels.lastActivityTypeId || '') : '', lastDate: reg ? day(reg.lastActivityDate) : null,
        empty: c.isEmptyContainer ? 'Empty' : 'Laden',
      });
    }
  }
  return rows;
};

const opContainer = async (ctx) => {
  const rows = await containerRows(ctx);
  return {
    columns: [
      { key: 'container', label: 'Container' }, { key: 'type', label: 'Type' }, { key: 'soc', label: 'SOC' }, { key: 'empty', label: 'Full / Empty' },
      { key: 'job', label: 'Job' }, { key: 'bl', label: 'BL' }, { key: 'direction', label: 'Exp / Imp' },
      { key: 'vessel', label: 'Vessel' }, { key: 'voyage', label: 'Voyage' },
      { key: 'lastActivity', label: 'Last Activity' }, { key: 'lastDate', label: 'Activity Date', type: 'date' },
    ],
    rows,
    totals: {},
  };
};

const opLoading = async (ctx) => {
  const rows = await containerRows(ctx, { shipmentType: 'export' });
  return {
    columns: [
      { key: 'container', label: 'Container' }, { key: 'type', label: 'Type' }, { key: 'seal', label: 'Seal No' },
      { key: 'bl', label: 'BL' }, { key: 'pol', label: 'POL' }, { key: 'pod', label: 'POD' },
      { key: 'vessel', label: 'Vessel' }, { key: 'voyage', label: 'Voyage' }, { key: 'weight', label: 'VGM / Gross (KG)', ...NUM },
      { key: 'empty', label: 'Full / Empty' }, { key: 'soc', label: 'SOC' },
    ],
    rows,
    totals: { weight: sum(rows, 'weight') },
  };
};

const opJobList = async (ctx) => {
  const list = await jobs(ctx);
  const rows = list.map((j) => ({
    job: j.name, date: day(j.shipmentDate), direction: j.shipmentType, bl: j.hblNumber || '', customer: j._labels.customerId || '',
    principal: j._labels.principalId || '', pol: j._labels.originPortId || '', pod: j._labels.destinationPortId || '',
    vessel: j._labels.vesselId || '', voyage: j.voyageNumber || '', teu: Number(j.teuTotal) || 0, status: j.state,
    revenue: round(j.estimatedRevenue), cost: round(j.estimatedCost), margin: round(j.estimatedMargin),
  }));
  return {
    columns: [
      { key: 'job', label: 'Job' }, { key: 'date', label: 'Date', type: 'date' }, { key: 'direction', label: 'Exp / Imp' },
      { key: 'bl', label: 'BL' }, { key: 'customer', label: 'Customer' }, { key: 'principal', label: 'Principal' },
      { key: 'pol', label: 'POL' }, { key: 'pod', label: 'POD' }, { key: 'vessel', label: 'Vessel' }, { key: 'voyage', label: 'Voyage' },
      { key: 'teu', label: 'TEU', ...NUM }, { key: 'status', label: 'Status' },
      { key: 'revenue', label: 'Revenue', ...MONEY }, { key: 'cost', label: 'Cost', ...MONEY }, { key: 'margin', label: 'Margin', ...MONEY },
    ],
    rows,
    totals: { teu: sum(rows, 'teu'), revenue: sum(rows, 'revenue'), cost: sum(rows, 'cost'), margin: sum(rows, 'margin') },
  };
};

const opJobStatistics = async (ctx) => {
  const list = await jobs(ctx);
  const { RESOURCES } = require('./spec');
  const rows = RESOURCES.job.states.map(([state, label]) => {
    const mine = list.filter((j) => j.state === state);
    return {
      status: label,
      exportJobs: mine.filter((j) => j.shipmentType !== 'import').length,
      importJobs: mine.filter((j) => j.shipmentType === 'import').length,
      teu: mine.reduce((s, j) => s + (Number(j.teuTotal) || 0), 0),
    };
  }).filter((r) => r.exportJobs || r.importJobs);
  rows.forEach((r) => { r.total = r.exportJobs + r.importJobs; });
  return {
    columns: [
      { key: 'status', label: 'Status' }, { key: 'exportJobs', label: 'Export', ...NUM },
      { key: 'importJobs', label: 'Import', ...NUM }, { key: 'total', label: 'Total', ...NUM }, { key: 'teu', label: 'TEU', ...NUM },
    ],
    rows,
    totals: ['exportJobs', 'importJobs', 'total', 'teu'].reduce((t, k) => ({ ...t, [k]: sum(rows, k) }), {}),
  };
};

const opDoStatus = async (ctx) => {
  const list = await jobs(ctx, { shipmentType: 'import' });
  const rows = list.map((j) => ({
    job: j.name, bl: j.hblNumber || '', customer: j._labels.customerId || '', vessel: j._labels.vesselId || '', voyage: j.voyageNumber || '',
    eta: day(j.eta || j.sailingDate), doNumber: j.doNumber || '', doDate: day(j.doDate), validity: day(j.doValidity),
    doStatus: j.doNumber ? 'Issued' : 'Pending', status: j.state,
  }));
  return {
    columns: [
      { key: 'job', label: 'Job' }, { key: 'bl', label: 'BL' }, { key: 'customer', label: 'Consignee' },
      { key: 'vessel', label: 'Vessel' }, { key: 'voyage', label: 'Voyage' }, { key: 'eta', label: 'Arrival', type: 'date' },
      { key: 'doNumber', label: 'D/O No' }, { key: 'doDate', label: 'D/O Date', type: 'date' }, { key: 'validity', label: 'Valid Until', type: 'date' },
      { key: 'doStatus', label: 'D/O Status' }, { key: 'status', label: 'Job Status' },
    ],
    rows,
    totals: { issued: rows.filter((r) => r.doNumber).length, pending: rows.filter((r) => !r.doNumber).length },
  };
};

// ── Principal SOA ───────────────────────────────────────────────────────────
const soaJobs = async (ctx, where, chargeFilter = () => true) => {
  const list = (await jobs(ctx, where)).filter((j) => !ctx.partnerId || j.principalId === ctx.partnerId);
  const charges = await chargesFor(ctx, list.map((j) => j.id));
  return list.map((j) => {
    const lines = (charges.get(j.id) || []).filter(chargeFilter);
    const revenue = money(lines, 'revenue');
    const cost = money(lines, 'cost');
    const collected = round(lines.filter((l) => l.side === 'revenue').reduce((s, l) => s + Number(l.invoicedAmount || 0), 0));
    return {
      principal: j._labels.principalId || 'No principal', job: j.name, bl: j.hblNumber || '', date: day(j.shipmentDate),
      direction: j.shipmentType, vessel: j._labels.vesselId || '', voyage: j.voyageNumber || '', teu: Number(j.teuTotal) || 0,
      prepaid: round(lines.filter((l) => l.side === 'revenue' && l.chargeType !== 'ccx').reduce((s, l) => s + Number(l.totalSellAmount || 0), 0)),
      collect: round(lines.filter((l) => l.side === 'revenue' && l.chargeType === 'ccx').reduce((s, l) => s + Number(l.totalSellAmount || 0), 0)),
      revenue, cost, collected, payable: round(revenue - cost),
    };
  });
};

const SOA_COLS = [
  { key: 'principal', label: 'Principal' }, { key: 'job', label: 'Job' }, { key: 'bl', label: 'BL' },
  { key: 'date', label: 'Date', type: 'date' }, { key: 'vessel', label: 'Vessel' }, { key: 'voyage', label: 'Voyage' },
  { key: 'teu', label: 'TEU', ...NUM }, { key: 'prepaid', label: 'Prepaid', ...MONEY }, { key: 'collect', label: 'Collect', ...MONEY },
  { key: 'cost', label: 'Agency Cost', ...MONEY }, { key: 'collected', label: 'Collected', ...MONEY }, { key: 'payable', label: 'Due to Principal', ...MONEY },
];
const soaTotals = (rows) => ['teu', 'prepaid', 'collect', 'cost', 'collected', 'payable'].reduce((t, k) => ({ ...t, [k]: sum(rows, k) }), {});
const soaDetail = (where, filter) => async (ctx) => {
  const rows = await soaJobs(ctx, where, filter);
  return { columns: SOA_COLS, rows, totals: soaTotals(rows) };
};

const soaSummary = async (ctx) => {
  const by = new Map();
  for (const r of await soaJobs(ctx, {})) {
    const g = by.get(r.principal) || { principal: r.principal, exportJobs: 0, importJobs: 0, teu: 0, revenue: 0, cost: 0, collected: 0, payable: 0 };
    if (r.direction === 'import') g.importJobs += 1; else g.exportJobs += 1;
    ['teu', 'revenue', 'cost', 'collected', 'payable'].forEach((k) => { g[k] += r[k]; });
    by.set(r.principal, g);
  }
  const rows = [...by.values()].map((g) => ({ ...g, revenue: round(g.revenue), cost: round(g.cost), collected: round(g.collected), payable: round(g.payable) }));
  return {
    columns: [
      { key: 'principal', label: 'Principal' }, { key: 'exportJobs', label: 'Export Jobs', ...NUM }, { key: 'importJobs', label: 'Import Jobs', ...NUM },
      { key: 'teu', label: 'TEU', ...NUM }, { key: 'revenue', label: 'Revenue', ...MONEY }, { key: 'cost', label: 'Cost', ...MONEY },
      { key: 'collected', label: 'Collected', ...MONEY }, { key: 'payable', label: 'Due to Principal', ...MONEY },
    ],
    rows,
    totals: ['exportJobs', 'importJobs', 'teu', 'revenue', 'cost', 'collected', 'payable'].reduce((t, k) => ({ ...t, [k]: sum(rows, k) }), {}),
  };
};

const soaPendingDo = async (ctx) => {
  const rows = (await soaJobs(ctx, { shipmentType: 'import', doNumber: null }));
  return { columns: SOA_COLS, rows, totals: soaTotals(rows) };
};

// ── Operations > Container Maintenance Report ───────────────────────────────
const containerMaintenance = async (ctx) => {
  const lines = (await ctx.models.ChargeLine.findAll({
    where: { parentType: 'nvocc_job', isActive: true, chargeDescription: { [Op.like]: '%CONTAINER MAINTAINANCE%' } }, raw: true,
  }));
  const jobIds = [...new Set(lines.map((l) => l.parentId))];
  const list = jobIds.length ? await svc().labelsFor(ctx.models, 'job', await A.job.findAll({ where: { id: { [Op.in]: jobIds } }, raw: true })) : [];
  const byId = new Map(list.map((j) => [j.id, j]));
  const rows = lines.filter((l) => inWindow(ctx, l.createdAt)).map((l) => {
    const j = byId.get(l.parentId) || { _labels: {} };
    return {
      job: j.name, bl: j.hblNumber || '', customer: j._labels.customerId || '', date: day(l.createdAt),
      charge: l.chargeDescription, currency: l.sellCurrency, rate: round(l.sellAmountRate), amount: round(l.totalSellAmount),
      invoiced: round(l.invoicedAmount), status: l.billingStatus,
    };
  });
  return {
    columns: [
      { key: 'job', label: 'Job' }, { key: 'bl', label: 'BL' }, { key: 'customer', label: 'Customer' }, { key: 'date', label: 'Date', type: 'date' },
      { key: 'charge', label: 'Charge' }, { key: 'currency', label: 'Cur' }, { key: 'rate', label: 'Rate', ...NUM },
      { key: 'amount', label: 'Amount (AED)', ...MONEY }, { key: 'invoiced', label: 'Invoiced', ...MONEY }, { key: 'status', label: 'Billing' },
    ],
    rows,
    totals: { amount: sum(rows, 'amount'), invoiced: sum(rows, 'invoiced') },
  };
};

// ── Accounting ──────────────────────────────────────────────────────────────
const accountPrincipalSoa = async (ctx) => {
  const by = new Map();
  const list = await jobs(ctx);
  const charges = await chargesFor(ctx, list.map((j) => j.id));
  for (const j of list) {
    const k = j._labels.principalId || 'No principal';
    const g = by.get(k) || { principal: k, jobs: 0, invoiced: 0, received: 0, billed: 0, receivable: 0 };
    const lines = charges.get(j.id) || [];
    g.jobs += 1;
    g.invoiced += lines.filter((l) => l.side === 'revenue').reduce((s, l) => s + Number(l.invoicedAmount || 0), 0);
    g.billed += lines.filter((l) => l.side === 'cost').reduce((s, l) => s + Number(l.billedAmount || 0), 0);
    g.received += Number(j.receivedRevenue) || 0;
    by.set(k, g);
  }
  const rows = [...by.values()].map((g) => ({
    ...g, invoiced: round(g.invoiced), billed: round(g.billed), received: round(g.received), balance: round(g.invoiced - g.billed),
  }));
  return {
    columns: [
      { key: 'principal', label: 'Principal' }, { key: 'jobs', label: 'Jobs', ...NUM },
      { key: 'invoiced', label: 'Invoiced to Customers', ...MONEY }, { key: 'billed', label: 'Billed by Principal', ...MONEY },
      { key: 'balance', label: 'Net Balance', ...MONEY },
    ],
    rows,
    totals: ['jobs', 'invoiced', 'billed', 'balance'].reduce((t, k) => ({ ...t, [k]: sum(rows, k) }), {}),
  };
};

const invoicesVesselVoyage = async (ctx) => {
  const moves = (await ctx.models.AccountMove.findAll({
    where: { moveType: { [Op.in]: ['out_invoice', 'out_refund'] } }, raw: true,
  })).filter((m) => inWindow(ctx, m.invoiceDate || m.createdAt));
  const list = await svc().labelsFor(ctx.models, 'job', await A.job.findAll({ raw: true }));
  const byName = new Map(list.map((j) => [j.name, j]));
  const rows = [];
  for (const m of moves) {
    const refs = typeof m.serviceJobRefs === 'string' ? JSON.parse(m.serviceJobRefs || '[]') : (m.serviceJobRefs || []);
    const job = refs.map((r) => byName.get(r)).find(Boolean);
    if (!job) continue;
    const sign = m.moveType === 'out_refund' ? -1 : 1;
    rows.push({
      vessel: job._labels.vesselId || '', voyage: job.voyageNumber || '', invoice: m.name, date: day(m.invoiceDate),
      customer: m.partner, job: job.name, bl: job.hblNumber || '', state: m.state,
      total: round(sign * Number(m.amountTotal || 0)), outstanding: round(sign * Number(m.state === 'posted' ? m.amountResidual : 0)),
    });
  }
  rows.sort((a, b) => `${a.vessel}${a.voyage}`.localeCompare(`${b.vessel}${b.voyage}`));
  return {
    columns: [
      { key: 'vessel', label: 'Vessel' }, { key: 'voyage', label: 'Voyage' }, { key: 'invoice', label: 'Invoice' },
      { key: 'date', label: 'Date', type: 'date' }, { key: 'customer', label: 'Customer' }, { key: 'job', label: 'Job' },
      { key: 'bl', label: 'BL' }, { key: 'state', label: 'Status' }, { key: 'total', label: 'Total', ...MONEY }, { key: 'outstanding', label: 'Outstanding', ...MONEY },
    ],
    rows,
    totals: { total: sum(rows, 'total'), outstanding: sum(rows, 'outstanding') },
  };
};

const R = (acl, title, build) => ({ acl, title, build });
const detention = (l) => /detention/i.test(l.chargeDescription || '');

const AGENCY_REPORTS = {
  'nvocc-cro-operation': R('nvocc.pre.booking', 'CRO Report - Operation', croOperation),
  'nvocc-cro-customer': R('nvocc.pre.booking', 'CRO Report - Customer Summary', croCustomer),
  'nvocc-freight-manifest': R('nvocc.service.job', 'Freight Manifest', freightManifest),
  'nvocc-freight-summary': R('nvocc.service.job', 'Freight Summary', freightSummary),
  'nvocc-freight-recapitulation': R('nvocc.service.job', 'Freight Recapitulation', freightRecap),
  'nvocc-op-vessel': R('nvocc.service.job', 'Operation Report - Vessel', opVessel),
  'nvocc-op-container': R('nvocc.service.job', 'Operation Report - Container', opContainer),
  'nvocc-op-loading': R('nvocc.service.job', 'Operation Report - Loading List', opLoading),
  'nvocc-op-job-list': R('nvocc.service.job', 'Operation Report - Job List', opJobList),
  'nvocc-op-job-statistics': R('nvocc.service.job', 'Operation Report - Job Statistics', opJobStatistics),
  'nvocc-op-do-status': R('nvocc.service.job', 'Operation Report - D/O Status', opDoStatus),
  'nvocc-soa-summary': R('nvocc.service.job', 'Principal SOA - Summary', soaSummary),
  'nvocc-soa-export': R('nvocc.service.job', 'Principal SOA - Export', soaDetail({ shipmentType: 'export' })),
  'nvocc-soa-import': R('nvocc.service.job', 'Principal SOA - Import', soaDetail({ shipmentType: 'import' })),
  'nvocc-soa-detention': R('nvocc.service.job', 'Principal SOA - Detention', soaDetail({}, detention)),
  'nvocc-soa-pending-do': R('nvocc.service.job', 'Principal SOA - Pending D/O', soaPendingDo),
  'nvocc-container-maintenance': R('nvocc.service.job', 'Container Maintenance Report', containerMaintenance),
  'nvocc-account-principal-soa': R('invoice', 'Principal SOA Summary', accountPrincipalSoa),
  'nvocc-invoices-vessel-voyage': R('invoice', 'Invoices List: Vessel / Voyage wise', invoicesVesselVoyage),
};

module.exports = { AGENCY_REPORTS };
