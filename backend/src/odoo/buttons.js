// The header and smart buttons of the Agency forms, on the upstream field
// names. Where upstream opens a wizard this clone does not carry, the button
// returns a `cf.input` request (pick a status, type a reason, choose records)
// and the form calls back the `cf_*` method with the answer.
const { Op } = require('sequelize');
const R = require('./registry');
const { button, nextNumber } = require('./methods');

const orm = () => require('./orm');
const err = (status, message) => Object.assign(new Error(message), { statusCode: status });
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + (Number(n) || 0)); return x.toISOString().slice(0, 10); };
const yyyy = () => String(new Date().getFullYear());
const rows = async (m, ids) => R.MODELS[m].findAll({ where: { id: { [Op.in]: ids } }, raw: true });
const one = async (m, ids) => { const [r] = await rows(m, ids); if (!r) throw err(404, 'Record not found'); return r; };
const set = (m, ids, vals, ctx) => orm().write(m, ids, vals, ctx);
const actionFor = (m, extra = {}) => {
  const a = R.U.actions.find((x) => x.res_model === m);
  return { type: 'ir.actions.act_window', ...(a || {}), res_model: m, ...extra };
};
const input = (title, method, inp) => ({ type: 'cf.input', title, method, input: inp });
const states = (m, field = 'state') => (R.fieldsOf(m)[field] || {}).selection || [];
const download = (filename, mime, content) => ({ type: 'cf.download', download: { filename, mime, content } });
const refId = async (model, re) => {
  const r = (await R.OgRef.findAll({ where: { model }, raw: true })).find((x) => re.test(x.name || ''));
  return r ? r.ref_id : null;
};
const csv = (cols, data) => [cols.map((c) => c[1]).join(','), ...data.map((r) => cols.map(([k]) => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
const xml = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ── Pre Booking ──────────────────────────────────────────────────────────────
const PB = 'nvocc.pre.booking';
button(PB, 'action_change_status', async () => input('Change Status', 'cf_set_state', {
  kind: 'select', options: states(PB).filter(([k]) => ['draft', 'cro_generated', 'expire', 'cancel'].includes(k)),
}));
button(PB, 'cf_set_state', async (ids, kw, ctx) => {
  const r = await one(PB, ids);
  if (kw.value === 'cro_generated') {
    const lines = await R.MODELS['nvocc.pre.booking.container.lines'].count({ where: { pre_booking_id: String(r.id) } });
    if (!lines && r.packaging_mode !== 'package') throw err(422, 'Please add container details before generating the CRO.');
  }
  await set(PB, ids, { state: kw.value }, ctx);
});
button(PB, 'action_send_booking_internal_approval', async (ids, kw, ctx) => set(PB, ids, { state: 'to_approve' }, ctx));
button(PB, 'approve_booking_internal_team', async (ids, kw, ctx) => set(PB, ids, { state: 'accept', approving_user_id: ctx.uid }, ctx));
button(PB, 'reject_booking_internal_team', async () => input('Reject Booking', 'cf_reject', { kind: 'text', label: 'Reject Reason' }));
button(PB, 'cf_reject', async (ids, kw, ctx) => set(PB, ids, { state: 'reject', approver_reject_reason: kw.value }, ctx));
button(PB, 'action_toggle_edit_mode', async (ids, kw, ctx) => set(PB, ids, { state: 'edit_approved_job' }, ctx));
button(PB, 'action_open_export_jobs', async (ids) => {
  const jobs = await R.MODELS['nvocc.service.job'].findAll({ where: { pre_booking_id: String(ids[0]) }, attributes: ['id'], raw: true });
  return actionFor('nvocc.service.job', { id: 371, ...(jobs.length === 1 ? { res_id: jobs[0].id } : {}) });
});
button(PB, 'action_create_export_job', async (ids, kw, ctx) => {
  const b = await one(PB, ids);
  if (await R.MODELS['nvocc.service.job'].count({ where: { pre_booking_id: String(b.id) } })) throw err(409, 'An export job already exists for this booking.');
  const kg = await refId('uom.uom', /^kg$/i);
  const cbm = await refId('uom.uom', /^(m³|m3|cbm)$/i);
  const containers = await R.MODELS['nvocc.pre.booking.container.lines'].findAll({ where: { pre_booking_id: String(b.id) }, raw: true });
  const charges = await R.MODELS['nvocc.pre.booking.line'].findAll({ where: { pre_booking_id: String(b.id) }, raw: true }).catch(() => []);
  const containerCmds = [];
  for (const c of containers) {
    for (let i = 0; i < Math.max(1, Number(c.count) || 1); i += 1) {
      containerCmds.push([0, 0, {
        container_type_id: c.container_type_id, soc: 'N', quantity: 1,
        weight_unit_uom_id: kg, volume_unit_uom_id: cbm, weight_volume_unit_uom_id: kg, commodity_id: c.commodity,
      }]);
    }
  }
  const revenue = charges.map((l) => [0, 0, {
    product_id: l.product_id, charge_description: l.service_name, quantity: l.quantity || 1, uom_id: l.uom_id,
    measurement_basis_id: l.measurement_basis_id, amount_currency_id: l.sell_currency_id || l.amount_currency_id,
    amount_conversion_rate: l.sell_conversion_rate || 1, amount_rate: l.sell_amount_rate, partner_id: l.debtor_partner_id || b.client_id,
    total_amount: l.total_sell_amount, pre_booking_line_id: l.id,
  }]);
  const jobId = await orm().create('nvocc.service.job', {
    shipment_type_id: b.shipment_type_id || 1, transport_mode_id: b.transport_mode_id, cargo_type_id: b.cargo_type_id,
    packaging_mode: b.packaging_mode, shipment_date: today(), customer_id: b.client_id, user_id: b.user_id || ctx.uid,
    company_id: b.company_id, currency_id: b.currency_id, team_id: b.team_id, service_mode_id: b.service_mode_id,
    inco_term_id: b.incoterm_id, origin_un_location_id: b.origin_un_location_id, origin_country_id: b.origin_country_id,
    destination_un_location_id: b.destination_un_location_id, destination_country_id: b.destination_country_id,
    origin_port_un_location_id: b.port_of_loading_id, destination_port_un_location_id: b.port_of_discharge_id,
    shipping_line_id: b.carrier_id, cro_no: b.cro_no, gate_pass_no: b.gate_pass_no, pre_booking_id: b.id,
    empty_depot_id: b.empty_depot_id, job_type_id: b.shipment_job_type_id, egm_number: b.egm_number, egm_date: b.egm_date,
    is_hazardous: b.is_dangerous_good, haz_class_id: b.haz_class_id, haz_un_number: b.haz_un_number,
    customer_reference_number: b.reference_number, pack_unit: b.pack_unit, gross_weight_unit: b.gross_weight_unit,
    net_weight_unit: b.net_weight_unit, volume_unit: b.volume_unit, goods_value_amount: b.goods_value,
    insurance_value_amount: b.insurance_value, state: 'created',
    container_ids: containerCmds, revenue_line_ids: revenue,
  }, ctx);
  await R.MODELS[PB].update({ export_shipment_job_id: String(jobId) }, { where: { id: b.id } });
  return actionFor('nvocc.service.job', { id: 371, res_id: jobId });
});

// ── Jobs ─────────────────────────────────────────────────────────────────────
const JOB = 'nvocc.service.job';
button(JOB, 'action_change_status', async () => input('Change Status', 'cf_set_state', { kind: 'select', options: states(JOB) }));
button(JOB, 'cf_set_state', async (ids, kw, ctx) => set(JOB, ids, { state: kw.value }, ctx));
button(JOB, 'action_request_for_direct_do', async (ids, kw, ctx) => set(JOB, ids, { state: 'request_for_do' }, ctx));
button(JOB, 'action_do_generate', async (ids, kw, ctx) => {
  const j = await one(JOB, ids);
  const doNo = j.do_number || await nextNumber(JOB, 'do_number', `DO-${yyyy()}-`, 5);
  await set(JOB, ids, { state: 'd_o_generated', do_number: doNo, do_date: today(), do_validity: j.do_validity || addDays(today(), j.free_days || 7) }, ctx);
});
const jobXml = async (jobs) => {
  const out = [];
  for (const j of jobs) {
    const [r] = await orm().read(JOB, [j.id], ['name', 'hbl_number', 'mbl_number', 'customer_id', 'principal_id', 'origin_port_un_location_id', 'destination_port_un_location_id', 'vessel_id', 'voyage_number', 'index_number', 'igm_number', 'pack_unit', 'gross_weight_unit', 'volume_unit', 'description', 'marksn_number', 'payment_terms']);
    const boxes = await orm().searchRead('nvocc.shipment.container', [['nvocc_service_job_id', '=', j.id]], ['container_number', 'container_type_id', 'seal_number', 'soc', 'weight_unit']);
    const n = (v) => (Array.isArray(v) ? v[1] : v || '');
    out.push(`  <shipment>\n    <JobNo>${xml(r.name)}</JobNo><BLNumber>${xml(r.hbl_number)}</BLNumber><MBLNumber>${xml(r.mbl_number)}</MBLNumber>\n    <Consignee>${xml(n(r.customer_id))}</Consignee><Principal>${xml(n(r.principal_id))}</Principal>\n    <PortOfLoading>${xml(n(r.origin_port_un_location_id))}</PortOfLoading><PortOfDischarge>${xml(n(r.destination_port_un_location_id))}</PortOfDischarge>\n    <Vessel>${xml(n(r.vessel_id))}</Vessel><Voyage>${xml(r.voyage_number)}</Voyage><IndexNo>${xml(r.index_number)}</IndexNo><IGMNo>${xml(r.igm_number)}</IGMNo>\n    <Packages>${r.pack_unit || 0}</Packages><GrossWeight>${r.gross_weight_unit || 0}</GrossWeight><Volume>${r.volume_unit || 0}</Volume>\n    <Description>${xml(r.description)}</Description><Marks>${xml(r.marksn_number)}</Marks><PaymentTerms>${xml(r.payment_terms)}</PaymentTerms>\n${boxes.map((c) => `    <container><ContainerNo>${xml(c.container_number)}</ContainerNo><ContainerType>${xml(n(c.container_type_id))}</ContainerType><SealNo>${xml(c.seal_number)}</SealNo><SOC>${xml(c.soc)}</SOC><GrossWeight>${c.weight_unit || 0}</GrossWeight></container>`).join('\n')}\n  </shipment>`);
  }
  return out.join('\n');
};
const manifestCsv = async (jobs) => {
  const data = [];
  for (const j of jobs) {
    const [r] = await orm().read(JOB, [j.id], ['index_number', 'name', 'hbl_number', 'customer_id', 'origin_port_un_location_id', 'destination_port_un_location_id', 'teu_total', 'pack_unit', 'gross_weight_unit', 'volume_unit', 'description', 'payment_terms']);
    const boxes = await orm().searchRead('nvocc.shipment.container', [['nvocc_service_job_id', '=', j.id]], ['container_number', 'container_type_id']);
    const n = (v) => (Array.isArray(v) ? v[1] : v || '');
    data.push({ ...r, customer: n(r.customer_id), pol: n(r.origin_port_un_location_id), pod: n(r.destination_port_un_location_id), boxes: boxes.map((c) => `${c.container_number || 'TBA'} ${n(c.container_type_id)}`).join('; '), freight: r.payment_terms === 'ccx' ? 'COLLECT' : 'PREPAID' });
  }
  return csv([['index_number', 'Index'], ['name', 'Job No'], ['hbl_number', 'BL No'], ['customer', 'Consignee'], ['pol', 'POL'], ['pod', 'POD'], ['boxes', 'Containers'], ['teu_total', 'TEU'], ['pack_unit', 'Packages'], ['gross_weight_unit', 'Gross Wt'], ['volume_unit', 'CBM'], ['description', 'Description'], ['freight', 'Freight']], data);
};
button(JOB, 'action_export_edi', async (ids) => { const j = await rows(JOB, ids); return download(`${j[0].name}.xml`, 'application/xml', `<?xml version="1.0" encoding="UTF-8"?>\n<shipments>\n${await jobXml(j)}\n</shipments>\n`); });
for (const [m, kind] of [['action_xls_report_freight_manifest', 'manifest'], ['action_xls_report_freight_summary', 'summary'], ['action_xls_report_freight_recapitulation', 'recapitulation']]) {
  button(JOB, m, async (ids) => { const j = await rows(JOB, ids); return download(`freight_${kind}_${j[0].name}.csv`, 'text/csv', await manifestCsv(j)); });
}
button(JOB, 'action_open_moves', async () => ({ type: 'cf.url', url: '/admin/accounting/customers/invoices' }));
button(JOB, 'action_container_activity', async (ids) => actionFor('container.activity', { domain: [['nvocc_service_job_id', '=', ids[0]]], context: { default_nvocc_service_job_id: ids[0] } }));
button(JOB, 'action_maintenance_request', async (ids) => actionFor('maintenance.request', { domain: [['job_id', '=', ids[0]]], context: { default_job_id: ids[0] } }));
button(JOB, 'action_open_deposit_view', async (ids) => actionFor('security.deposit', { domain: [['service_job_id', '=', ids[0]]], context: { default_service_job_id: ids[0] } }));

// ── Consolidation and Manifest: attach / detach jobs ────────────────────────
const attach = (m, fk, filter) => [
  async (ids) => {
    const r = await one(m, ids);
    return input('Attach Jobs', 'cf_attach', { kind: 'records', model: JOB, domain: [['shipment_type_id', '=', Number(r.shipment_type_id) || 2], [fk, '=', false], ...filter] });
  },
  async (ids, kw, ctx) => { await orm().write(JOB, (kw.value || []).map(Number), { [fk]: ids[0] }, ctx); await recount(m, fk, ids[0]); },
  async (ids) => input('Detach Jobs', 'cf_detach', { kind: 'records', model: JOB, domain: [[fk, '=', ids[0]]] }),
  async (ids, kw, ctx) => { await orm().write(JOB, (kw.value || []).map(Number), { [fk]: false }, ctx); await recount(m, fk, ids[0]); },
];
const recount = async (m, fk, id) => {
  const n = await R.MODELS[JOB].count({ where: { [fk]: String(id) } });
  const patch = { service_job_count: n };
  if (m === 'nvocc.master.service.job') patch.state = n ? 'attached_bl' : 'draft';
  await R.MODELS[m].update(patch, { where: { id } });
};
const MS = 'nvocc.master.service.job';
const [msA, msAc, msD, msDc] = attach(MS, 'parent_id', []);
button(MS, 'action_attach_import_jobs', msA); button(MS, 'cf_attach', msAc);
button(MS, 'action_detach_import_job', msD); button(MS, 'cf_detach', msDc);
button(MS, 'button_cancel', async (ids, kw, ctx) => set(MS, ids, { state: 'cancelled' }, ctx));
button(MS, 'action_service_job', async (ids) => actionFor(JOB, { id: 370, domain: [['parent_id', '=', ids[0]]] }));

const MAN = 'nvocc.manifest';
const [mA, mAc, mD, mDc] = attach(MAN, 'job_manifest_id', []);
button(MAN, 'action_attach_jobs', mA);
button(MAN, 'cf_attach', async (ids, kw, ctx) => {
  await mAc(ids, kw, ctx);
  const m = await one(MAN, ids);
  await orm().write(JOB, (kw.value || []).map(Number), { vessel_id: m.vessel_id, voyage_number: m.voyage_number, ...(m.igm_no ? { igm_number: m.igm_no, igm_date: m.igm_date } : {}), ...(m.vir_no ? { vir_no: m.vir_no } : {}) }, ctx);
});
button(MAN, 'action_detach_jobs', mD); button(MAN, 'cf_detach', mDc);
button(MAN, 'action_update_job_index', async (ids) => {
  const m = await one(MAN, ids);
  const jobs = await R.MODELS[JOB].findAll({ where: { job_manifest_id: String(m.id) }, order: [['hbl_number', 'ASC'], ['id', 'ASC']] });
  let i = Number(m.starting_index) || 1;
  for (const j of jobs) { await j.update({ index_number: String(i).padStart(3, '0'), igm_number: m.igm_no || j.igm_number, igm_date: m.igm_date || j.igm_date, vir_no: m.vir_no || j.vir_no }); i += 1; }
});
button(MAN, 'action_export_xml', async (ids) => {
  const m = await one(MAN, ids);
  const jobs = await R.MODELS[JOB].findAll({ where: { job_manifest_id: String(m.id) }, order: [['index_number', 'ASC']], raw: true });
  return download(`${String(m.name).replace(/\W+/g, '_')}.xml`, 'application/xml', `<?xml version="1.0" encoding="UTF-8"?>\n<manifest no="${xml(m.name)}" voyage="${xml(m.voyage_number)}" igm="${xml(m.igm_no)}">\n${await jobXml(jobs)}\n</manifest>\n`);
});
const manifestJobs = async (ids) => R.MODELS[JOB].findAll({ where: { job_manifest_id: String(ids[0]) }, order: [['index_number', 'ASC']], raw: true });
button(MAN, 'action_open_generate_weboc_form', async (ids) => {
  const m = await one(MAN, ids);
  const jobs = await manifestJobs(ids);
  await R.MODELS[JOB].update({ is_weboc_generated: true }, { where: { job_manifest_id: String(m.id) } });
  return download(`weboc_${String(m.name).replace(/\W+/g, '_')}.csv`, 'text/csv', await manifestCsv(jobs));
});
for (const kind of ['manifest', 'summary', 'recapitulation']) {
  button(MAN, `action_xls_report_freight_${kind}`, async (ids) => { const m = await one(MAN, ids); return download(`freight_${kind}_${String(m.name).replace(/\W+/g, '_')}.csv`, 'text/csv', await manifestCsv(await manifestJobs(ids))); });
}

// ── Tariff ───────────────────────────────────────────────────────────────────
button('charges.tariff', 'action_tariff_approve', async (ids, kw, ctx) => set('charges.tariff', ids, { state: 'approved' }, ctx));
button('charges.tariff', 'action_tariff_unapprove', async (ids, kw, ctx) => set('charges.tariff', ids, { state: 'unapproved' }, ctx));

// ── Maintenance & Repair ─────────────────────────────────────────────────────
const MR = 'maintenance.request';
button(MR, 'action_start', async (ids, kw, ctx) => {
  const r = await one(MR, ids);
  const checks = await R.MODELS['maintenance.request.checklist'].findAll({ where: { request_type_id: String(r.request_type_id) }, order: [['sequence', 'ASC']], raw: true });
  for (const c of checks) {
    const target = c.category === 'exterior' ? 'maintenance.request.checklist.exterior.result' : 'maintenance.request.checklist.interior.result';
    if (!R.MODELS[target]) continue;
    await R.MODELS[target].create({ request_id: String(r.id), checklist_id: String(c.id), checklist_category: c.category, checklist_display: c.name, is_ok: true, inspection_file: '' });
  }
  await set(MR, ids, { state: 'in_progress' }, ctx);
});
button(MR, 'action_submit', async (ids, kw, ctx) => set(MR, ids, { state: 'done' }, ctx));
button(MR, 'action_repair', async (ids, kw, ctx) => {
  const r = await one(MR, ids);
  const id = await orm().create('maintenance.repair.request', {
    name: `Repair ${r.name || r.request_number || ''}`.trim(), request_id: r.id, user_id: r.user_id || ctx.uid,
    request_user_id: ctx.uid, scheduled_date: addDays(today(), 1), company_id: r.company_id, state: 'draft',
  }, ctx);
  return actionFor('maintenance.repair.request', { res_id: id });
});
button(MR, 'action_repair_request_open', async (ids) => actionFor('maintenance.repair.request', { domain: [['request_id', '=', ids[0]]] }));
const RR = 'maintenance.repair.request';
button(RR, 'action_send_approval', async (ids, kw, ctx) => set(RR, ids, { state: 'to_approve' }, ctx));
button(RR, 'action_approve', async (ids, kw, ctx) => set(RR, ids, { state: 'approved', approved_date: today() }, ctx));
button(RR, 'action_reject', async () => input('Reject Repair', 'cf_reject', { kind: 'text', label: 'Reject Reason' }));
button(RR, 'cf_reject', async (ids, kw, ctx) => set(RR, ids, { state: 'rejected', reject_reason: kw.value }, ctx));
button(RR, 'action_cancel', async (ids, kw, ctx) => set(RR, ids, { state: 'cancelled' }, ctx));
button(RR, 'action_done', async (ids, kw, ctx) => set(RR, ids, { state: 'done' }, ctx));
const RJ = 'maintenance.repair.request.job';
for (const [m, s] of [['action_start', 'in_progress'], ['action_done', 'done'], ['action_stuck', 'stuck'], ['action_resume', 'in_progress']]) {
  button(RJ, m, async (ids, kw, ctx) => set(RJ, ids, { state: s }, ctx));
}

// ── Accounting additions ─────────────────────────────────────────────────────
const SD = 'security.deposit';
for (const [m, s] of [['action_confirm', 'confirmed'], ['action_deposit_posted', 'posted'], ['action_refund_deposit', 'refunded'], ['action_set_to_draft', 'draft']]) {
  button(SD, m, async (ids, kw, ctx) => set(SD, ids, { state: s }, ctx));
}
button('account.transfer.config', 'action_activate', async (ids, kw, ctx) => set('account.transfer.config', ids, { state: 'active' }, ctx));
button('account.transfer.config', 'action_disable', async (ids, kw, ctx) => set('account.transfer.config', ids, { state: 'disabled' }, ctx));
button('account.cheque.book', 'action_confirm_cheque_book', async (ids, kw, ctx) => set('account.cheque.book', ids, { state: 'confirm' }, ctx));
button('account.cheque.book', 'action_reset_to_draft', async (ids, kw, ctx) => set('account.cheque.book', ids, { state: 'draft' }, ctx));

// ── Counters the forms show (smart buttons) ─────────────────────────────────
const { registerCompute } = require('./orm');
const movesFor = async (job, types) => {
  const { AccountMove } = require('../models');
  const { sequelize } = AccountMove;
  // serviceJobRefs is a JSON array; LIKE does not match JSON columns.
  return AccountMove.count({
    where: {
      moveType: { [Op.in]: types },
      [Op.and]: sequelize.where(sequelize.fn('JSON_CONTAINS', sequelize.col('serviceJobRefs'), sequelize.fn('JSON_QUOTE', job.name || '')), 1),
    },
  });
};
registerCompute(JOB, 'invoice_count', (r) => movesFor(r, ['out_invoice']));
registerCompute(JOB, 'vendor_bill_count', (r) => movesFor(r, ['in_invoice']));
registerCompute(JOB, 'credit_note_count', (r) => movesFor(r, ['out_refund', 'in_refund']));
registerCompute(JOB, 'debit_note_count', (r) => movesFor(r, ['out_debit', 'in_debit']));
registerCompute(JOB, 'maintenance_request_count', (r) => (R.MODELS['maintenance.request'] ? R.MODELS['maintenance.request'].count({ where: { job_id: String(r.id) } }) : 0));
registerCompute(JOB, 'document_count', (r) => (R.MODELS['nvocc.service.job.document'] ? R.MODELS['nvocc.service.job.document'].count({ where: { service_job_id: String(r.id) } }).catch(() => 0) : 0));
registerCompute(JOB, 'deposit_amount', async (r) => {
  if (!R.MODELS['security.deposit']) return 0;
  const deps = await R.MODELS['security.deposit'].findAll({ where: { service_job_id: String(r.id) }, raw: true });
  return deps.reduce((s, d) => s + (Number(d.refundable_amount_currency_signed) || 0), 0);
});
registerCompute(PB, 'export_job_count', (r) => R.MODELS[JOB].count({ where: { pre_booking_id: String(r.id) } }));
const pbLineSum = (field) => async (r) => {
  if (!R.MODELS['nvocc.pre.booking.line']) return 0;
  const lines = await R.MODELS['nvocc.pre.booking.line'].findAll({ where: { pre_booking_id: String(r.id) }, attributes: [field], raw: true });
  return Math.round(lines.reduce((s, l) => s + (Number(l[field]) || 0), 0) * 100) / 100;
};
registerCompute(PB, 'estimated_total_cost', pbLineSum('total_cost_amount'));
registerCompute(PB, 'estimated_total_revenue', pbLineSum('total_sell_amount'));
registerCompute(MS, 'service_job_count', (r) => R.MODELS[JOB].count({ where: { parent_id: String(r.id) } }));
registerCompute(MAN, 'service_job_count', (r) => R.MODELS[JOB].count({ where: { job_manifest_id: String(r.id) } }));
registerCompute(MR, 'repair_request_count', (r) => R.MODELS[RR].count({ where: { request_id: String(r.id) } }));

module.exports = {};
