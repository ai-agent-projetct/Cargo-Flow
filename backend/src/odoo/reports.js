// Report wizards of the Agency clone (Booking/Operations/Accounting >
// Reporting). Each wizard's Print button reads the wizard's own fields and
// answers with an XLSX, as upstream does.
const XLSX = require('xlsx');
const { Op } = require('sequelize');
const R = require('./registry');
const { button } = require('./methods');

const orm = () => require('./orm');
const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const r2 = (v) => Math.round(n(v) * 100) / 100;
const id = (v) => (Array.isArray(v) ? v[0] : v);
const label = (v) => (Array.isArray(v) ? v[1] : (v === false || v == null ? '' : v));
const day = (v) => (v ? String(v).slice(0, 10) : '');

const xlsx = (title, columns, rows, totals = null) => {
  const head = columns.map(([, h]) => h);
  const body = rows.map((r) => columns.map(([k]) => (r[k] === undefined || r[k] === false || r[k] === null ? '' : r[k])));
  const data = [[title], [`Printed ${new Date().toISOString().replace('T', ' ').slice(0, 16)}`], [], head, ...body];
  if (totals) data.push(columns.map(([k], i) => (i === 0 ? 'Total' : (totals[k] ?? ''))));
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = columns.map(([, h]) => ({ wch: Math.max(10, String(h).length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '));
  return {
    type: 'cf.download',
    download: {
      filename: `${title.replace(/[^\w]+/g, '_')}.xlsx`,
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      encoding: 'base64',
      content: XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }),
    },
  };
};
const sum = (rows, keys) => Object.fromEntries(keys.map((k) => [k, r2(rows.reduce((s, r) => s + n(r[k]), 0))]));

const wizard = async (m, ids) => (await orm().read(m, [ids[0]]))[0] || {};
const between = (field, w) => [
  ...(w.date_from || w.from_date ? [[field, '>=', w.date_from || w.from_date]] : []),
  ...(w.date_to || w.to_date ? [[field, '<=', w.date_to || w.to_date]] : []),
];
const ids2 = (v) => (Array.isArray(v) ? v.map(id) : []);

// ── Jobs in a wizard's scope ─────────────────────────────────────────────────
const JOB_FIELDS = ['name', 'shipment_date', 'sailing_date', 'shipment_type_id', 'hbl_number', 'customer_id', 'principal_id', 'origin_port_un_location_id', 'destination_port_un_location_id', 'vessel_id', 'voyage_number', 'teu_total', 'state', 'estimated_revenue', 'estimated_cost', 'received_revenue', 'do_number', 'do_date', 'do_validity', 'eta_time', 'container_ownership', 'paid_cost', 'payment_terms', 'pack_unit', 'gross_weight_unit', 'volume_unit', 'description', 'index_number'];
const jobsFor = async (w, extra = []) => {
  const dateField = w.based_on === 'sailing_arrival' ? 'sailing_date' : 'shipment_date';
  const domain = [...between(dateField, w), ...extra];
  if (id(w.vessel_id)) domain.push(['vessel_id', '=', id(w.vessel_id)]);
  if (ids2(w.vessel_ids).length) domain.push(['vessel_id', 'in', ids2(w.vessel_ids)]);
  if (w.voyage_number) domain.push(['voyage_number', '=', w.voyage_number]);
  if (id(w.shipment_type_id)) domain.push(['shipment_type_id', '=', id(w.shipment_type_id)]);
  if (id(w.principal_id)) domain.push(['principal_id', '=', id(w.principal_id)]);
  if (id(w.partner_id)) domain.push(['principal_id', '=', id(w.partner_id)]);
  if (ids2(w.customer_ids).length) domain.push(['customer_id', 'in', ids2(w.customer_ids)]);
  if (ids2(w.responsible_ids).length) domain.push(['user_id', 'in', ids2(w.responsible_ids)]);
  if (ids2(w.origin_port_un_location_ids).length) domain.push(['origin_port_un_location_id', 'in', ids2(w.origin_port_un_location_ids)]);
  if (ids2(w.destination_port_un_location_ids).length) domain.push(['destination_port_un_location_id', 'in', ids2(w.destination_port_un_location_ids)]);
  if (id(w.origin_port_un_location_id)) domain.push(['origin_port_un_location_id', '=', id(w.origin_port_un_location_id)]);
  if (id(w.destination_port_un_location_id)) domain.push(['destination_port_un_location_id', '=', id(w.destination_port_un_location_id)]);
  if (id(w.shipping_line_id)) domain.push(['shipping_line_id', '=', id(w.shipping_line_id)]);
  if (id(w.job_type_id)) domain.push(['job_type_id', '=', id(w.job_type_id)]);
  if (ids2(w.nvocc_service_job_ids || w.service_job_ids).length) domain.push(['id', 'in', ids2(w.nvocc_service_job_ids || w.service_job_ids)]);
  if (ids2(w.job_manifest_ids).length) domain.push(['job_manifest_id', 'in', ids2(w.job_manifest_ids)]);
  if (w.container_ownership && w.container_ownership !== 'all') domain.push(['container_ownership', '=', w.container_ownership]);
  if (id(w.team_id)) domain.push(['team_id', '=', id(w.team_id)]);
  if (id(w.sale_agent_id)) domain.push(['sale_agent_id', '=', id(w.sale_agent_id)]);
  if (w.egm_number) domain.push(['egm_number', '=', w.egm_number]);
  if (w.hbl_number) domain.push(['hbl_number', 'ilike', w.hbl_number]);
  return orm().searchRead('nvocc.service.job', domain, JOB_FIELDS, { order: 'shipment_date desc' });
};
const isImport = (j) => /import|IMP/i.test(label(j.shipment_type_id)) || id(j.shipment_type_id) === 2;
const containersOf = async (jobs) => {
  if (!jobs.length) return [];
  return orm().searchRead('nvocc.shipment.container', [['nvocc_service_job_id', 'in', jobs.map((j) => j.id)]], ['nvocc_service_job_id', 'container_number', 'container_type_id', 'soc', 'seal_number', 'weight_unit', 'no_of_teu', 'is_empty_container']);
};

// ── Operations > Reporting > Operation Report ────────────────────────────────
button('wizard.operation.report', 'print_report', async (ids) => {
  const w = await wizard('wizard.operation.report', ids);
  const type = w.operation_report || 'job_list';
  const jobs = await jobsFor(w);
  const byId = new Map(jobs.map((j) => [j.id, j]));
  if (type === 'vessel') {
    const g = new Map();
    for (const j of jobs) {
      const k = `${label(j.vessel_id)}|${j.voyage_number || ''}`;
      const x = g.get(k) || { vessel: label(j.vessel_id), voyage: j.voyage_number, exp: 0, expTeu: 0, imp: 0, impTeu: 0 };
      if (isImport(j)) { x.imp += 1; x.impTeu += n(j.teu_total); } else { x.exp += 1; x.expTeu += n(j.teu_total); }
      g.set(k, x);
    }
    const rows = [...g.values()];
    return xlsx('Operation Report - Vessel', [['vessel', 'Vessel'], ['voyage', 'Voyage'], ['exp', 'Export Jobs'], ['expTeu', 'Export TEU'], ['imp', 'Import Jobs'], ['impTeu', 'Import TEU']], rows, sum(rows, ['exp', 'expTeu', 'imp', 'impTeu']));
  }
  if (type === 'container' || type === 'loading') {
    let boxes = await containersOf(type === 'loading' ? jobs.filter((j) => !isImport(j)) : jobs);
    if (w.empty_container === 'empty') boxes = boxes.filter((b) => b.is_empty_container);
    if (w.empty_container === 'laden') boxes = boxes.filter((b) => !b.is_empty_container);
    const rows = boxes.map((b) => {
      const j = byId.get(id(b.nvocc_service_job_id)) || {};
      return { container: b.container_number, type: label(b.container_type_id), soc: b.soc, seal: b.seal_number, job: j.name, bl: j.hbl_number, dir: label(j.shipment_type_id), pol: label(j.origin_port_un_location_id), pod: label(j.destination_port_un_location_id), vessel: label(j.vessel_id), voyage: j.voyage_number, weight: r2(b.weight_unit), status: b.is_empty_container ? 'Empty' : 'Laden' };
    });
    return xlsx(type === 'loading' ? 'Loading List' : 'Operation Report - Container', [['container', 'Container No'], ['type', 'Type'], ['soc', 'SOC'], ['seal', 'Seal No'], ['status', 'Full/Empty'], ['job', 'Job No'], ['bl', 'BL No'], ['dir', 'Shipment Type'], ['pol', 'POL'], ['pod', 'POD'], ['vessel', 'Vessel'], ['voyage', 'Voyage'], ['weight', 'Weight']], rows, sum(rows, ['weight']));
  }
  if (type === 'job_statistics') {
    const states = (R.fieldsOf('nvocc.service.job').state || {}).selection || [];
    const rows = states.map(([k, l]) => ({ state: l, exp: jobs.filter((j) => j.state === k && !isImport(j)).length, imp: jobs.filter((j) => j.state === k && isImport(j)).length, teu: jobs.filter((j) => j.state === k).reduce((s, j) => s + n(j.teu_total), 0) })).filter((r) => r.exp || r.imp);
    rows.forEach((r) => { r.total = r.exp + r.imp; });
    return xlsx('Operation Report - Job Statistics', [['state', 'Status'], ['exp', 'Export'], ['imp', 'Import'], ['total', 'Total'], ['teu', 'TEU']], rows, sum(rows, ['exp', 'imp', 'total', 'teu']));
  }
  if (type === 'do_status') {
    let rows = jobs.filter(isImport).map((j) => ({ job: j.name, bl: j.hbl_number, customer: label(j.customer_id), vessel: label(j.vessel_id), voyage: j.voyage_number, eta: day(j.eta_time || j.sailing_date), do: j.do_number, doDate: day(j.do_date), valid: day(j.do_validity), status: j.do_number ? 'Issued' : 'Pending' }));
    if (w.do_status === 'issued') rows = rows.filter((r) => r.do);
    if (w.do_status === 'pending') rows = rows.filter((r) => !r.do);
    return xlsx('Operation Report - DO Status', [['job', 'Job No'], ['bl', 'BL No'], ['customer', 'Consignee'], ['vessel', 'Vessel'], ['voyage', 'Voyage'], ['eta', 'Arrival'], ['do', 'D/O No'], ['doDate', 'D/O Date'], ['valid', 'Valid Till'], ['status', 'D/O Status']], rows);
  }
  if (type === 'receive_agreed') {
    const rows = jobs.map((j) => ({ job: j.name, bl: j.hbl_number, customer: label(j.customer_id), agreed: r2(j.estimated_revenue), received: r2(j.received_revenue), balance: r2(n(j.estimated_revenue) - n(j.received_revenue)) }));
    return xlsx('Operation Report - Receive vs Agreed', [['job', 'Job No'], ['bl', 'BL No'], ['customer', 'Customer'], ['agreed', 'Agreed'], ['received', 'Received'], ['balance', 'Balance']], rows, sum(rows, ['agreed', 'received', 'balance']));
  }
  const rows = jobs.map((j) => ({ job: j.name, date: day(j.shipment_date), dir: label(j.shipment_type_id), bl: j.hbl_number, customer: label(j.customer_id), principal: label(j.principal_id), pol: label(j.origin_port_un_location_id), pod: label(j.destination_port_un_location_id), vessel: label(j.vessel_id), voyage: j.voyage_number, teu: n(j.teu_total), state: j.state, revenue: r2(j.estimated_revenue), cost: r2(j.estimated_cost), margin: r2(n(j.estimated_revenue) - n(j.estimated_cost)) }));
  return xlsx('Operation Report - Job List', [['job', 'Job No'], ['date', 'Job Date'], ['dir', 'Shipment Type'], ['bl', 'BL No'], ['customer', 'Customer'], ['principal', 'Principal'], ['pol', 'POL'], ['pod', 'POD'], ['vessel', 'Vessel'], ['voyage', 'Voyage'], ['teu', 'TEU'], ['state', 'Status'], ['revenue', 'Revenue'], ['cost', 'Cost'], ['margin', 'Margin']], rows, sum(rows, ['teu', 'revenue', 'cost', 'margin']));
});

// ── Booking > Reporting > CRO Reports ────────────────────────────────────────
button('wizard.cro.customer.summary.report', 'print_report', async (ids) => {
  const w = await wizard('wizard.cro.customer.summary.report', ids);
  const domain = [...between('date', w)];
  if (id(w.vessel_id)) domain.push(['schedule_ids.vessel_id', '=', id(w.vessel_id)]);
  if (id(w.shipper_id)) domain.push(['client_id', '=', id(w.shipper_id)]);
  const pbs = await orm().searchRead('nvocc.pre.booking', domain, ['name', 'cro_no', 'date', 'client_id', 'port_of_loading_id', 'port_of_discharge_id', 'carrier_id', 'state', 'export_shipment_job_id', 'booking_expiry_date']);
  const lines = pbs.length ? await orm().searchRead('nvocc.pre.booking.container.lines', [['pre_booking_id', 'in', pbs.map((p) => p.id)]], ['pre_booking_id', 'container_type_id', 'count', 'teu']) : [];
  const per = (p) => lines.filter((l) => id(l.pre_booking_id) === p.id);
  if (w.report_type === 'customer_cro_report') {
    const g = new Map();
    for (const p of pbs) {
      const k = label(p.client_id) || 'Unassigned';
      const x = g.get(k) || { customer: k, bookings: 0, approved: 0, converted: 0, cancelled: 0, boxes: 0, teu: 0 };
      x.bookings += 1;
      if (p.state === 'accept') x.approved += 1;
      if (p.export_shipment_job_id) x.converted += 1;
      if (['cancel', 'expire', 'reject'].includes(p.state)) x.cancelled += 1;
      x.boxes += per(p).reduce((s, l) => s + n(l.count), 0);
      x.teu += per(p).reduce((s, l) => s + n(l.teu), 0);
      g.set(k, x);
    }
    const rows = [...g.values()];
    return xlsx('CRO Customer Summary Report', [['customer', 'Customer'], ['bookings', 'Bookings'], ['approved', 'Approved'], ['converted', 'Converted to Job'], ['cancelled', 'Cancelled/Expired'], ['boxes', 'Containers'], ['teu', 'TEU']], rows, sum(rows, ['bookings', 'approved', 'converted', 'cancelled', 'boxes', 'teu']));
  }
  const rows = pbs.map((p) => ({ cro: p.cro_no, booking: p.name, date: day(p.date), expiry: day(p.booking_expiry_date), customer: label(p.client_id), pol: label(p.port_of_loading_id), pod: label(p.port_of_discharge_id), line: label(p.carrier_id), equipment: per(p).map((l) => `${n(l.count)}x${label(l.container_type_id)}`).join(', '), boxes: per(p).reduce((s, l) => s + n(l.count), 0), teu: per(p).reduce((s, l) => s + n(l.teu), 0), state: p.state, job: label(p.export_shipment_job_id) }));
  return xlsx('CRO Operation Report', [['cro', 'CRO No'], ['booking', 'Booking No'], ['date', 'Date'], ['expiry', 'Expiry'], ['customer', 'Customer'], ['pol', 'POL'], ['pod', 'POD'], ['line', 'Shipping Line'], ['equipment', 'Equipment'], ['boxes', 'Containers'], ['teu', 'TEU'], ['state', 'Status'], ['job', 'Export Job']], rows, sum(rows, ['boxes', 'teu']));
});

// ── Principal SOA ────────────────────────────────────────────────────────────
const soaRows = async (w, extra = [], chargeFilter = () => true) => {
  const jobs = await jobsFor(w, extra);
  const out = [];
  for (const j of jobs) {
    const rev = await orm().searchRead('nvocc.revenue.charge', [['nvocc_service_job_id', '=', j.id]], ['charge_description', 'total_amount', 'charge_type', 'actual_invoiced_amount', 'amount_conversion_rate']);
    const det = await orm().searchRead('nvocc.detention.charge', [['nvocc_service_job_id', '=', j.id]], ['charge_description', 'total_amount', 'charge_type']).catch(() => []);
    const cost = await orm().searchRead('nvocc.cost.charge', [['nvocc_service_job_id', '=', j.id]], ['charge_description', 'total_amount']);
    const all = [...rev, ...det].filter(chargeFilter);
    const revenue = all.reduce((s, c) => s + n(c.total_amount), 0);
    const costT = cost.filter(chargeFilter).reduce((s, c) => s + n(c.total_amount), 0);
    out.push({ principal: label(j.principal_id) || 'No principal', job: j.name, bl: j.hbl_number, date: day(j.shipment_date), vessel: label(j.vessel_id), voyage: j.voyage_number, teu: n(j.teu_total), prepaid: r2(all.filter((c) => c.charge_type !== 'ccx').reduce((s, c) => s + n(c.total_amount), 0)), collect: r2(all.filter((c) => c.charge_type === 'ccx').reduce((s, c) => s + n(c.total_amount), 0)), cost: r2(costT), collected: r2(j.received_revenue), payable: r2(revenue - costT), dir: isImport(j) ? 'import' : 'export', do: j.do_number });
  }
  return out;
};
const SOA_COLS = [['principal', 'Principal'], ['job', 'Job No'], ['bl', 'BL No'], ['date', 'Date'], ['vessel', 'Vessel'], ['voyage', 'Voyage'], ['teu', 'TEU'], ['prepaid', 'Prepaid'], ['collect', 'Collect'], ['cost', 'Agency Cost'], ['collected', 'Collected'], ['payable', 'Due to Principal']];
button('wizard.principal.soa.report', 'print_report', async (ids) => {
  const w = await wizard('wizard.principal.soa.report', ids);
  const kind = w.principal_report || 'summary';
  const keys = ['teu', 'prepaid', 'collect', 'cost', 'collected', 'payable'];
  if (kind === 'summary') {
    const g = new Map();
    for (const r of await soaRows(w)) {
      const x = g.get(r.principal) || { principal: r.principal, exp: 0, imp: 0, teu: 0, prepaid: 0, collect: 0, cost: 0, collected: 0, payable: 0 };
      if (r.dir === 'import') x.imp += 1; else x.exp += 1;
      keys.forEach((k) => { x[k] = r2(x[k] + n(r[k])); });
      g.set(r.principal, x);
    }
    const rows = [...g.values()];
    return xlsx('Principal SOA - Summary', [['principal', 'Principal'], ['exp', 'Export Jobs'], ['imp', 'Import Jobs'], ...SOA_COLS.slice(6)], rows, sum(rows, ['exp', 'imp', ...keys]));
  }
  let rows;
  if (kind === 'export') rows = (await soaRows(w)).filter((r) => r.dir === 'export');
  else if (kind === 'import') rows = (await soaRows(w)).filter((r) => r.dir === 'import');
  else if (kind === 'detention') rows = await soaRows(w, [], (c) => /detention/i.test(c.charge_description || ''));
  else if (kind === 'pending_do') rows = (await soaRows(w)).filter((r) => r.dir === 'import' && !r.do);
  else rows = await soaRows(w, [], (c) => !/freight|detention/i.test(c.charge_description || ''));
  return xlsx(`Principal SOA - ${kind.replace(/_/g, ' ')}`, SOA_COLS, rows, sum(rows, keys));
});

// ── Operations > Reporting > Freight Manifest Report ─────────────────────────
button('wizard.freight.manifest.job.report', 'print_xls', async (ids) => {
  const w = await wizard('wizard.freight.manifest.job.report', ids);
  const jobs = await jobsFor({ ...w, date_from: w.from_date, date_to: w.to_date });
  const boxes = await containersOf(jobs);
  const kind = w.report_type || 'freight_manifest';
  if (kind === 'freight_recapitulation') {
    const g = new Map();
    for (const b of boxes) {
      const k = `${label(b.container_type_id)}|${b.soc}|${b.is_empty_container}`;
      const x = g.get(k) || { type: label(b.container_type_id), soc: b.soc === 'Y' ? 'SOC' : 'COC', status: b.is_empty_container ? 'Empty' : 'Laden', boxes: 0, teu: 0, weight: 0 };
      x.boxes += 1; x.teu += n(b.no_of_teu) || 1; x.weight = r2(x.weight + n(b.weight_unit));
      g.set(k, x);
    }
    const rows = [...g.values()];
    return xlsx('Freight Recapitulation', [['type', 'Container Type'], ['soc', 'Ownership'], ['status', 'Full/Empty'], ['boxes', 'Containers'], ['teu', 'TEU'], ['weight', 'Gross Weight']], rows, sum(rows, ['boxes', 'teu', 'weight']));
  }
  if (kind === 'freight_summary') {
    const g = new Map();
    for (const j of jobs) {
      const k = `${label(j.destination_port_un_location_id)}|${label(j.vessel_id)}|${j.voyage_number}`;
      const x = g.get(k) || { pod: label(j.destination_port_un_location_id), vessel: label(j.vessel_id), voyage: j.voyage_number, bls: 0, teu: 0, weight: 0, prepaid: 0, collect: 0 };
      x.bls += 1; x.teu += n(j.teu_total); x.weight = r2(x.weight + n(j.gross_weight_unit));
      if (j.payment_terms === 'ccx') x.collect = r2(x.collect + n(j.estimated_revenue)); else x.prepaid = r2(x.prepaid + n(j.estimated_revenue));
      g.set(k, x);
    }
    const rows = [...g.values()];
    return xlsx('Freight Summary', [['pod', 'Port of Discharge'], ['vessel', 'Vessel'], ['voyage', 'Voyage'], ['bls', 'BLs'], ['teu', 'TEU'], ['weight', 'Gross Weight'], ['prepaid', 'Prepaid Freight'], ['collect', 'Collect Freight']], rows, sum(rows, ['bls', 'teu', 'weight', 'prepaid', 'collect']));
  }
  const ordered = w.short_by === 'sequence' ? jobs.slice().sort((a, b) => String(a.index_number || '').localeCompare(String(b.index_number || ''))) : jobs.slice().sort((a, b) => String(a.hbl_number || '').localeCompare(String(b.hbl_number || '')));
  const rows = ordered.map((j) => {
    const mine = boxes.filter((b) => id(b.nvocc_service_job_id) === j.id);
    return { index: j.index_number, bl: j.hbl_number, job: j.name, customer: label(j.customer_id), pol: label(j.origin_port_un_location_id), pod: label(j.destination_port_un_location_id), containers: w.is_show_container === false ? '' : mine.map((b) => `${b.container_number || 'TBA'} ${label(b.container_type_id)}`).join('; '), teu: n(j.teu_total), packages: n(j.pack_unit), weight: r2(j.gross_weight_unit), cbm: r2(j.volume_unit), description: j.description, freight: j.payment_terms === 'ccx' ? 'COLLECT' : 'PREPAID' };
  });
  return xlsx('Freight Manifest', [['index', 'Index'], ['bl', 'BL No'], ['job', 'Job No'], ['customer', 'Consignee'], ['pol', 'POL'], ['pod', 'POD'], ['containers', 'Containers'], ['teu', 'TEU'], ['packages', 'Packages'], ['weight', 'Gross Weight'], ['cbm', 'CBM'], ['description', 'Description'], ['freight', 'Freight']], rows, sum(rows, ['teu', 'packages', 'weight', 'cbm']));
});

// ── Accounting reports (CargoFlo journal entries, agency scope) ──────────────
const moves = async (types, w, extra = {}) => {
  const { AccountMove } = require('../models');
  const where = { moveType: { [Op.in]: types }, ...extra };
  if (w.date_from || w.date_to) where.invoiceDate = { ...(w.date_from ? { [Op.gte]: w.date_from } : {}), ...(w.date_to ? { [Op.lte]: w.date_to } : {}) };
  return AccountMove.findAll({ where, order: [['invoiceDate', 'ASC']], raw: true });
};
const refs = (m) => (typeof m.serviceJobRefs === 'string' ? JSON.parse(m.serviceJobRefs || '[]') : (m.serviceJobRefs || []));

button('invoice.list.outstanding.report', 'print_report', async (ids) => {
  const w = await wizard('invoice.list.outstanding.report', ids);
  const list = await moves(['out_invoice', 'out_refund'], w);
  const jobs = await orm().searchRead('nvocc.service.job', [], ['name', 'hbl_number', 'vessel_id', 'voyage_number']);
  const byName = new Map(jobs.map((j) => [j.name, j]));
  const rows = [];
  for (const m of list) {
    const j = refs(m).map((x) => byName.get(x)).find(Boolean);
    if (!j) continue;
    if (id(w.vessel_id) && id(j.vessel_id) !== id(w.vessel_id)) continue;
    const sign = m.moveType === 'out_refund' ? -1 : 1;
    rows.push({ vessel: label(j.vessel_id), voyage: j.voyage_number, invoice: m.name, date: day(m.invoiceDate), customer: m.partner, job: j.name, bl: j.hbl_number, state: m.state, total: r2(sign * n(m.amountTotal)), outstanding: r2(sign * (m.state === 'posted' ? n(m.amountResidual) : 0)) });
  }
  return xlsx('Invoices List - Vessel Voyage wise', [['vessel', 'Vessel'], ['voyage', 'Voyage'], ['invoice', 'Invoice'], ['date', 'Date'], ['customer', 'Customer'], ['job', 'Job'], ['bl', 'BL'], ['state', 'Status'], ['total', 'Total'], ['outstanding', 'Outstanding']], rows, sum(rows, ['total', 'outstanding']));
});

button('wizard.customer.due.report', 'print_xlsx_report', async (ids) => {
  const w = await wizard('wizard.customer.due.report', ids);
  const list = (await moves(['out_invoice', 'out_debit'], w, { state: 'posted' })).filter((m) => n(m.amountResidual) > 0);
  const g = new Map();
  const today = Date.now();
  for (const m of list) {
    const x = g.get(m.partner) || { customer: m.partner, invoices: 0, current: 0, d30: 0, d60: 0, d90: 0, older: 0, total: 0 };
    const age = Math.floor((today - new Date(m.invoiceDateDue || m.invoiceDate || today)) / 86400000);
    const bucket = age <= 0 ? 'current' : age <= 30 ? 'd30' : age <= 60 ? 'd60' : age <= 90 ? 'd90' : 'older';
    x.invoices += 1; x[bucket] = r2(x[bucket] + n(m.amountResidual)); x.total = r2(x.total + n(m.amountResidual));
    g.set(m.partner, x);
  }
  const rows = [...g.values()];
  return xlsx('Customer Due Report', [['customer', 'Customer'], ['invoices', 'Invoices'], ['current', 'Not Due'], ['d30', '1-30'], ['d60', '31-60'], ['d90', '61-90'], ['older', '90+'], ['total', 'Total Due']], rows, sum(rows, ['invoices', 'current', 'd30', 'd60', 'd90', 'older', 'total']));
});

button('wizard.tax.payment.report', 'print_report', async (ids) => {
  const w = await wizard('wizard.tax.payment.report', ids);
  const list = await moves(['out_invoice', 'out_refund', 'in_invoice', 'in_refund'], w, { state: 'posted' });
  const rows = list.map((m) => ({ doc: m.name, date: day(m.invoiceDate), partner: m.partner, type: m.moveType, base: r2((/refund/.test(m.moveType) ? -1 : 1) * n(m.amountUntaxed)), tax: r2((/refund/.test(m.moveType) ? -1 : 1) * n(m.amountTax)), side: /^out/.test(m.moveType) ? 'Output VAT' : 'Input VAT' }));
  return xlsx('Tax Report', [['doc', 'Document'], ['date', 'Date'], ['partner', 'Partner'], ['side', 'Tax'], ['type', 'Type'], ['base', 'Taxable Amount'], ['tax', 'VAT']], rows, sum(rows, ['base', 'tax']));
});

const principalSoa = async (m, ids) => {
  const w = await wizard(m, ids);
  const rows = (await soaRows(w)).map((r) => ({ principal: r.principal, job: r.job, bl: r.bl, invoiced: r.collected, cost: r.cost, balance: r2(r.collected - r.cost) }));
  return xlsx('Accounting Principal SOA', [['principal', 'Principal'], ['job', 'Job No'], ['bl', 'BL No'], ['invoiced', 'Invoiced to Customers'], ['cost', 'Billed by Principal'], ['balance', 'Net Balance']], rows, sum(rows, ['invoiced', 'cost', 'balance']));
};
button('wizard.account.principal.soa.report', 'print_report', (ids) => principalSoa('wizard.account.principal.soa.report', ids));
button('account.principal.soa.summary', 'action_principal_soa_summary_excel', (ids) => principalSoa('account.principal.soa.summary', ids));

button('wiz.balance.confirmation.report', 'action_partner_balance_info', async (ids) => {
  const w = await wizard('wiz.balance.confirmation.report', ids);
  // The wizard names one partner; confirm that partner's balance.
  const list = await moves(['out_invoice', 'out_refund', 'out_debit', 'in_invoice', 'in_refund', 'in_debit'], w, { state: 'posted', ...(id(w.partner_id) ? { partnerId: String(id(w.partner_id)) } : {}) });
  const g = new Map();
  for (const m of list) {
    const x = g.get(m.partner) || { partner: m.partner, receivable: 0, payable: 0 };
    const sign = /refund/.test(m.moveType) ? -1 : 1;
    if (/^out/.test(m.moveType)) x.receivable = r2(x.receivable + sign * n(m.amountResidual)); else x.payable = r2(x.payable + sign * n(m.amountResidual));
    g.set(m.partner, x);
  }
  const rows = [...g.values()].map((x) => ({ ...x, net: r2(x.receivable - x.payable) }));
  return xlsx('Balance Confirmation', [['partner', 'Partner'], ['receivable', 'Receivable'], ['payable', 'Payable'], ['net', 'Net Balance']], rows, sum(rows, ['receivable', 'payable', 'net']));
});

button('wizard.bank.ledger.detail.report', 'print_report', async (ids) => {
  const w = await wizard('wizard.bank.ledger.detail.report', ids);
  const { AccountPayment } = require('../models');
  const where = {};
  if (w.date_from || w.date_to) where.date = { ...(w.date_from ? { [Op.gte]: w.date_from } : {}), ...(w.date_to ? { [Op.lte]: w.date_to } : {}) };
  const pays = await AccountPayment.findAll({ where, order: [['date', 'ASC']], raw: true }).catch(() => []);
  let bal = 0;
  const rows = pays.map((p) => {
    const inflow = p.paymentType === 'inbound' ? n(p.amount) : 0;
    const outflow = p.paymentType === 'outbound' ? n(p.amount) : 0;
    bal = r2(bal + inflow - outflow);
    return { date: day(p.date), ref: p.name, partner: p.partner || p.partnerName, journal: p.journal, debit: r2(inflow), credit: r2(outflow), balance: bal };
  });
  return xlsx('Bank Ledger - Detailed', [['date', 'Date'], ['ref', 'Reference'], ['partner', 'Partner'], ['journal', 'Journal'], ['debit', 'Debit'], ['credit', 'Credit'], ['balance', 'Balance']], rows, sum(rows, ['debit', 'credit']));
});

module.exports = { xlsx };
