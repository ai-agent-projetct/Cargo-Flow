// Liner Agency workflow: the header buttons of each form, the numbers each
// record is given, and what saving one record does to the records it links to.
//
// Mirrors the Agency instance's buttons (fields_view_get of each form):
//   Pre Booking   Change Status / Send for Approval / Approve / Reject /
//                 Convert To Export Job / Edit Approved Job
//   Job           Change Status / Request D/O / D/O Generate / Export EDI /
//                 Freight Manifest  (+ Generate BL, Arrival Notice, Invoice)
//   Consolidation Attach Jobs / Detach Jobs / Cancel
//   Manifest      Export EDI / Attach Jobs / Detach Jobs / Update Job Index /
//                 Generate WeBOC
//   Tariff        Approve / UnApprove
//   Maintenance   Start / Create Repair Request / Submit
//   Repair        Send For Approval / Approve / Reject / Cancel / Mark As Done
const { Op } = require('sequelize');
const { AGENCY_MODELS: A } = require('./models');
const { RESOURCES } = require('./spec');
const { recalcLine } = require('../services/chargeRollup');
const containerNo = require('../utils/containerNumber');

const svc = () => require('./service');
const today = () => new Date().toISOString().slice(0, 10);
const yyyy = () => String(new Date().getFullYear());
const addDays = (d, n) => {
  const x = new Date(d || Date.now());
  x.setDate(x.getDate() + (Number(n) || 0));
  return x.toISOString().slice(0, 10);
};
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const money = (v) => Math.round(num(v) * 100) / 100;
const err = (status, message) => Object.assign(new Error(message), { statusCode: status });

// Company books in AED; the agency trades in USD.
const FX = { AED: 1, USD: 3.6725, EUR: 4.02, GBP: 4.65, PKR: 0.0132, INR: 0.044, SAR: 0.979 };
const fxOf = (c) => FX[String(c || 'AED').toUpperCase()] || 1;

const reloadParent = async (parentType, parentId) => {
  const { refreshParent } = require('../controllers/chargeLineController');
  return refreshParent(parentType, parentId);
};

/** One charge line on a job or booking, priced through the shared roll-up. */
const addCharge = async (models, parentType, parentId, side, c) => {
  const vat = num(c.taxRate);
  const taxes = vat ? [{ name: `VAT ${vat}%`, percent: vat }] : [];
  const base = {
    parentType, parentId, side,
    chargeCode: c.code || null,
    chargeDescription: c.description,
    quantity: num(c.quantity) || 1,
    uom: 'unit',
    measurementBasis: c.basis || null,
    containerType: c.containerType || null,
    chargeType: c.chargeType || 'ppx',
    chargeSource: c.source || 'erp',
    billingStatus: 'no',
    isActive: true,
    currency: c.currency || 'USD',
  };
  const priced = side === 'cost'
    ? { ...base, costCurrency: c.currency || 'USD', costConversionRate: fxOf(c.currency), costAmountRate: num(c.rate), creditorPartnerId: c.partnerId || null, supplierTaxes: taxes }
    : { ...base, sellCurrency: c.currency || 'USD', sellConversionRate: fxOf(c.currency), sellAmountRate: num(c.rate), debtorPartnerId: c.partnerId || null, taxes };
  return models.ChargeLine.create(recalcLine(priced));
};

// ── Numbers ──────────────────────────────────────────────────────────────────
const SEQUENCES = {
  'pre-booking': async (d) => ({
    name: await svc().nextNumber('pre-booking', 'name', `PB-SEA-${d.shipmentType === 'import' ? 'IMP' : 'EXP'}-${d.cargoType || 'FCL'}/${yyyy()}/`, 5),
    croNo: d.croNo || await svc().nextNumber('pre-booking', 'croNo', `${yyyy()}-`, 5),
    gatePassNo: d.gatePassNo || await svc().nextNumber('pre-booking', 'gatePassNo', `GP-${yyyy()}-`, 5),
  }),
  job: async (d) => ({
    name: await svc().nextNumber('job', 'name', `SEA-${d.shipmentType === 'import' ? 'I' : 'E'}-${d.cargoType || 'FCL'}-${yyyy()}-`, 5),
  }),
  consolidation: async () => ({ name: await svc().nextNumber('consolidation', 'name', `CONS-${yyyy()}-`, 5) }),
  manifest: async (d) => ({
    name: await svc().nextNumber('manifest', 'name', `${d.shipmentType === 'export' ? 'EXP' : 'IMP'}-MH-`, 5, `/${yyyy().slice(2)}`),
    year: yyyy(),
  }),
  'maintenance-request': async () => ({ requestNumber: await svc().nextNumber('maintenance-request', 'requestNumber', `MR/${yyyy()}/`, 5) }),
  'repair-request': async () => ({ repairRequestNumber: await svc().nextNumber('repair-request', 'repairRequestNumber', `RR/${yyyy()}/`, 5) }),
  'repair-job': async () => ({ repairJobNumber: await svc().nextNumber('repair-job', 'repairJobNumber', `RJ/${yyyy()}/`, 5) }),
  'security-deposit': async () => ({ name: await svc().nextNumber('security-deposit', 'name', `SD/${yyyy()}/`, 5) }),
};

// ── Before save: derived fields ──────────────────────────────────────────────
const beforeSave = async (key, data, before, ctx) => {
  const merged = { ...(before || {}), ...data };
  if (!before && SEQUENCES[key]) Object.assign(data, await SEQUENCES[key](merged));

  if (key === 'pre-booking' || key === 'job') {
    // Chargeable weight for sea freight is the greater of tonnes and CBM, in kg.
    const gw = num(merged.grossWeight);
    const cbm = num(merged.volume);
    data.chargeableKg = Math.max(gw, cbm * 1000);
  }

  if (key === 'container-line') {
    if (merged.containerTypeId) {
      const type = await A['container-type'].findByPk(merged.containerTypeId, { raw: true });
      data.noOfTeu = type ? num(type.teu) || 1 : 1;
    }
    const number = String(merged.containerNumber || '').trim().toUpperCase();
    if (number) {
      data.containerNumber = number;
      // The registry is the master list of boxes; a number typed on a job
      // that is not in it yet is added, owned by the job's principal.
      let reg = await A['container-registry'].findOne({ where: { name: number } });
      if (!reg) {
        const job = merged.jobId ? await A.job.findByPk(merged.jobId, { raw: true }) : null;
        const principalId = (job && job.principalId) || await defaultPrincipalId(ctx.models);
        reg = await A['container-registry'].create({
          name: number,
          containerTypeId: merged.containerTypeId,
          principalId,
          isoValid: containerNo.validate(number).valid,
          activityLog: [{ at: new Date().toISOString(), by: ctx.userName || 'System', message: `Registered from job ${job ? job.name : ''}` }],
        });
      }
      data.containerRegistryId = reg.id;
    }
  }

  if (key === 'container-registry' && merged.name) {
    data.name = String(merged.name).trim().toUpperCase();
    data.isoValid = containerNo.validate(data.name).valid;
  }

  if (key === 'repair-job') {
    if (!before && merged.repairActivityId && !num(merged.priceUnit)) {
      const act = await A['repair-activity'].findByPk(merged.repairActivityId, { raw: true });
      if (act) data.priceUnit = num(act.defaultPrice);
    }
    data.priceSubtotal = money(num(data.priceUnit ?? merged.priceUnit) * num(data.quantity ?? merged.quantity));
  }

  if (key === 'security-deposit') {
    data.balance = money(num(merged.amount) - num(merged.refundedAmount) - num(merged.adjustedAmount));
  }

  if (key === 'charges-tariff' && merged.validFrom && merged.validTo && merged.validTo < merged.validFrom) {
    throw err(422, 'Valid To must be on or after Valid From');
  }
  return data;
};

// ── After save: keep parents in step ─────────────────────────────────────────
const recountJob = async (jobId) => {
  if (!jobId) return;
  const lines = await A['container-line'].findAll({ where: { jobId }, raw: true });
  const teu = lines.reduce((s, l) => s + (num(l.noOfTeu) || 1), 0);
  const patch = { teuTotal: teu };
  const job = await A.job.findByPk(jobId);
  if (!job) return;
  if (job.autoUpdateWeightVolume && lines.length) {
    patch.grossWeight = lines.reduce((s, l) => s + num(l.grossWeight), 0);
    patch.netWeight = lines.reduce((s, l) => s + num(l.netWeight), 0);
    patch.volume = lines.reduce((s, l) => s + num(l.volume), 0);
    patch.packUnit = lines.reduce((s, l) => s + num(l.packages), 0);
    patch.chargeableKg = Math.max(patch.grossWeight, patch.volume * 1000);
  }
  await job.update(patch);
};

const recountLinks = async (key, fk, id) => {
  if (!id) return;
  const n = await A.job.count({ where: { [fk]: id } });
  const rec = await A[key].findByPk(id);
  if (!rec) return;
  const patch = { serviceJobCount: n };
  if (key === 'consolidation' && rec.state !== 'cancelled') patch.state = n ? 'attached_bl' : 'draft';
  await rec.update(patch);
};

const recountRepair = async (repairRequestId) => {
  if (!repairRequestId) return;
  const jobs = await A['repair-job'].findAll({ where: { repairRequestId }, raw: true });
  await A['repair-request'].update(
    { amountTotal: money(jobs.reduce((s, j) => s + num(j.priceSubtotal), 0)) },
    { where: { id: repairRequestId } },
  );
};

const recountDamage = async (requestId) => {
  if (!requestId) return;
  const damaged = await A['maintenance-check-result'].count({ where: { requestId, result: 'damaged' } });
  await A['maintenance-request'].update({ damageCount: damaged }, { where: { id: requestId } });
};

const recountDeposits = async (jobId) => {
  if (!jobId) return;
  const deps = await A['security-deposit'].findAll({ where: { jobId, state: { [Op.ne]: 'cancelled' } }, raw: true });
  const held = deps.filter((d) => d.state !== 'draft').reduce((s, d) => s + num(d.balance), 0);
  await A.job.update({ depositReceived: money(held) }, { where: { id: jobId } });
};

/** The newest activity for a box is what the registry shows as its status. */
const refreshContainer = async (containerId, justSaved = null) => {
  if (!containerId) return;
  const acts = await A['container-activity'].findAll({
    where: { containerId }, order: [['date', 'DESC'], ['createdAt', 'DESC']], raw: true,
  });
  await A['container-activity'].update({ isNewestActivity: false }, { where: { containerId } });
  // Timestamps are to the second, so two moves on the same day can tie; the
  // one just recorded is the newer.
  let latest = acts[0];
  if (latest && justSaved && justSaved.containerId === containerId && String(justSaved.date) >= String(latest.date)) {
    latest = acts.find((a) => a.id === justSaved.id) || latest;
  }
  if (latest) await A['container-activity'].update({ isNewestActivity: true }, { where: { id: latest.id } });
  await A['container-registry'].update({
    lastActivityTypeId: latest ? latest.activityTypeId : null,
    lastActivityDate: latest ? latest.date : null,
    lastStatus: latest ? latest.containerStatus : null,
  }, { where: { id: containerId } });
};

const afterSave = async (key, rec, before) => {
  if (key === 'container-line') {
    await recountJob(rec.jobId);
    if (before && before.jobId !== rec.jobId) await recountJob(before.jobId);
  }
  if (key === 'job') {
    for (const [k, fk] of [['consolidation', 'parentId'], ['manifest', 'manifestId']]) {
      await recountLinks(k, fk, rec[fk]);
      if (before && before[fk] !== rec[fk]) await recountLinks(k, fk, before[fk]);
    }
  }
  if (key === 'container-activity') {
    await refreshContainer(rec.containerId, rec);
    if (before && before.containerId !== rec.containerId) await refreshContainer(before.containerId);
  }
  if (key === 'repair-job') await recountRepair(rec.repairRequestId);
  if (key === 'maintenance-check-result') await recountDamage(rec.requestId);
  if (key === 'security-deposit') await recountDeposits(rec.jobId);
};

const afterDelete = async (key, rec) => {
  if (key === 'container-activity') return refreshContainer(rec.containerId);
  return afterSave(key, rec, null);
};

const guardDelete = async (key, rec, ctx) => {
  if (key === 'job') {
    if (['invoice_generated', 'payment_received', 'd_o_generated', 'completed'].includes(rec.state)) {
      return `Job ${rec.name} has been invoiced (${rec.state.replace(/_/g, ' ')}); cancel it instead of deleting.`;
    }
    const invoiced = await ctx.models.ChargeLine.count({
      where: { parentType: 'nvocc_job', parentId: rec.id, billingStatus: { [Op.in]: ['partial', 'fully_invoiced', 'fully_billed'] } },
    });
    if (invoiced) return `Job ${rec.name} has invoiced charges; cancel it instead of deleting.`;
  }
  if (key === 'pre-booking' && rec.exportJobId) return 'This booking has an export job; cancel it instead.';
  if (key === 'container-registry') {
    const used = await A['container-activity'].count({ where: { containerId: rec.id } })
      + await A['container-line'].count({ where: { containerRegistryId: rec.id } });
    if (used) return `Container ${rec.name} has ${used} activities/job lines and cannot be deleted.`;
  }
  if (key === 'container-type') {
    const used = await A['container-registry'].count({ where: { containerTypeId: rec.id } });
    if (used) return `${used} registered containers use this type.`;
  }
  if (key === 'charges-tariff' && rec.state === 'approved') return 'Unapprove the tariff before deleting it.';
  if (key === 'repair-request' && ['approved', 'in_progress', 'repaired', 'done'].includes(rec.state)) {
    return 'An approved repair request cannot be deleted; cancel it instead.';
  }
  if (key === 'security-deposit' && rec.state !== 'draft') return 'Only a draft deposit can be deleted.';
  return null;
};

const guardEdit = (key, rec) => {
  if (key === 'pre-booking' && ['accept', 'expire', 'cancel', 'reject'].includes(rec.state)) {
    return 'An approved, expired, cancelled or rejected booking is locked. Use "Edit Approved Job" to change an approved one.';
  }
  if (key === 'charges-tariff' && rec.state === 'approved') return 'Unapprove the tariff to edit it.';
  if (key === 'repair-request' && ['done', 'cancelled'].includes(rec.state)) return 'This repair request is closed.';
  return null;
};

const listScope = async (key, query) => {
  if (key === 'repair-job' && query.activeOnly === 'true') {
    const open = await A['repair-request'].findAll({ where: { state: { [Op.in]: ['approved', 'in_progress'] } }, attributes: ['id'], raw: true });
    return { repairRequestId: { [Op.in]: open.map((r) => r.id) } };
  }
  return null;
};

// ── Shared helpers for actions ───────────────────────────────────────────────
const defaultPrincipalId = async (models) => {
  const orgs = await models.Organization.findAll({ attributes: ['id', 'partyTypes', 'name'], raw: true });
  const p = orgs.find((o) => JSON.stringify(o.partyTypes || '').toLowerCase().includes('principal'));
  return p ? p.id : null;
};

const xmlEscape = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (cols, rows) => [cols.map((c) => csvCell(c[1])).join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c[0]])).join(','))].join('\n');

/** A job with its link labels and containers, as exports read it. */
const jobBundle = async (models, jobRow) => {
  const [job] = await svc().labelsFor(models, 'job', [jobRow]);
  const containers = await svc().labelsFor(models, 'container-line',
    await A['container-line'].findAll({ where: { jobId: job.id }, raw: true }));
  return { job, containers };
};

const jobXml = ({ job, containers }) => {
  const L = job._labels || {};
  const tag = (t, v) => (v === null || v === undefined || v === '' ? '' : `    <${t}>${xmlEscape(v)}</${t}>\n`);
  return '  <shipment>\n'
    + tag('JobNo', job.name) + tag('BLNumber', job.hblNumber) + tag('MBLNumber', job.mblNumber)
    + tag('ShipmentType', job.shipmentType) + tag('CargoType', job.cargoType)
    + tag('Customer', L.customerId) + tag('Principal', L.principalId)
    + tag('PortOfLoading', L.originPortId) + tag('PortOfDischarge', L.destinationPortId)
    + tag('PlaceOfReceipt', job.originLocation) + tag('PlaceOfDelivery', job.destinationLocation)
    + tag('Vessel', L.vesselId) + tag('Voyage', job.voyageNumber) + tag('ShippingLine', L.shippingLineId)
    + tag('IndexNo', job.indexNumber) + tag('IGMNo', job.igmNumber) + tag('Packages', job.packUnit)
    + tag('GrossWeight', job.grossWeight) + tag('Volume', job.volume) + tag('Description', job.description)
    + tag('MarksAndNumbers', job.marksnNumber) + tag('PaymentTerms', job.paymentTerms)
    + containers.map((c) => '    <container>\n'
      + tag('ContainerNo', c.containerNumber).replace(/^ {4}/, '      ')
      + tag('ContainerType', (c._labels || {}).containerTypeId).replace(/^ {4}/, '      ')
      + tag('SealNo', c.sealNumber).replace(/^ {4}/, '      ')
      + tag('SOC', c.soc).replace(/^ {4}/, '      ')
      + tag('Packages', c.packages).replace(/^ {4}/, '      ')
      + tag('GrossWeight', c.grossWeight).replace(/^ {4}/, '      ')
      + '    </container>\n').join('')
    + '  </shipment>\n';
};

const MANIFEST_COLS = [
  ['index', 'Index'], ['job', 'Job No'], ['bl', 'BL No'], ['customer', 'Consignee / Shipper'],
  ['pol', 'POL'], ['pod', 'POD'], ['containers', 'Containers'], ['teu', 'TEU'],
  ['packages', 'Packages'], ['grossWeight', 'Gross Wt (KG)'], ['volume', 'CBM'], ['description', 'Description'], ['terms', 'Freight'],
];
const manifestRows = async (models, jobs) => {
  const out = [];
  for (const j of jobs) {
    const { job, containers } = await jobBundle(models, j);
    out.push({
      index: job.indexNumber, job: job.name, bl: job.hblNumber, customer: job._labels.customerId,
      pol: job._labels.originPortId, pod: job._labels.destinationPortId,
      containers: containers.map((c) => `${c.containerNumber || 'TBA'} ${(c._labels || {}).containerTypeId || ''}`.trim()).join('; '),
      teu: job.teuTotal, packages: job.packUnit, grossWeight: job.grossWeight, volume: job.volume,
      description: job.description, terms: job.paymentTerms === 'ccx' ? 'COLLECT' : 'PREPAID',
    });
  }
  return out;
};

/** Draft invoice or bill pulled from a job's charges through the shared bridge. */
const draftDocument = async (models, job, moveType, ctx) => {
  const { resolveParents, buildInvoiceLines } = require('../services/chargeInvoicing');
  const partnerId = moveType === 'out_invoice' ? job.customerId : job.principalId;
  const partner = partnerId ? await models.Organization.findByPk(partnerId, { raw: true }) : null;
  const move = await models.AccountMove.create({
    moveType,
    partner: partner ? (partner.companyName || partner.name) : (moveType === 'out_invoice' ? 'Customer' : 'Vendor'),
    partnerId: partner ? partner.id : null,
    invoiceDate: today(),
    currency: 'AED',
    journal: moveType === 'out_invoice' ? 'Customer Invoices' : 'Vendor Bills',
    createdBy: ctx.userId || null,
  });
  const parents = await resolveParents(models, 'service_job', [job.id]);
  const { lines, skipped } = await buildInvoiceLines(models, move, parents);
  if (!lines.length) {
    await move.destroy();
    const what = moveType === 'out_invoice' ? 'revenue' : 'cost';
    throw err(409, skipped ? `Every ${what} charge on ${job.name} is already ${moveType === 'out_invoice' ? 'invoiced' : 'billed'}.` : `${job.name} has no ${what} charges to ${moveType === 'out_invoice' ? 'invoice' : 'bill'}.`);
  }
  await move.update({
    addChargesFrom: 'service_job', chargeServiceJobs: [job.name], serviceJobRefs: [job.name], lines,
    activityLog: [{ at: new Date().toISOString(), by: ctx.userName || 'System', message: `${lines.length} charges pulled from ${job.name}` }],
  });
  return move;
};

const STATE_ORDER = ['created', 'booked', 'confirmed', 'bl_generated', 'hbl_generated', 'custom_files_generated', 'arrival_notice', 'generate_weboc', 'invoice_generated', 'payment_received', 'request_for_do', 'd_o_generated', 'completed'];
const advanceTo = (current, target) => (STATE_ORDER.indexOf(current) < STATE_ORDER.indexOf(target) ? target : current);

/** Approved tariffs that apply to a job, best match first. */
const tariffsFor = async (job) => {
  const day = job.shipmentDate || today();
  const all = await A['charges-tariff'].findAll({ where: { state: 'approved' }, raw: true });
  return all.filter((t) => (!t.operation || t.operation === job.shipmentType)
    && (!t.clientId || t.clientId === job.customerId)
    && (!t.shippingLineId || t.shippingLineId === job.shippingLineId)
    && (!t.originPortId || t.originPortId === job.originPortId)
    && (!t.destinationPortId || t.destinationPortId === job.destinationPortId)
    && (!t.cargoType || t.cargoType === job.cargoType)
    && (!t.validFrom || t.validFrom <= day)
    && (!t.validTo || t.validTo >= day));
};

const assignCharges = async (rec, body, ctx) => {
  const job = rec.get({ plain: true });
  const tariffs = await tariffsFor(job);
  if (!tariffs.length) throw err(409, `No approved tariff matches ${job.name} (${job.shipmentType}, ${job.cargoType}).`);
  // A customer-specific tariff replaces the general one for the same side.
  const pick = (type) => {
    const ts = tariffs.filter((t) => t.tariffType === type);
    const specific = ts.filter((t) => t.clientId);
    return specific.length ? specific : ts;
  };
  const containers = await A['container-line'].findAll({ where: { jobId: job.id }, raw: true });
  const byType = containers.reduce((m, c) => m.set(c.containerTypeId, (m.get(c.containerTypeId) || 0) + 1), new Map());
  const teu = containers.reduce((s, c) => s + (num(c.noOfTeu) || 1), 0);
  const existing = await ctx.models.ChargeLine.findAll({ where: { parentType: 'nvocc_job', parentId: job.id, isActive: true }, raw: true });
  // A charge already on the job (copied from the booking, or assigned before)
  // is not added again; one with no container type covers every type.
  const seen = new Set(existing.map((l) => `${l.side}:${l.chargeCode}:${l.containerType || ''}`));
  const covered = new Set(existing.filter((l) => !l.containerType).map((l) => `${l.side}:${l.chargeCode}`));

  let added = 0;
  for (const [type, side, partnerId] of [['sell_tariff', 'revenue', job.customerId], ['buy_tariff', 'cost', job.principalId]]) {
    for (const t of pick(type)) {
      const lines = await A['tariff-line'].findAll({ where: { tariffId: t.id }, raw: true });
      for (const l of lines) {
        let qty = 1;
        if (l.measurementBasis === 'container') qty = l.containerTypeId ? (byType.get(l.containerTypeId) || 0) : containers.length;
        else if (l.measurementBasis === 'teu') qty = teu;
        if (!qty) continue;
        const typeLabel = l.containerTypeId ? ((await A['container-type'].findByPk(l.containerTypeId, { raw: true })) || {}).code : '';
        const sig = `${side}:${l.chargeCode}:${typeLabel || ''}`;
        if (seen.has(sig) || covered.has(`${side}:${l.chargeCode}`)) continue;
        seen.add(sig);
        await addCharge(ctx.models, 'nvocc_job', job.id, side, {
          code: l.chargeCode, description: l.chargeDescription, quantity: qty, rate: l.rate,
          currency: l.currency || t.currency, taxRate: l.taxRate, chargeType: l.chargeType,
          containerType: typeLabel || null, partnerId, source: 'tariff',
          basis: { container: 'Per Container', teu: 'Per TEU', bl: 'Per BL', shipment: 'Per Shipment' }[l.measurementBasis],
        });
        added += 1;
      }
    }
  }
  await reloadParent('nvocc_job', job.id);
  return { message: added ? `${added} charge lines assigned from ${tariffs.length} tariff(s)` : 'Charges were already assigned' };
};

const cloneChildren = async (from, fk, fromId, to, toFk, toId, map) => {
  const rows = await A[from].findAll({ where: { [fk]: fromId }, raw: true });
  for (const r of rows) await A[to].create({ ...map(r), [toFk]: toId });
  return rows.length;
};

// ── Actions ──────────────────────────────────────────────────────────────────
const stateIs = (...s) => (r) => s.includes(r.state);

const JOB_STATE_INPUT = [{ name: 'state', label: 'New Status', type: 'sel', required: true, options: RESOURCES.job.states }];

const ACTIONS = {
  'pre-booking': {
    'generate-cro': {
      label: 'Generate CRO', primary: true, when: stateIs('draft', 'edit_approved_job'),
      run: async (rec) => {
        const containers = await A['pre-booking-container'].count({ where: { preBookingId: rec.id } });
        if (!containers && rec.packagingMode === 'container') throw err(422, 'Add at least one container before generating the CRO.');
        await rec.update({ state: 'cro_generated' });
        return { message: `CRO ${rec.croNo} generated` };
      },
    },
    'send-for-approval': {
      label: 'Send for Approval', primary: true, when: (r) => r.state === 'cro_generated' && r.allowApproval,
      run: async (rec) => { await rec.update({ state: 'to_approve' }); return { message: 'Sent for internal approval' }; },
    },
    approve: {
      label: 'Approve', primary: true, when: (r) => r.state === 'to_approve' || (r.state === 'cro_generated' && !r.allowApproval),
      run: async (rec) => { await rec.update({ state: 'accept', approverRejectReason: null }); return { message: 'Booking approved' }; },
    },
    reject: {
      label: 'Reject', danger: true, when: stateIs('to_approve'),
      input: [{ name: 'reason', label: 'Reject Reason', type: 't', required: true }],
      run: async (rec, body) => { await rec.update({ state: 'reject', approverRejectReason: body.reason }); return { message: 'Booking rejected' }; },
    },
    'convert-to-export-job': {
      label: 'Convert To Export Job', primary: true, when: (r) => r.state === 'accept' && !r.exportJobId,
      run: async (rec, body, ctx) => {
        const b = rec.get({ plain: true });
        const job = await svc().create(ctx.models, 'job', {
          shipmentType: 'export', transportMode: b.transportMode || 'sea', cargoType: b.cargoType || 'FCL',
          packagingMode: b.packagingMode, shipmentDate: today(), customerId: b.clientId, teamId: b.teamId,
          userId: b.userId || ctx.userId, jobTypeId: b.shipmentJobTypeId, incoterm: b.incoterm, serviceMode: b.serviceMode,
          originLocation: b.originLocation, originPortId: b.portOfLoadingId, destinationPortId: b.portOfDischargeId,
          destinationLocation: b.destinationLocation, shippingLineId: b.carrierId, vesselId: b.vesselId,
          voyageNumber: b.voyageNumber, emptyDepotId: b.emptyDepotId, croNo: b.croNo, gatePassNo: b.gatePassNo,
          preBookingId: b.id, egmNumber: b.egmNumber, egmDate: b.egmDate, customerReferenceNumber: b.referenceNumber,
          packUnit: b.packUnit, grossWeight: b.grossWeight, netWeight: b.netWeight, volume: b.volume,
          isHazardous: b.isDangerousGood, hazClass: b.hazClass, hazUnNumber: b.hazUnNumber,
          goodsValueAmount: b.goodsValue, insuranceValueAmount: b.insuranceValue, termsConditions: b.note,
          principalId: await defaultPrincipalId(ctx.models), autoUpdateWeightVolume: false,
        }, ctx);
        // One container line per box booked.
        const boxes = await A['pre-booking-container'].findAll({ where: { preBookingId: b.id }, raw: true });
        for (const box of boxes) {
          for (let i = 0; i < Math.max(1, num(box.quantity)); i += 1) {
            await svc().create(ctx.models, 'container-line', {
              jobId: job.id, containerTypeId: box.containerTypeId, soc: box.soc || 'N',
              grossWeight: box.grossWeight, isHazardous: box.isHazardous, isRefrigerated: box.isRefrigerated, temperature: box.temperature,
            }, ctx);
          }
        }
        // The booking's agreed charges become the job's revenue.
        const lines = await ctx.models.ChargeLine.findAll({ where: { parentType: 'nvocc_pre_booking', parentId: b.id, isActive: true }, raw: true });
        for (const l of lines) {
          const { id, createdAt, updatedAt, ...rest } = l;
          await ctx.models.ChargeLine.create(recalcLine({
            ...rest, parentType: 'nvocc_job', parentId: job.id, side: 'revenue', billingStatus: 'no',
            invoicedAmount: 0, billedAmount: 0, receivedAmount: 0, creditNoteAmount: 0, creditNoteQty: 0,
            debtorPartnerId: rest.debtorPartnerId || b.clientId,
          }));
        }
        if (lines.length) await reloadParent('nvocc_job', job.id);
        await rec.update({ exportJobId: job.id });
        return { message: `Export job ${job.name} created`, redirect: { resource: 'job', id: job.id } };
      },
    },
    'edit-approved-job': {
      label: 'Edit Approved Job', when: (r) => r.state === 'accept' && !r.exportJobId,
      run: async (rec) => { await rec.update({ state: 'edit_approved_job' }); return { message: 'Booking reopened for editing' }; },
    },
    'change-status': {
      label: 'Change Status', when: (r) => !['accept', 'cancel', 'expire', 'reject', 'to_approve'].includes(r.state),
      input: [{ name: 'state', label: 'New Status', type: 'sel', required: true, options: [['draft', 'Draft'], ['expire', 'Expired'], ['cancel', 'Cancelled']] }],
      run: async (rec, body) => { await rec.update({ state: body.state }); return { message: 'Status changed' }; },
    },
    revise: {
      label: 'Revise Booking', when: stateIs('cancel', 'expire', 'reject'),
      run: async (rec, body, ctx) => {
        const b = rec.get({ plain: true });
        const { id, name, croNo, gatePassNo, state, exportJobId, activityLog, createdAt, updatedAt, ...rest } = b;
        const copy = await svc().create(ctx.models, 'pre-booking', { ...rest, date: today(), cancelledPreBookingId: b.id }, ctx);
        await cloneChildren('pre-booking-container', 'preBookingId', b.id, 'pre-booking-container', 'preBookingId', copy.id, ({ id: _i, createdAt: _c, updatedAt: _u, preBookingId: _p, ...r }) => r);
        await cloneChildren('pre-booking-cargo', 'preBookingId', b.id, 'pre-booking-cargo', 'preBookingId', copy.id, ({ id: _i, createdAt: _c, updatedAt: _u, preBookingId: _p, ...r }) => r);
        return { message: `Revised as ${copy.name}`, redirect: { resource: 'pre-booking', id: copy.id } };
      },
    },
  },

  job: {
    'generate-bl': {
      label: 'Generate BL', primary: true, when: (r) => r.shipmentType === 'export' && ['created', 'booked', 'confirmed'].includes(r.state),
      run: async (rec) => {
        const hbl = rec.hblNumber || await svc().nextNumber('job', 'hblNumber', `UNI${yyyy().slice(2)}`, 6);
        await rec.update({ hblNumber: hbl, state: 'bl_generated', placeOfIssueDate: rec.placeOfIssueDate || today() });
        return { message: `BL ${hbl} generated` };
      },
    },
    'arrival-notice': {
      label: 'Arrival Notice', primary: true, when: (r) => r.shipmentType === 'import' && ['created', 'bl_generated', 'custom_files_generated'].includes(r.state),
      run: async (rec) => {
        await rec.update({ state: 'arrival_notice' });
        await A['job-event'].create({ jobId: rec.id, eventName: 'Arrival Notice Sent', actualDate: new Date(), isDone: true, location: '' });
        return { message: 'Arrival notice issued' };
      },
    },
    'generate-invoice': {
      label: 'Generate Invoice', primary: true, when: (r) => !['cancelled'].includes(r.state),
      run: async (rec, body, ctx) => {
        const move = await draftDocument(ctx.models, rec.get({ plain: true }), 'out_invoice', ctx);
        await rec.update({ state: advanceTo(rec.state, 'invoice_generated') });
        return { message: `Draft invoice created with ${move.lines.length} lines`, link: `/admin/accounting/customers/invoices/${move.id}` };
      },
    },
    'generate-bill': {
      label: 'Create Vendor Bill', when: (r) => !['cancelled'].includes(r.state),
      run: async (rec, body, ctx) => {
        const move = await draftDocument(ctx.models, rec.get({ plain: true }), 'in_invoice', ctx);
        return { message: `Draft vendor bill created with ${move.lines.length} lines`, link: `/admin/accounting/vendors/bills/${move.id}` };
      },
    },
    'payment-received': {
      label: 'Payment Received', when: stateIs('invoice_generated'),
      run: async (rec) => { await rec.update({ state: 'payment_received' }); return { message: 'Payment recorded on the job' }; },
    },
    'request-do': {
      label: 'Request D/O Generate', primary: true,
      when: (r) => r.shipmentType === 'import' && ['arrival_notice', 'invoice_generated', 'payment_received'].includes(r.state),
      run: async (rec) => { await rec.update({ state: 'request_for_do' }); return { message: 'D/O requested' }; },
    },
    'generate-do': {
      label: 'D/O Generate', primary: true, when: (r) => r.shipmentType === 'import' && r.state === 'request_for_do',
      run: async (rec) => {
        const doNumber = await svc().nextNumber('job', 'doNumber', `DO-${yyyy()}-`, 5);
        await rec.update({ state: 'd_o_generated', doNumber, doDate: today(), doValidity: rec.doValidity || addDays(today(), rec.freeDays || 7) });
        await A['job-event'].create({ jobId: rec.id, eventName: `Delivery Order ${doNumber} issued`, actualDate: new Date(), isDone: true });
        return { message: `D/O ${doNumber} generated` };
      },
    },
    'assign-charges': {
      label: 'Charge Assignment', when: (r) => !['cancelled', 'completed'].includes(r.state),
      run: assignCharges,
    },
    'export-edi': {
      label: 'Export EDI', when: (r) => r.shipmentType !== 'import',
      run: async (rec, body, ctx) => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<shipments>\n${jobXml(await jobBundle(ctx.models, rec.get({ plain: true })))}</shipments>\n`;
        return { message: 'EDI exported', download: { filename: `${rec.name.replace(/\W+/g, '_')}.xml`, mime: 'application/xml', content: xml } };
      },
    },
    'freight-manifest': {
      label: 'Freight Manifest', when: (r) => r.shipmentType !== 'import',
      run: async (rec, body, ctx) => {
        const rows = await manifestRows(ctx.models, [rec.get({ plain: true })]);
        return { message: 'Freight manifest exported', download: { filename: `freight_manifest_${rec.name.replace(/\W+/g, '_')}.csv`, mime: 'text/csv', content: toCsv(MANIFEST_COLS, rows) } };
      },
    },
    'change-status': {
      label: 'Change Status', input: JOB_STATE_INPUT,
      run: async (rec, body) => { await rec.update({ state: body.state }); return { message: 'Status changed' }; },
    },
  },

  consolidation: {
    'attach-jobs': {
      label: 'Attach Jobs', primary: true, when: (r) => r.state !== 'cancelled',
      input: [{ name: 'jobIds', label: 'Jobs', type: 'm2m', ref: 'job', required: true, filter: { shipmentType: '$shipmentType', parentId: 'null' } }],
      run: async (rec, body, ctx) => {
        for (const id of body.jobIds) await svc().update(ctx.models, 'job', id, { parentId: rec.id, mblNumber: rec.mblNumber || undefined }, ctx);
        return { message: `${body.jobIds.length} job(s) attached` };
      },
    },
    'detach-jobs': {
      label: 'Detach Jobs', when: (r) => num(r.serviceJobCount) > 0,
      input: [{ name: 'jobIds', label: 'Jobs', type: 'm2m', ref: 'job', required: true, filter: { parentId: '$id' } }],
      run: async (rec, body, ctx) => {
        for (const id of body.jobIds) await svc().update(ctx.models, 'job', id, { parentId: null }, ctx);
        return { message: `${body.jobIds.length} job(s) detached` };
      },
    },
    cancel: {
      label: 'Cancel', danger: true, when: stateIs('draft'), confirm: 'Cancel this consolidation?',
      run: async (rec) => { await rec.update({ state: 'cancelled' }); return { message: 'Consolidation cancelled' }; },
    },
  },

  manifest: {
    'attach-jobs': {
      label: 'Attach Jobs', primary: true,
      input: [{ name: 'jobIds', label: 'Jobs', type: 'm2m', ref: 'job', required: true, filter: { shipmentType: '$shipmentType', manifestId: 'null' } }],
      run: async (rec, body, ctx) => {
        for (const id of body.jobIds) {
          await svc().update(ctx.models, 'job', id, {
            manifestId: rec.id, vesselId: rec.vesselId, voyageNumber: rec.voyageNumber,
            ...(rec.igmNo ? { igmNumber: rec.igmNo, igmDate: rec.igmDate } : {}), ...(rec.virNo ? { virNo: rec.virNo } : {}),
          }, ctx);
        }
        return { message: `${body.jobIds.length} job(s) attached` };
      },
    },
    'detach-jobs': {
      label: 'Detach Jobs', when: (r) => num(r.serviceJobCount) > 0,
      input: [{ name: 'jobIds', label: 'Jobs', type: 'm2m', ref: 'job', required: true, filter: { manifestId: '$id' } }],
      run: async (rec, body, ctx) => {
        for (const id of body.jobIds) await svc().update(ctx.models, 'job', id, { manifestId: null }, ctx);
        return { message: `${body.jobIds.length} job(s) detached` };
      },
    },
    'update-job-index': {
      label: 'Update Job Index', when: (r) => num(r.serviceJobCount) > 0,
      run: async (rec) => {
        const jobs = await A.job.findAll({ where: { manifestId: rec.id }, order: [['hblNumber', 'ASC'], ['name', 'ASC']] });
        let i = num(rec.startingIndex) || 1;
        for (const j of jobs) {
          await j.update({ indexNumber: String(i).padStart(3, '0'), igmNumber: rec.igmNo || j.igmNumber, igmDate: rec.igmDate || j.igmDate, virNo: rec.virNo || j.virNo });
          i += 1;
        }
        return { message: `${jobs.length} jobs indexed from ${rec.startingIndex || 1}` };
      },
    },
    'export-edi': {
      label: 'Export EDI',
      run: async (rec, body, ctx) => {
        const [m] = await svc().labelsFor(ctx.models, 'manifest', [rec.get({ plain: true })]);
        const jobs = await A.job.findAll({ where: { manifestId: rec.id }, order: [['indexNumber', 'ASC']], raw: true });
        let body_ = '';
        for (const j of jobs) body_ += jobXml(await jobBundle(ctx.models, j));
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<manifest no="${xmlEscape(m.name)}" vessel="${xmlEscape(m._labels.vesselId)}" voyage="${xmlEscape(m.voyageNumber)}" igm="${xmlEscape(m.igmNo)}">\n${body_}</manifest>\n`;
        await rec.update({ status: rec.status === 'draft' ? 'submitted' : rec.status });
        return { message: `Manifest EDI exported (${jobs.length} jobs)`, download: { filename: `${m.name.replace(/\W+/g, '_')}.xml`, mime: 'application/xml', content: xml } };
      },
    },
    'generate-weboc': {
      label: 'Generate WeBOC CSV', when: (r) => num(r.serviceJobCount) > 0,
      run: async (rec, body, ctx) => {
        const jobs = await A.job.findAll({ where: { manifestId: rec.id }, order: [['indexNumber', 'ASC']], raw: true });
        const rows = await manifestRows(ctx.models, jobs);
        await A.job.update({ isWebocGenerated: true }, { where: { manifestId: rec.id } });
        return { message: `WeBOC file generated for ${jobs.length} jobs`, download: { filename: `weboc_${rec.name.replace(/\W+/g, '_')}.csv`, mime: 'text/csv', content: toCsv(MANIFEST_COLS, rows) } };
      },
    },
    'freight-manifest': {
      label: 'Freight Manifest', when: (r) => r.shipmentType !== 'import',
      run: async (rec, body, ctx) => {
        const jobs = await A.job.findAll({ where: { manifestId: rec.id }, order: [['indexNumber', 'ASC']], raw: true });
        return { message: 'Freight manifest exported', download: { filename: `freight_manifest_${rec.name.replace(/\W+/g, '_')}.csv`, mime: 'text/csv', content: toCsv(MANIFEST_COLS, await manifestRows(ctx.models, jobs)) } };
      },
    },
    close: {
      label: 'Close Manifest', when: (r) => r.status !== 'closed',
      run: async (rec) => { await rec.update({ status: 'closed' }); return { message: 'Manifest closed' }; },
    },
  },

  'charges-tariff': {
    approve: {
      label: 'Approve', primary: true, when: (r) => r.state !== 'approved',
      run: async (rec) => {
        const lines = await A['tariff-line'].count({ where: { tariffId: rec.id } });
        if (!lines) throw err(422, 'Add at least one charge line before approving.');
        await rec.update({ state: 'approved' });
        return { message: 'Tariff approved' };
      },
    },
    unapprove: {
      label: 'UnApprove', when: (r) => r.state !== 'unapproved',
      run: async (rec) => { await rec.update({ state: 'unapproved' }); return { message: 'Tariff unapproved' }; },
    },
  },

  'maintenance-request': {
    start: {
      label: 'Start', primary: true, when: stateIs('draft'),
      run: async (rec) => {
        const checks = await A['maintenance-checklist'].findAll({ where: { requestTypeId: rec.requestTypeId }, order: [['sequence', 'ASC']], raw: true });
        const have = await A['maintenance-check-result'].count({ where: { requestId: rec.id } });
        if (!have) {
          for (const c of checks) await A['maintenance-check-result'].create({ requestId: rec.id, checklistId: c.id, category: c.category, result: 'ok' });
        }
        await rec.update({ state: 'in_progress' });
        return { message: `Inspection started (${checks.length} checks)` };
      },
    },
    'create-repair-request': {
      label: 'Create Repair Request', primary: true, when: (r) => r.state === 'in_progress' && num(r.damageCount) > 0,
      run: async (rec, body, ctx) => {
        const open = await A['repair-request'].count({ where: { requestId: rec.id, state: { [Op.notIn]: ['cancelled', 'rejected', 'done'] } } });
        if (open) throw err(409, 'This inspection already has an open repair request.');
        const reg = await A['container-registry'].findByPk(rec.containerId, { raw: true });
        const rr = await svc().create(ctx.models, 'repair-request', {
          name: `Repair ${reg ? reg.name : ''}`.trim(), requestId: rec.id, userId: rec.userId || ctx.userId,
          requestUserId: ctx.userId, scheduledDate: addDays(today(), 1), currency: 'USD',
        }, ctx);
        const damaged = await A['maintenance-check-result'].findAll({ where: { requestId: rec.id, result: 'damaged' }, raw: true });
        const general = await A['repair-activity'].findOne({ order: [['createdAt', 'ASC']], raw: true });
        for (const d of damaged) {
          const check = await A['maintenance-checklist'].findByPk(d.checklistId, { raw: true });
          const match = check && await A['repair-activity'].findOne({ where: { name: { [Op.like]: `%${String(check.name).split(' ')[0]}%` } }, raw: true });
          const activity = match || general;
          if (!activity) continue;
          await svc().create(ctx.models, 'repair-job', {
            repairRequestId: rr.id, repairActivityId: activity.id, quantity: 1,
            description: `${check ? check.name : 'Damage'}${d.remark ? ` - ${d.remark}` : ''}`,
          }, ctx);
        }
        return { message: `Repair request ${rr.repairRequestNumber} created`, redirect: { resource: 'repair-request', id: rr.id } };
      },
    },
    submit: {
      label: 'Submit', when: stateIs('in_progress'),
      run: async (rec, body, ctx) => {
        await rec.update({ state: 'done' });
        // A clean inspection puts the box back in service.
        if (!num(rec.damageCount)) await logActivity(ctx, rec.containerId, 'RCVE', 'empty', { jobId: rec.jobId, remark: `Inspection ${rec.requestNumber} passed` });
        return { message: 'Inspection submitted' };
      },
    },
  },

  'repair-request': {
    'send-for-approval': {
      label: 'Send For Approval', primary: true, when: stateIs('draft'),
      run: async (rec) => {
        const jobs = await A['repair-job'].count({ where: { repairRequestId: rec.id } });
        if (!jobs) throw err(422, 'Add at least one repair job first.');
        await rec.update({ state: 'to_approve' });
        return { message: 'Sent for approval' };
      },
    },
    approve: {
      label: 'Approve', primary: true, when: stateIs('to_approve'),
      run: async (rec) => { await rec.update({ state: 'approved', approvedDate: today(), rejectReason: null }); return { message: 'Repair approved' }; },
    },
    reject: {
      label: 'Reject', danger: true, when: stateIs('to_approve'),
      input: [{ name: 'reason', label: 'Reject Reason', type: 't', required: true }],
      run: async (rec, body) => { await rec.update({ state: 'rejected', rejectReason: body.reason }); return { message: 'Repair rejected' }; },
    },
    start: {
      label: 'Start Repair', primary: true, when: stateIs('approved'),
      run: async (rec, body, ctx) => {
        await A['repair-job'].update({ state: 'in_progress' }, { where: { repairRequestId: rec.id, state: 'draft' } });
        await rec.update({ state: 'in_progress' });
        const mr = await A['maintenance-request'].findByPk(rec.requestId, { raw: true });
        if (mr) await logActivity(ctx, mr.containerId, 'SNTR', 'empty', { jobId: mr.jobId, remark: `Sent for repair ${rec.repairRequestNumber}` });
        return { message: 'Repair started' };
      },
    },
    'mark-repaired': {
      label: 'Mark Repaired', primary: true, when: stateIs('in_progress'),
      run: async (rec) => {
        await A['repair-job'].update({ state: 'done' }, { where: { repairRequestId: rec.id } });
        await rec.update({ state: 'repaired' });
        return { message: 'Repairs completed' };
      },
    },
    done: {
      label: 'Mark AS Done', primary: true, when: stateIs('repaired'),
      run: async (rec, body, ctx) => {
        await rec.update({ state: 'done' });
        const mr = await A['maintenance-request'].findByPk(rec.requestId, { raw: true });
        if (!mr) return { message: 'Repair closed' };
        await logActivity(ctx, mr.containerId, 'RCVR', 'empty', { jobId: mr.jobId, remark: `Received after repair ${rec.repairRequestNumber}` });
        if (mr.state !== 'done') await A['maintenance-request'].update({ state: 'done' }, { where: { id: mr.id } });
        // Damage found on a job's container is recharged to that job's customer.
        if (mr.jobId && num(rec.amountTotal) > 0) {
          const job = await A.job.findByPk(mr.jobId, { raw: true });
          await addCharge(ctx.models, 'nvocc_job', mr.jobId, 'revenue', {
            code: 'CMNT', description: 'CONTAINER MAINTAINANCE CHARGES', quantity: 1, rate: rec.amountTotal,
            currency: rec.currency, partnerId: job && job.customerId, source: 'erp',
          });
          await reloadParent('nvocc_job', mr.jobId);
          return { message: `Repair closed; ${rec.currency} ${money(rec.amountTotal)} recharged to job ${job ? job.name : ''}` };
        }
        return { message: 'Repair closed' };
      },
    },
    cancel: {
      label: 'Cancel', danger: true, when: stateIs('draft', 'in_progress', 'rejected'), confirm: 'Cancel this repair request?',
      run: async (rec) => { await rec.update({ state: 'cancelled' }); return { message: 'Repair cancelled' }; },
    },
  },

  'security-deposit': {
    receive: {
      label: 'Receive', primary: true, when: stateIs('draft'),
      run: async (rec) => { await rec.update({ state: 'received' }); await recountDeposits(rec.jobId); return { message: 'Deposit received' }; },
    },
    refund: {
      label: 'Refund', when: stateIs('received', 'partially_refunded'),
      input: [{ name: 'amount', label: 'Refund Amount', type: '$', required: true }],
      run: async (rec, body) => {
        const amt = money(body.amount);
        if (amt <= 0 || amt > num(rec.balance)) throw err(422, `Refund must be between 0 and the balance ${money(rec.balance)}`);
        const refunded = money(num(rec.refundedAmount) + amt);
        const balance = money(num(rec.amount) - refunded - num(rec.adjustedAmount));
        await rec.update({ refundedAmount: refunded, balance, state: balance > 0 ? 'partially_refunded' : 'refunded' });
        await recountDeposits(rec.jobId);
        return { message: `${rec.currency} ${amt} refunded` };
      },
    },
    adjust: {
      label: 'Adjust Against Invoice', when: stateIs('received', 'partially_refunded'),
      input: [{ name: 'amount', label: 'Adjust Amount', type: '$', required: true }],
      run: async (rec, body) => {
        const amt = money(body.amount);
        if (amt <= 0 || amt > num(rec.balance)) throw err(422, `Adjustment must be between 0 and the balance ${money(rec.balance)}`);
        const adjusted = money(num(rec.adjustedAmount) + amt);
        const balance = money(num(rec.amount) - num(rec.refundedAmount) - adjusted);
        await rec.update({ adjustedAmount: adjusted, balance, state: balance > 0 ? rec.state : 'adjusted' });
        await recountDeposits(rec.jobId);
        return { message: `${rec.currency} ${amt} adjusted` };
      },
    },
    cancel: {
      label: 'Cancel', danger: true, when: stateIs('draft'),
      run: async (rec) => { await rec.update({ state: 'cancelled' }); return { message: 'Deposit cancelled' }; },
    },
  },

  'transfer-config': {
    'run-transfer': {
      label: 'Run Transfer', primary: true, when: (r) => r.state !== 'done',
      run: async (rec, body, ctx) => {
        const { AccountMove } = ctx.models;
        const from = rec.lastRun || rec.dateStart;
        const to = today();
        const posted = await AccountMove.findAll({ where: { state: 'posted' }, attributes: ['invoiceDate', 'createdAt', 'journalItems'], raw: true });
        let balance = 0;
        for (const m of posted) {
          const d = String(m.invoiceDate || m.createdAt).slice(0, 10);
          if (d < from || d > to) continue;
          const items = typeof m.journalItems === 'string' ? JSON.parse(m.journalItems || '[]') : (m.journalItems || []);
          for (const it of items) if (String(it.account || '').startsWith(String(rec.sourceAccount).split(' ')[0])) balance += num(it.debit) - num(it.credit);
        }
        const amount = money(Math.abs(balance) * (num(rec.percent) || 100) / 100);
        if (!amount) throw err(409, `Nothing to transfer: ${rec.sourceAccount} has no movement since ${from}.`);
        const year = yyyy();
        const last = await AccountMove.findOne({ where: { moveType: 'entry', name: { [Op.like]: `MISC/${year}/%` } }, order: [['name', 'DESC']], raw: true });
        const number = `MISC/${year}/${String((last ? Number(String(last.name).split('/').pop()) : 0) + 1).padStart(5, '0')}`;
        const debitDest = balance > 0;
        await AccountMove.create({
          moveType: 'entry', state: 'posted', name: number, invoiceDate: to, journal: rec.journal || 'Miscellaneous',
          ref: `Automatic transfer: ${rec.name}`, amountUntaxed: amount, amountTotal: amount, amountTotalCurrency: amount, amountResidual: 0,
          journalItems: [
            { account: rec.destinationAccount, label: rec.name, debit: debitDest ? amount : 0, credit: debitDest ? 0 : amount },
            { account: rec.sourceAccount, label: rec.name, debit: debitDest ? 0 : amount, credit: debitDest ? amount : 0 },
          ],
          createdBy: ctx.userId || null,
        });
        await rec.update({ lastRun: to, moveCount: num(rec.moveCount) + 1, state: rec.dateStop && to >= rec.dateStop ? 'done' : 'in_progress' });
        return { message: `${number} posted: AED ${amount} from ${rec.sourceAccount} to ${rec.destinationAccount}` };
      },
    },
  },
};

/** Record a container movement by its activity code. */
const logActivity = async (ctx, containerId, code, containerStatus, extra = {}) => {
  if (!containerId) return null;
  const type = await A['container-activity-type'].findOne({ where: { code }, raw: true });
  const status = await A['container-status'].findOne({ raw: true });
  const loc = await ctx.models.MasterDataItem.findOne({ where: { category: 'location-type' }, raw: true });
  if (!type) return null;
  return svc().create(ctx.models, 'container-activity', {
    containerId, activityTypeId: type.id, date: today(), containerStatusId: status && status.id,
    containerStatus, locationTypeId: loc && loc.id, ...extra,
  }, ctx);
};

// ── EDI import ───────────────────────────────────────────────────────────────
const blocks = (xml, tag) => [...String(xml).matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi'))].map((m) => m[1]);
const leaf = (xml, tag) => {
  const m = String(xml).match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : null;
};
const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  const s = String(text).replace(/\r/g, '');
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
};

// Default element names when a template maps nothing; a template line
// overrides one of them.
const DEFAULT_JOB_TAGS = {
  BLNumber: 'hblNumber', MBLNumber: 'mblNumber', Customer: 'customerId', Principal: 'principalId',
  PortOfLoading: 'originPortId', PortOfDischarge: 'destinationPortId', PlaceOfReceipt: 'originLocation',
  PlaceOfDelivery: 'destinationLocation', Vessel: 'vesselId', Voyage: 'voyageNumber', ShippingLine: 'shippingLineId',
  Packages: 'packUnit', GrossWeight: 'grossWeight', Volume: 'volume', Description: 'description',
  MarksAndNumbers: 'marksnNumber', PaymentTerms: 'paymentTerms', IndexNo: 'indexNumber', IGMNo: 'igmNumber', CargoType: 'cargoType',
};
const CONTAINER_TAGS = { ContainerNo: 'containerNumber', ContainerType: 'containerTypeId', SealNo: 'sealNumber', SOC: 'soc', Packages: 'packages', GrossWeight: 'grossWeight' };

const importEdi = async (models, { templateId, content, filename, shipmentType }, ctx) => {
  const tpl = templateId ? await A['edi-template'].findByPk(templateId, { raw: true }) : null;
  if (templateId && !tpl) throw err(404, 'EDI template not found');
  if (!content || !String(content).trim()) throw err(422, 'The EDI file is empty');
  const mapping = { ...DEFAULT_JOB_TAGS };
  const tplLines = tpl ? (typeof tpl.lines === 'string' ? JSON.parse(tpl.lines || '[]') : (tpl.lines || [])) : [];
  for (const l of tplLines) if (l && l.tag && l.field) mapping[l.tag] = l.field;
  const recordTag = (tpl && tpl.recordTag) || 'shipment';
  const containerTag = (tpl && tpl.containerTag) || 'container';
  const mode = (tpl && tpl.mode) || (String(content).trim().startsWith('<') ? 'xml' : 'csv');

  // Turn the file into [{ job: {tag: value}, containers: [{tag: value}] }].
  let records = [];
  if (mode === 'xml') {
    records = blocks(content, recordTag).map((b) => {
      const containers = blocks(b, containerTag).map((c) => Object.fromEntries(Object.keys(CONTAINER_TAGS).map((t) => [t, leaf(c, t)])));
      const head = b.replace(new RegExp(`<${containerTag}\\b[\\s\\S]*?</${containerTag}>`, 'gi'), '');
      return { job: Object.fromEntries(Object.keys(mapping).map((t) => [t, leaf(head, t)])), containers };
    });
  } else {
    const [header, ...rows] = parseCsv(content);
    const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
    const byBl = new Map();
    for (const r of rows) {
      const get = (t) => (idx[t] !== undefined ? (r[idx[t]] || '').trim() : null);
      const bl = get('BLNumber') || get('JobNo') || `ROW${byBl.size + 1}`;
      if (!byBl.has(bl)) byBl.set(bl, { job: Object.fromEntries(Object.keys(mapping).map((t) => [t, get(t)])), containers: [] });
      if (get('ContainerNo')) byBl.get(bl).containers.push(Object.fromEntries(Object.keys(CONTAINER_TAGS).map((t) => [t, get(t)])));
    }
    records = [...byBl.values()];
  }
  if (!records.length) throw err(422, `No <${recordTag}> records found in the file`);

  // Resolve a link value: an EDI discrepancy mapping first, then a direct match.
  const jobFields = Object.fromEntries(require('./spec').fieldsOf('job').map((f) => [f.name, f]));
  const discrepancies = [];
  const resolve = async (field, ref, value) => {
    if (!value) return null;
    let mapType = await A['edi-map-type'].findOne({ where: { field } });
    if (!mapType) mapType = await A['edi-map-type'].create({ name: jobFields[field] ? jobFields[field].label : field, targetRef: ref, field, active: true });
    const mapped = await A['edi-mapping'].findOne({ where: { mapTypeId: mapType.id, name: value } });
    if (mapped && mapped.resId) return mapped.resId;
    const hits = await svc().lookup(models, ref, { search: value, limit: 5 });
    const exact = hits.find((h) => String(h.label).toLowerCase().includes(String(value).toLowerCase()));
    if (exact) return exact.id;
    if (!mapped) await A['edi-mapping'].create({ name: value, mapTypeId: mapType.id, source: filename || 'EDI import' });
    discrepancies.push(`${mapType.name}: '${value}'`);
    return null;
  };

  const created = [];
  for (const rec of records) {
    const data = { shipmentType: shipmentType || 'import', transportMode: 'sea', cargoType: 'FCL', shipmentDate: today(), userId: ctx.userId };
    for (const [tag, field] of Object.entries(mapping)) {
      const v = rec.job[tag];
      if (v === null || v === undefined || v === '') continue;
      const f = jobFields[field];
      if (!f) continue;
      if (f.type === 'm2o') data[field] = await resolve(field, f.ref, v);
      else if (f.type === 'sel') {
        const opt = (f.options || []).find(([o, l]) => [String(o).toLowerCase(), String(l).toLowerCase()].includes(String(v).toLowerCase()));
        if (opt) data[field] = opt[0];
      } else data[field] = v;
    }
    // A feed from the line names no principal: it is the line we represent.
    if (!data.principalId) data.principalId = await defaultPrincipalId(models);
    if (data.hblNumber && await A.job.count({ where: { hblNumber: data.hblNumber, shipmentType: data.shipmentType } })) {
      discrepancies.push(`BL ${data.hblNumber} already exists - skipped`);
      continue;
    }
    const job = await svc().create(models, 'job', data, ctx);
    for (const c of rec.containers) {
      const line = { jobId: job.id, soc: 'N' };
      for (const [tag, field] of Object.entries(CONTAINER_TAGS)) {
        const v = c[tag];
        if (!v) continue;
        if (field === 'containerTypeId') {
          const t = await A['container-type'].findOne({ where: { [Op.or]: [{ code: v }, { isoCode: v }, { name: v }] }, raw: true });
          line.containerTypeId = t ? t.id : await resolve('containerTypeId', 'container-type', v);
        } else if (field === 'soc') line.soc = /^y/i.test(v) ? 'Y' : 'N';
        else line[field] = v;
      }
      if (!line.containerTypeId) {
        const t = await A['container-type'].findOne({ where: { code: '20SD' }, raw: true });
        line.containerTypeId = t && t.id;
      }
      await svc().create(models, 'container-line', line, ctx);
    }
    created.push(job.name);
  }
  return {
    created,
    discrepancies,
    message: `${created.length} job(s) imported${discrepancies.length ? `, ${discrepancies.length} value(s) need mapping in EDI Discrepancy Data` : ''}`,
  };
};

module.exports = {
  ACTIONS, beforeSave, afterSave, afterDelete, guardDelete, guardEdit, listScope,
  importEdi, addCharge, logActivity, tariffsFor, FX, fxOf, manifestRows, MANIFEST_COLS, toCsv,
};
