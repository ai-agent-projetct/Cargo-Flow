// Behaviour of the Agency clone: numbering, onchange recomputation, and the
// header/smart buttons of the upstream forms (type="object" methods).
const { Op } = require('sequelize');
const R = require('./registry');

const orm = () => require('./orm');
const err = (status, message) => Object.assign(new Error(message), { statusCode: status });
const yyyy = () => String(new Date().getFullYear());

// Apps of the instance the clone serves (menu complete_name prefixes).
const MENU_ROOTS = [
  'Booking', 'Operations', 'Maintenance', 'Repair', 'Schedules', 'Administration',
  // Accounting entries whose model is part of the clone (security deposits,
  // principal SOA, automatic transfers, cheque books); the rest are
  // CargoFlo's own accounting screens and are filtered out by model.
  'Contacts/Principal', 'Accounting',
];
const MENU_REPORTS = {};

const viewById = (id) => {
  const v = R.MASTER_DATA && R.MASTER_DATA.views && R.MASTER_DATA.views[id];
  return v ? { arch: v.arch, fields: v.fields, view_id: Number(id), name: v.name, model: v.model, type: v.type } : null;
};

// ── Numbering ────────────────────────────────────────────────────────────────
const nextNumber = async (m, field, prefix, pad, suffix = '') => {
  const rows = await R.MODELS[m].findAll({ where: { [field]: { [Op.like]: `${prefix}%${suffix}` } }, attributes: [field], raw: true });
  const max = rows.reduce((mx, r) => {
    const mid = String(r[field]).slice(prefix.length, suffix ? -suffix.length : undefined);
    const n = parseInt(mid, 10);
    return Number.isFinite(n) && n > mx ? n : mx;
  }, 0);
  return `${prefix}${String(max + 1).padStart(pad, '0')}${suffix}`;
};

const refCode = async (model, id, field = 'code') => {
  if (!id) return null;
  if (R.isOwn(model)) {
    const r = await R.MODELS[model].findByPk(Array.isArray(id) ? id[0] : id, { raw: true });
    return r ? (r[field] || r.name) : null;
  }
  return null;
};

// Upstream formats, as seen on the instance's records.
const SEQUENCES = {
  'nvocc.pre.booking': async (v) => {
    const cargo = (await refCode('cargo.type', v.cargo_type_id)) || 'FCL';
    const exp = Number(v.shipment_type_id) === 2 ? 'IMP' : 'EXP';
    return {
      name: await nextNumber('nvocc.pre.booking', 'name', `PB-SEA-${exp}-${String(cargo).toUpperCase()}/${yyyy()}/`, 5),
      cro_no: v.cro_no || await nextNumber('nvocc.pre.booking', 'cro_no', `${yyyy()}-`, 5),
      gate_pass_no: v.gate_pass_no || await nextNumber('nvocc.pre.booking', 'gate_pass_no', `GP-${yyyy()}-`, 5),
    };
  },
  'nvocc.service.job': async (v) => {
    const cargo = (await refCode('cargo.type', v.cargo_type_id)) || 'FCL';
    const dir = Number(v.shipment_type_id) === 2 ? 'I' : 'E';
    return {
      name: await nextNumber('nvocc.service.job', 'name', `SEA-${dir}-${String(cargo).toUpperCase()}-${yyyy()}-`, 5),
      gate_pass_no: v.gate_pass_no || await nextNumber('nvocc.service.job', 'gate_pass_no', `GP-${yyyy()}-`, 5),
    };
  },
  'nvocc.master.service.job': async () => ({ name: await nextNumber('nvocc.master.service.job', 'name', `CONS-${yyyy()}-`, 5) }),
  'nvocc.manifest': async (v) => ({
    name: await nextNumber('nvocc.manifest', 'name', `${Number(v.shipment_type_id) === 1 ? 'EXP' : 'IMP'}-MH-`, 5, `/${yyyy().slice(2)}`),
    year: yyyy(),
  }),
  'maintenance.request': async () => ({ request_number: await nextNumber('maintenance.request', 'request_number', `MR/${yyyy()}/`, 5) }),
  'maintenance.repair.request': async () => ({ repair_request_number: await nextNumber('maintenance.repair.request', 'repair_request_number', `RR/${yyyy()}/`, 5) }),
  'maintenance.repair.request.job': async () => ({ repair_job_number: await nextNumber('maintenance.repair.request.job', 'repair_job_number', `RJ/${yyyy()}/`, 5) }),
  'security.deposit': async () => ({ name: await nextNumber('security.deposit', 'name', `SD/${yyyy()}/`, 5) }),
};

const beforeCreate = async (m, vals) => {
  if (SEQUENCES[m]) {
    const seq = await SEQUENCES[m](vals);
    // Upstream defaults are placeholders ('/', 'New', 'New Pre Booking Number').
    for (const [k, v] of Object.entries(seq)) if (!vals[k] || /^(\/|New\b)/.test(String(vals[k]))) vals[k] = v;
  }
  return vals;
};

const beforeWrite = async (m, ids, vals) => vals;
const afterWrite = async () => {};
const beforeUnlink = async () => {};
const defaults = async () => ({});

// ── onchange: recompute related fields from the changed links ────────────────
const onchange = async (m, values) => {
  const all = R.fieldsOf(m);
  const out = {};
  for (const [k, f] of Object.entries(all)) {
    if (!f.related) continue;
    const [root] = f.related.split('.');
    const rf = all[root];
    if (!rf || rf.type !== 'many2one' || !values[root]) continue;
    const id = Array.isArray(values[root]) ? values[root][0] : values[root];
    const rest = f.related.split('.').slice(1);
    if (!R.isOwn(rf.relation) || rest.length !== 1) continue;
    const [row] = await orm().read(rf.relation, [Number(id)], [rest[0]]);
    if (row) out[k] = row[rest[0]];
  }
  return { value: out };
};

// ── Buttons ──────────────────────────────────────────────────────────────────
const BUTTONS = {};
const button = (m, name, fn) => { BUTTONS[m] = BUTTONS[m] || {}; BUTTONS[m][name] = fn; };

const callButton = async (m, method, ids, kwargs, ctx) => {
  const fn = BUTTONS[m] && BUTTONS[m][method];
  if (!fn) throw err(501, `"${method}" on ${m} is not available in this build yet`);
  const result = await fn(ids, kwargs, ctx);
  return result === undefined ? true : result;
};

module.exports = {
  MENU_ROOTS, MENU_REPORTS, viewById, beforeCreate, beforeWrite, afterWrite, beforeUnlink, defaults, onchange,
  callButton, button, BUTTONS, nextNumber,
};
