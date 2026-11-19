// Computed fields of the Agency clone, from the upstream dependency lists
// (fields_get `depends`). Run after every create/write on the models below;
// each step writes the stored results and then refreshes the parent.
//
// Charge lines (revenue / cost / principal / detention):
//   total_currency_amount   = quantity * amount_rate
//   discount_amount         = total_currency_amount * discount_percentage %
//   total_amount_after_discount = total_currency_amount - discount_amount
//   total_amount            = total_amount_after_discount * amount_conversion_rate
//   commission_amount       = total_amount_after_discount * commission_percentage %
//   amount_currency_residual = invoice_currency_amount - actual_invoiced(billed)_amount
//   status                  = no / partial / fully_invoiced (fully_billed)
// Job: teu_total, weights, estimated / received revenue and cost, due, deposits.
const { Op } = require('sequelize');
const R = require('./registry');

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const money = (v) => Math.round(n(v) * 100) / 100;
const M = (m) => R.MODELS[m];
const CHARGES = ['nvocc.revenue.charge', 'nvocc.cost.charge', 'nvocc.principal.charge', 'nvocc.detention.charge'];
const COST_SIDE = new Set(['nvocc.cost.charge']);
const JOB = 'nvocc.service.job';
const PB = 'nvocc.pre.booking';

const has = (m, f) => !!R.fieldsOf(m)[f];
const pick = (m, vals) => Object.fromEntries(Object.entries(vals).filter(([k]) => has(m, k)));

const chargeValues = (m, r) => {
  const qty = n(r.quantity) || 0;
  const tca = money(qty * n(r.amount_rate));
  const disc = money(tca * n(r.discount_percentage) / 100);
  const after = money(tca - disc);
  const rate = n(r.amount_conversion_rate) || 1;
  const total = money(after * rate);
  const settled = COST_SIDE.has(m) ? n(r.actual_billed_amount) : n(r.actual_invoiced_amount);
  const invAmt = n(r.invoice_currency_amount) || after;
  const residualCur = money(Math.max(0, invAmt - settled));
  let status = 'no';
  if (settled > 0) status = residualCur <= 0.01 ? (COST_SIDE.has(m) ? 'fully_billed' : 'fully_invoiced') : 'partial';
  return pick(m, {
    amount_currency_mismatch: !!(r.amount_currency_id && r.currency_id && String(r.amount_currency_id) !== String(r.currency_id)),
    total_currency_amount: tca,
    discount_amount: disc,
    total_amount_after_discount: after,
    total_amount: total,
    total_amount_after_discount_home_currency: total,
    commission_amount: money(after * n(r.commission_percentage) / 100),
    invoice_currency_amount: invAmt,
    amount_currency_residual: residualCur,
    amount_residual: money(residualCur * (n(r.invoice_conversion_rate) || rate)),
    total_residual_amount: money(residualCur * (n(r.invoice_conversion_rate) || rate)),
    status,
  });
};

const containerTeu = async (r) => {
  if (!r.container_type_id || !M('freight.container.type')) return n(r.quantity) || 1;
  const t = await M('freight.container.type').findByPk(r.container_type_id, { raw: true });
  const teu = t ? n(t.total_teu) || (/^4/.test(String(t.code || t.x_display || '')) ? 2 : 1) : 1;
  return teu * (n(r.quantity) || 1);
};

const jobRollup = async (jobId) => {
  if (!jobId || !M(JOB)) return;
  const id = String(jobId);
  const sum = async (m, fk, field, where = {}) => {
    if (!M(m) || !has(m, field)) return 0;
    const rows = await M(m).findAll({ where: { [fk]: id, ...where }, attributes: [field], raw: true });
    return rows.reduce((s, x) => s + n(x[field]), 0);
  };
  const rev = await sum('nvocc.revenue.charge', 'nvocc_service_job_id', 'total_amount');
  const det = await sum('nvocc.detention.charge', 'nvocc_service_job_id', 'total_amount');
  const pri = await sum('nvocc.principal.charge', 'nvocc_service_job_id', 'total_amount');
  const cost = await sum('nvocc.cost.charge', 'nvocc_service_job_id', 'total_amount');
  const resid = async (m) => {
    if (!M(m)) return 0;
    const rows = await M(m).findAll({ where: { nvocc_service_job_id: id }, raw: true });
    return rows.reduce((s, x) => s + n(x.amount_currency_residual) * (n(x.amount_conversion_rate) || 1), 0);
  };
  const revRes = await resid('nvocc.revenue.charge') + await resid('nvocc.detention.charge') + await resid('nvocc.principal.charge');
  const costRes = await resid('nvocc.cost.charge') + await resid('nvocc.principal.charge');
  const estRev = money(rev + det + pri);
  const estCost = money(cost + pri);
  const recRev = money(Math.max(0, estRev - revRes));
  const paid = money(Math.max(0, estCost - costRes));

  const boxes = await M('nvocc.shipment.container').findAll({ where: { nvocc_service_job_id: id }, raw: true });
  const job = await M(JOB).findByPk(jobId, { raw: true });
  const patch = {
    estimated_revenue: estRev, estimated_cost: estCost, received_revenue: recRev, paid_cost: paid,
    due_revenue: money(estRev - recRev), due_cost: money(estCost - paid),
    teu_total: boxes.reduce((s, b) => s + n(b.no_of_teu), 0),
  };
  if (job && job.auto_update_weight_volume && boxes.length) {
    patch.gross_weight_unit = boxes.reduce((s, b) => s + n(b.weight_unit), 0);
    patch.net_weight_unit = boxes.reduce((s, b) => s + n(b.net_weight_unit), 0);
    patch.volume_unit = boxes.reduce((s, b) => s + n(b.volume_unit), 0);
    patch.weight_volume_unit = boxes.reduce((s, b) => s + n(b.volumetric_weight), 0) || patch.volume_unit * 1000;
  }
  const gw = patch.gross_weight_unit ?? n(job && job.gross_weight_unit);
  const vw = patch.weight_volume_unit ?? n(job && job.weight_volume_unit);
  patch.chargeable_kg = Math.max(gw, vw);
  if (M('container.activity')) patch.container_activity_count = await M('container.activity').count({ where: { nvocc_service_job_id: id } });
  if (M('security.deposit')) {
    const deps = await M('security.deposit').findAll({ where: { service_job_id: id, state: { [Op.ne]: 'draft' } }, raw: true });
    patch.deposit_received = money(deps.reduce((s, d) => s + n(d.amount_company_currency_signed || d.deposit_amount), 0));
    patch.deposit_refunded_amount = money(deps.reduce((s, d) => s + n(d.refunded_amount_currency_signed || d.refunded_amount), 0));
    patch.deposit_adjusted_amount = money(deps.reduce((s, d) => s + n(d.adjusted_amount), 0));
  }
  // Billing drives the job state once charges are invoiced (upstream state
  // depends on revenue_line_ids.status and move payment states).
  if (job && estRev > 0 && ['created', 'bl_generated', 'arrival_notice', 'custom_files_generated', 'generate_weboc'].includes(job.state) && revRes <= 0.01 && recRev > 0) {
    patch.state = 'invoice_generated';
  }
  await M(JOB).update(pick(JOB, patch), { where: { id: jobId } });
};

const bookingRollup = async (pbId) => {
  if (!pbId || !M(PB)) return;
  const id = String(pbId);
  const lines = M('nvocc.pre.booking.line') ? await M('nvocc.pre.booking.line').findAll({ where: { pre_booking_id: id }, raw: true }) : [];
  const cargo = M('nvocc.pre.booking.cargo.lines') ? await M('nvocc.pre.booking.cargo.lines').findAll({ where: { pre_booking_id: id }, raw: true }) : [];
  const pb = await M(PB).findByPk(pbId, { raw: true });
  const total = money(lines.filter((l) => l.include_charges !== false).reduce((s, l) => s + n(l.total_sell_amount), 0));
  const patch = { include_total_amount: total, all_include_sell_amount_rate: total, include_total_amount_in_words: words(total) };
  if (pb && pb.auto_update_weight_volume && cargo.length) {
    patch.gross_weight_unit = cargo.reduce((s, c) => s + n(c.weight), 0);
    patch.volume_unit = cargo.reduce((s, c) => s + n(c.volume), 0);
    patch.weight_volume_unit = cargo.reduce((s, c) => s + n(c.volumetric_weight), 0) || patch.volume_unit * 1000;
  }
  const gw = patch.gross_weight_unit ?? n(pb && pb.gross_weight_unit);
  const vw = patch.weight_volume_unit ?? n(pb && pb.weight_volume_unit);
  patch.chargeable_kg = Math.max(gw, vw);
  patch.chargeable = patch.chargeable_kg;
  await M(PB).update(pick(PB, patch), { where: { id: pbId } });
};

// Amount in words, as printed on the booking ("One Thousand Two Hundred ...").
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const below1000 = (x) => {
  const h = Math.floor(x / 100);
  const r = x % 100;
  const t = r < 20 ? ONES[r] : `${TENS[Math.floor(r / 10)]}${r % 10 ? ` ${ONES[r % 10]}` : ''}`;
  return [h ? `${ONES[h]} Hundred` : '', t].filter(Boolean).join(' ');
};
const words = (amount) => {
  let x = Math.floor(n(amount));
  const cents = Math.round((n(amount) - x) * 100);
  if (!x && !cents) return 'Zero';
  const parts = [];
  for (const [size, label] of [[1e9, 'Billion'], [1e6, 'Million'], [1e3, 'Thousand'], [1, '']]) {
    const q = Math.floor(x / size);
    if (q) { parts.push(`${below1000(q)}${label ? ` ${label}` : ''}`); x %= size; }
  }
  return `${parts.join(' ')}${cents ? ` and ${below1000(cents)} Cents` : ''}`.trim();
};

/** Recompute after a write to model m, records ids. */
const recompute = async (m, ids) => {
  for (const id of ids) {
    if (CHARGES.includes(m)) {
      const r = await M(m).findByPk(id, { raw: true });
      if (!r) continue;
      await M(m).update(chargeValues(m, r), { where: { id } });
      await jobRollup(r.nvocc_service_job_id || r.job_id);
    } else if (m === 'nvocc.shipment.container') {
      const r = await M(m).findByPk(id, { raw: true });
      if (!r) continue;
      const vol = n(r.length) * n(r.width) * n(r.height);
      await M(m).update(pick(m, { no_of_teu: await containerTeu(r), ...(vol ? { volume_unit: vol, volumetric_weight: vol * 1000 / 6 } : {}) }), { where: { id } });
      await jobRollup(r.nvocc_service_job_id);
    } else if (m === JOB) {
      await jobRollup(id);
    } else if (m === 'nvocc.pre.booking.line') {
      const r = await M(m).findByPk(id, { raw: true });
      if (!r) continue;
      const q = n(r.quantity) || 0;
      await M(m).update(pick(m, {
        total_cost_amount: money(q * n(r.cost_amount_rate) * (n(r.cost_conversion_rate) || 1)),
        total_sell_amount: money(q * n(r.sell_amount_rate) * (n(r.sell_conversion_rate) || 1)),
      }), { where: { id } });
      await bookingRollup(r.pre_booking_id);
    } else if (m === PB || m === 'nvocc.pre.booking.cargo.lines') {
      const r = m === PB ? { id } : await M(m).findByPk(id, { raw: true });
      await bookingRollup(m === PB ? id : r && r.pre_booking_id);
    } else if (m === 'security.deposit' || m === 'container.activity') {
      const r = await M(m).findByPk(id, { raw: true });
      if (r) await jobRollup(r.service_job_id || r.nvocc_service_job_id);
    } else if (m === 'maintenance.repair.request.job') {
      const r = await M(m).findByPk(id, { raw: true });
      if (!r) continue;
      const sub = money(n(r.quantity) * n(r.price_unit));
      await M(m).update(pick(m, { price_subtotal: sub }), { where: { id } });
    }
  }
};

module.exports = { recompute, chargeValues, jobRollup, bookingRollup, words };

if (require.main === module) {
  const assert = require('assert');
  const v = chargeValues('nvocc.revenue.charge', { quantity: 2, amount_rate: 100, discount_percentage: 10, amount_conversion_rate: 3.6725, actual_invoiced_amount: 0 });
  assert.strictEqual(v.total_currency_amount, 200);
  assert.strictEqual(v.discount_amount, 20);
  assert.strictEqual(v.total_amount_after_discount, 180);
  assert.strictEqual(v.total_amount, 661.05);
  assert.strictEqual(v.status, 'no');
  const paid = chargeValues('nvocc.revenue.charge', { quantity: 1, amount_rate: 50, amount_conversion_rate: 1, actual_invoiced_amount: 50 });
  assert.strictEqual(paid.status, 'fully_invoiced');
  assert.strictEqual(words(1250.5), 'One Thousand Two Hundred Fifty and Fifty Cents');
  console.log('compute self-check ok');
}
