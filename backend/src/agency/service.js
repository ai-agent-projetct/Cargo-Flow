// The generic engine behind every Liner Agency resource: list, read, create,
// update, delete, link labels, lookups, sequences and workflow actions, all
// driven by spec.js. Resource-specific behaviour is in actions.js.
const { Op } = require('sequelize');
const { RESOURCES, MENU, fieldsOf } = require('./spec');
const { AGENCY_MODELS } = require('./models');

const httpError = (status, message) => Object.assign(new Error(message), { statusCode: status, status });

const specOf = (key) => {
  const spec = RESOURCES[key];
  if (!spec) throw httpError(404, `Unknown resource '${key}'`);
  return spec;
};

// ── Link labels ──────────────────────────────────────────────────────────────
// A link column stores an id; lists and forms show a name. Every id on a page
// of rows is resolved in one query per target, not one per row.

const external = (models) => ({
  org: { model: models.Organization, label: (r) => r.companyName || r.name, attrs: ['id', 'name', 'companyName'], search: ['name', 'companyName'] },
  port: { model: models.Port, label: (r) => (r.code ? `${r.code} - ${r.name}` : r.name), attrs: ['id', 'name', 'code'], search: ['name', 'code'] },
  carrier: { model: models.Carrier, label: (r) => r.name, attrs: ['id', 'name'], search: ['name'] },
  user: { model: models.User, label: (r) => r.name || r.email, attrs: ['id', 'name', 'email'], search: ['name', 'email'] },
  team: { model: models.SalesTeam, label: (r) => r.name, attrs: ['id', 'name'], search: ['name'] },
});

const targetFor = (models, ref) => {
  if (!ref) return null;
  if (ref.startsWith('md:')) {
    return {
      model: models.MasterDataItem,
      label: (r) => (r.code && r.code !== r.name ? `${r.name}` : r.name),
      attrs: ['id', 'name', 'code'],
      search: ['name', 'code'],
      where: { category: ref.slice(3) },
    };
  }
  if (AGENCY_MODELS[ref]) {
    const spec = RESOURCES[ref];
    const display = spec.display || 'name';
    const attrs = ['id', display];
    if (ref === 'container-type') attrs.push('name');
    return {
      model: AGENCY_MODELS[ref],
      label: (r) => (ref === 'container-type' ? `${r.code}` : r[display]) || r.id,
      attrs,
      search: [display],
    };
  }
  return external(models)[ref] || null;
};

const labelsFor = async (models, key, rows) => {
  const fields = fieldsOf(key).filter((f) => (f.type === 'm2o' || f.type === 'm2m') && f.ref);
  const idsByRef = new Map();
  for (const r of rows) {
    for (const f of fields) {
      const v = r[f.name];
      const ids = f.type === 'm2m' ? (Array.isArray(v) ? v : []) : (v ? [v] : []);
      if (!ids.length) continue;
      if (!idsByRef.has(f.ref)) idsByRef.set(f.ref, new Set());
      ids.forEach((id) => idsByRef.get(f.ref).add(id));
    }
  }
  const names = new Map();
  for (const [ref, ids] of idsByRef) {
    const t = targetFor(models, ref);
    if (!t || !t.model) continue;
    const found = await t.model.findAll({ where: { id: { [Op.in]: [...ids] } }, attributes: t.attrs, raw: true });
    found.forEach((x) => names.set(`${ref}:${x.id}`, t.label(x)));
  }
  return rows.map((r) => {
    const out = {};
    for (const f of fields) {
      const v = r[f.name];
      if (f.type === 'm2m') out[f.name] = (Array.isArray(v) ? v : []).map((id) => names.get(`${f.ref}:${id}`) || id);
      else if (v) out[f.name] = names.get(`${f.ref}:${v}`) || null;
    }
    return { ...r, _labels: out };
  });
};

/** Options for a link field's dropdown. */
const lookup = async (models, ref, { search, limit = 500, filter = {} } = {}) => {
  const t = targetFor(models, ref);
  if (!t || !t.model) throw httpError(400, `Unknown lookup '${ref}'`);
  const where = { ...(t.where || {}) };
  if (AGENCY_MODELS[ref]) {
    const known = new Set(fieldsOf(ref).map((f) => f.name));
    for (const [k, v] of Object.entries(filter)) {
      if (!known.has(k) && k !== RESOURCES[ref].stateField) continue;
      where[k] = v === 'null' ? null : v;
    }
  }
  if (search) where[Op.or] = t.search.map((s) => ({ [s]: { [Op.like]: `%${search}%` } }));
  const rows = await t.model.findAll({ where, attributes: t.attrs, limit: Math.min(Number(limit) || 500, 2000), order: [[t.search[0], 'ASC']], raw: true });
  return rows.map((r) => ({ id: r.id, label: t.label(r) }));
};

// ── Sequences ────────────────────────────────────────────────────────────────
// ponytail: next number = highest existing suffix + 1, read per create. Two
// creates in the same millisecond could collide; move to a counter row with a
// row lock if bookings ever arrive that fast.
const nextNumber = async (key, field, prefix, pad, suffix = '') => {
  const Model = AGENCY_MODELS[key];
  const rows = await Model.findAll({
    where: { [field]: { [Op.like]: `${prefix}%${suffix}` } }, attributes: [field], raw: true,
  });
  const max = rows.reduce((m, r) => {
    const mid = String(r[field]).slice(prefix.length, suffix ? -suffix.length : undefined);
    const n = parseInt(mid, 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `${prefix}${String(max + 1).padStart(pad, '0')}${suffix}`;
};

// ── Payload shaping ──────────────────────────────────────────────────────────
const clean = (key, body, { creating }) => {
  const spec = specOf(key);
  const out = {};
  for (const f of fieldsOf(key)) {
    // `undefined` means "not sent", so an update never blanks a field the
    // caller did not mention.
    if (!(f.name in body) || body[f.name] === undefined) {
      if (creating && f.defaultValue !== undefined) out[f.name] = f.defaultValue;
      continue;
    }
    let v = body[f.name];
    if (v === '' || v === undefined) v = null;
    if (v !== null) {
      if (['i'].includes(f.type)) v = parseInt(v, 10) || 0;
      else if (['f', '$'].includes(f.type)) v = Number(v) || 0;
      else if (f.type === 'b') v = v === true || v === 'true' || v === 1 || v === '1';
      else if (f.type === 'm2m') v = Array.isArray(v) ? v : [];
      else if (f.type === 'sel' && f.options && !f.options.some(([o]) => String(o) === String(v))) {
        throw httpError(422, `${f.label}: '${v}' is not one of ${f.options.map(([o]) => o).join(', ')}`);
      }
    }
    out[f.name] = v;
  }
  if (spec.stateField && body[spec.stateField] && creating) out[spec.stateField] = body[spec.stateField];
  return out;
};

const missingRequired = (key, data) => fieldsOf(key)
  .filter((f) => f.required && !f.readonly && (data[f.name] === null || data[f.name] === undefined || data[f.name] === ''))
  .map((f) => f.label);

// ── CRUD ─────────────────────────────────────────────────────────────────────
const hooks = () => require('./actions');

const whereFrom = (key, query) => {
  const spec = specOf(key);
  const fields = fieldsOf(key);
  const where = {};
  for (const f of fields) {
    const v = query[f.name];
    if (v === undefined || v === '') continue;
    if (v === 'null') where[f.name] = null;
    else if (f.type === 'b') where[f.name] = v === 'true';
    else if (String(v).includes(',')) where[f.name] = { [Op.in]: String(v).split(',') };
    else where[f.name] = v;
  }
  if (spec.stateField && query.state) {
    where[spec.stateField] = String(query.state).includes(',') ? { [Op.in]: String(query.state).split(',') } : query.state;
  }
  if (query.search) {
    const textCols = fields.filter((f) => f.type === 's' && (f.list || f.name === spec.display)).map((f) => f.name);
    if (textCols.length) where[Op.or] = textCols.map((c) => ({ [c]: { [Op.like]: `%${query.search}%` } }));
  }
  if (query.dateFrom || query.dateTo) {
    const df = fields.find((f) => f.type === 'd' && f.list);
    if (df) {
      where[df.name] = {
        ...(query.dateFrom ? { [Op.gte]: query.dateFrom } : {}),
        ...(query.dateTo ? { [Op.lte]: query.dateTo } : {}),
      };
    }
  }
  return where;
};

const list = async (models, key, query = {}) => {
  specOf(key);
  const Model = AGENCY_MODELS[key];
  let where = whereFrom(key, query);
  const scope = hooks().listScope && hooks().listScope(key, query);
  if (scope) where = { ...where, ...(await scope) };

  const unpaged = query.limit === 'all';
  const limit = Math.min(Number(query.limit) || 50, 500);
  const page = Math.max(Number(query.page) || 1, 1);
  const { count, rows } = await Model.findAndCountAll({
    where,
    order: [[query.sort || 'createdAt', query.dir === 'asc' ? 'ASC' : 'DESC']],
    ...(unpaged ? {} : { limit, offset: (page - 1) * limit }),
    raw: true,
  });
  const withLabels = await labelsFor(models, key, rows);

  // State counts for the list's status chips.
  const spec = RESOURCES[key];
  let stateCounts = null;
  if (spec.stateField) {
    const base = { ...where };
    delete base[spec.stateField];
    const grouped = await Model.findAll({
      where: base,
      attributes: [spec.stateField, [Model.sequelize.fn('COUNT', '*'), 'n']],
      group: [spec.stateField],
      raw: true,
    });
    stateCounts = Object.fromEntries(grouped.map((g) => [g[spec.stateField], Number(g.n)]));
  }
  return {
    rows: withLabels,
    stateCounts,
    pagination: unpaged ? null : { total: count, page, limit, pages: Math.ceil(count / limit) || 1 },
  };
};

const smartCounts = async (models, key, record) => {
  const spec = RESOURCES[key];
  const out = {};
  for (const s of spec.smart || []) {
    if (s.resource) {
      out[s.label] = await AGENCY_MODELS[s.resource].count({ where: { [s.fk]: record.id } });
    } else if (s.kind === 'invoices' || s.kind === 'bills') {
      const types = s.kind === 'invoices' ? ['out_invoice', 'out_refund', 'out_debit'] : ['in_invoice', 'in_refund', 'in_debit'];
      const moves = await models.AccountMove.findAll({
        where: { moveType: { [Op.in]: types } }, attributes: ['id', 'serviceJobRefs'], raw: true,
      });
      out[s.label] = moves.filter((m) => {
        const refs = typeof m.serviceJobRefs === 'string' ? JSON.parse(m.serviceJobRefs || '[]') : (m.serviceJobRefs || []);
        return refs.includes(record.name) || refs.includes(record.id);
      }).length;
    }
  }
  return out;
};

const get = async (models, key, id) => {
  specOf(key);
  const rec = await AGENCY_MODELS[key].findByPk(id, { raw: true });
  if (!rec) throw httpError(404, `${RESOURCES[key].label} not found`);
  const [withLabels] = await labelsFor(models, key, [rec]);
  const acts = hooks().ACTIONS[key] || {};
  const available = Object.entries(acts)
    .filter(([, a]) => !a.when || a.when(rec))
    .map(([k]) => k);
  return { ...withLabels, _actions: available, _counts: await smartCounts(models, key, rec) };
};

const logEntry = (ctx, message) => ({ at: new Date().toISOString(), by: ctx.userName || 'System', message });

const create = async (models, key, body, ctx = {}) => {
  specOf(key);
  const h = hooks();
  let data = clean(key, body, { creating: true });
  if (h.beforeSave) data = (await h.beforeSave(key, data, null, { models, ...ctx })) || data;
  const missing = missingRequired(key, data);
  if (missing.length) throw httpError(422, `Fill in: ${missing.join(', ')}`);
  data.createdBy = ctx.userId || null;
  data.activityLog = [logEntry(ctx, `${RESOURCES[key].label} created`)];
  const rec = await AGENCY_MODELS[key].create(data);
  if (h.afterSave) await h.afterSave(key, rec.get({ plain: true }), null, { models, ...ctx });
  return rec;
};

const update = async (models, key, id, body, ctx = {}) => {
  specOf(key);
  const h = hooks();
  const rec = await AGENCY_MODELS[key].findByPk(id);
  if (!rec) throw httpError(404, `${RESOURCES[key].label} not found`);
  const before = rec.get({ plain: true });
  if (h.guardEdit) {
    const reason = h.guardEdit(key, before);
    if (reason) throw httpError(409, reason);
  }
  let data = clean(key, body, { creating: false });
  delete data.id;
  if (h.beforeSave) data = (await h.beforeSave(key, data, before, { models, ...ctx })) || data;
  const missing = missingRequired(key, { ...before, ...data });
  if (missing.length) throw httpError(422, `Fill in: ${missing.join(', ')}`);
  await rec.update(data);
  if (h.afterSave) await h.afterSave(key, rec.get({ plain: true }), before, { models, ...ctx });
  return rec;
};

const remove = async (models, key, id, ctx = {}) => {
  specOf(key);
  const rec = await AGENCY_MODELS[key].findByPk(id);
  if (!rec) throw httpError(404, `${RESOURCES[key].label} not found`);
  const before = rec.get({ plain: true });
  const h = hooks();
  if (h.guardDelete) {
    const reason = await h.guardDelete(key, before, { models, ...ctx });
    if (reason) throw httpError(409, reason);
  }
  // Child lines go with their parent.
  for (const c of RESOURCES[key].children || []) {
    await AGENCY_MODELS[c.resource].destroy({ where: { [c.fk]: id } });
  }
  await rec.destroy();
  if (h.afterDelete) await h.afterDelete(key, before, { models, ...ctx });
};

const runAction = async (models, key, id, action, body, ctx = {}) => {
  specOf(key);
  const act = (hooks().ACTIONS[key] || {})[action];
  if (!act) throw httpError(404, `Unknown action '${action}'`);
  const rec = await AGENCY_MODELS[key].findByPk(id);
  if (!rec) throw httpError(404, `${RESOURCES[key].label} not found`);
  const plain = rec.get({ plain: true });
  if (act.when && !act.when(plain)) throw httpError(409, `${act.label} is not available in this state`);
  for (const inp of act.input || []) {
    if (inp.required && (body[inp.name] === undefined || body[inp.name] === '' || (Array.isArray(body[inp.name]) && !body[inp.name].length))) {
      throw httpError(422, `${inp.label} is required`);
    }
  }
  const spec = RESOURCES[key];
  const fromState = spec.stateField ? plain[spec.stateField] : null;
  const result = (await act.run(rec, body || {}, { models, A: AGENCY_MODELS, ...ctx })) || {};
  await rec.reload();
  const toState = spec.stateField ? rec[spec.stateField] : null;
  const label = (s) => ((spec.states || []).find(([v]) => v === s) || [s, s])[1];
  const msg = result.message || act.label;
  const entry = logEntry(ctx, fromState !== toState ? `${msg}: ${label(fromState)} → ${label(toState)}` : msg);
  await rec.update({ activityLog: [...(rec.activityLog || []), entry] });
  return result;
};

// ── Meta for the screens ─────────────────────────────────────────────────────
const meta = () => {
  const actions = hooks().ACTIONS;
  const resources = {};
  for (const [key, spec] of Object.entries(RESOURCES)) {
    resources[key] = {
      key,
      label: spec.label,
      display: spec.display || 'name',
      child: !!spec.child,
      stateField: spec.stateField || null,
      states: spec.states || null,
      statusbar: spec.statusbar || (spec.states ? spec.states.map(([v]) => v) : null),
      fields: fieldsOf(key),
      children: spec.children || [],
      smart: spec.smart || [],
      charges: spec.charges || null,
      bulkActions: (spec.bulkActions || []).map((a) => ({ key: a, label: actions[key][a].label })),
      actions: Object.entries(actions[key] || {}).map(([k, a]) => ({
        key: k, label: a.label, input: a.input || null, confirm: a.confirm || null, primary: !!a.primary, danger: !!a.danger,
      })),
    };
  }
  return { resources, menu: MENU };
};

module.exports = {
  list, get, create, update, remove, runAction, lookup, meta, nextNumber, labelsFor, httpError, specOf,
};
