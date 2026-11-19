// A small Odoo-compatible ORM over the og_* tables.
//
// It speaks the same calls the Odoo web client makes (fields_get,
// fields_view_get, search_read, read, name_search, create, write, unlink,
// default_get, read_group, onchange), with the same value shapes: many2one as
// [id, display_name], x2many as id lists, line edits as commands
// ([0,0,vals] create, [1,id,vals] update, [2,id] delete, [4,id] link,
// [3,id] unlink, [5] clear, [6,0,ids] replace).
const { Op } = require('sequelize');
const R = require('./registry');
const { toWhere } = require('./domain');

const httpError = (status, message) => Object.assign(new Error(message), { statusCode: status });
const cg = () => require('../models');

// ── Display names ────────────────────────────────────────────────────────────
// Learnt per model from the upstream records' own display_name, so a port or
// vessel reads exactly as the instance shows it.
const TEMPLATES = ['{name}', '[{code}] {name}', '{code}', '{name} ({code})', '{code} - {name}', '{code}: {name}', '[{short_name}] {name}', '{display_name}'];
const fill = (t, r) => t.replace(/\{(\w+)\}/g, (_, k) => (r[k] === null || r[k] === undefined || r[k] === false ? '' : String(Array.isArray(r[k]) ? r[k][1] : r[k]))).trim();
const PATTERN = {};
const patternOf = (m) => {
  if (PATTERN[m]) return PATTERN[m];
  const rows = (R.MASTER_DATA && R.MASTER_DATA.records && R.MASTER_DATA.records[m]) || [];
  const withName = rows.filter((r) => r.display_name);
  let best = null;
  for (const t of TEMPLATES.slice(0, -1)) {
    if (!withName.length) break;
    const hits = withName.filter((r) => fill(t, r) === r.display_name).length;
    if (hits / withName.length >= 0.9) { best = t; break; }
  }
  if (!best) {
    const f = R.fieldsOf(m);
    best = f.name ? '{name}' : f.code ? '{code}' : (Object.entries(f).find(([, x]) => x.type === 'char' && x.store !== false) || [])[0] ? `{${Object.entries(f).find(([, x]) => x.type === 'char' && x.store !== false)[0]}}` : '';
  }
  PATTERN[m] = best;
  return best;
};
const displayOf = (m, r) => r.x_display || fill(patternOf(m), r) || `${m},${r.id}`;

const external = (m) => {
  const e = R.EXTERNAL[m];
  return e ? { ...e, Model: cg()[e.model] } : null;
};

/** [[id, name]] for ids of any model (own, external or reference). */
const nameGet = async (m, ids) => {
  const list = [...new Set((ids || []).filter((x) => x !== null && x !== undefined && x !== false && x !== ''))].map(String);
  if (!list.length || !m) return [];
  if (R.isOwn(m)) {
    const rows = await R.MODELS[m].findAll({ where: { id: { [Op.in]: list } }, raw: true });
    return rows.map((r) => [r.id, displayOf(m, r)]);
  }
  const e = external(m);
  if (e) {
    const rows = await e.Model.findAll({ where: { id: { [Op.in]: list } }, attributes: e.attrs, raw: true });
    return rows.map((r) => [r.id, e.label(r)]);
  }
  const rows = await R.OgRef.findAll({ where: { model: m, ref_id: { [Op.in]: list } }, raw: true });
  return rows.map((r) => [isNaN(Number(r.ref_id)) ? r.ref_id : Number(r.ref_id), r.name]);
};

const nameSearchIds = async (m, op, value, limit = 2000) => (await nameSearch(m, value, [], op, limit)).map(([id]) => id);

const nameSearch = async (m, name = '', domain = [], operator = 'ilike', limit = 80) => {
  const like = { [Op.like]: operator === '=' ? name : `%${name || ''}%` };
  if (R.isOwn(m)) {
    const f = R.fieldsOf(m);
    const cols = ['name', 'code', 'short_name', 'display_name'].filter((c) => f[c] && f[c].store !== false);
    let where = await whereFor(m, domain);
    if (name) where = { [Op.and]: [where, { [Op.or]: [...cols.map((c) => ({ [c]: like })), { x_display: like }] }] };
    const rows = await R.MODELS[m].findAll({ where, limit: limit || undefined, order: [['id', 'ASC']], raw: true });
    return rows.map((r) => [r.id, displayOf(m, r)]);
  }
  const e = external(m);
  if (e) {
    const where = name ? { [Op.or]: e.search.map((c) => ({ [c]: like })) } : {};
    const rows = await e.Model.findAll({ where, attributes: e.attrs, limit: limit || undefined, raw: true });
    return rows.map((r) => [r.id, e.label(r)]);
  }
  const rows = await R.OgRef.findAll({ where: { model: m, ...(name ? { name: like } : {}) }, limit: limit || undefined, raw: true });
  return rows.map((r) => [isNaN(Number(r.ref_id)) ? r.ref_id : Number(r.ref_id), r.name]);
};

// ── Search ───────────────────────────────────────────────────────────────────
const inverseIds = async (f, childIds) => {
  if (!R.isOwn(f.relation) || !f.relation_field) return [];
  const where = childIds ? { id: { [Op.in]: childIds } } : {};
  const rows = await R.MODELS[f.relation].findAll({ where, attributes: [f.relation_field], raw: true });
  return [...new Set(rows.map((r) => r[f.relation_field]).filter(Boolean))];
};

const whereFor = async (m, domain) => toWhere(domain || [], {
  model: m,
  fieldsOf: R.fieldsOf,
  nameSearchIds,
  inverseIds,
  resolveIds: async (rel, d) => {
    if (R.isOwn(rel)) return (await R.MODELS[rel].findAll({ where: await whereFor(rel, d), attributes: ['id'], raw: true })).map((r) => r.id);
    const [[field, op, value]] = d;
    if (field === 'name' || field === 'display_name') return nameSearchIds(rel, op, value);
    if (R.isRef(rel)) {
      const rows = await R.OgRef.findAll({ where: { model: rel }, raw: true });
      return rows.filter((r) => {
        const x = (r.data || {})[field];
        return op === '=' ? x == value : op === 'in' ? (value || []).includes(x) : String(x || '').toLowerCase().includes(String(value).toLowerCase()); // eslint-disable-line eqeqeq
      }).map((r) => r.ref_id);
    }
    return [];
  },
});

const orderFor = (m, order) => {
  const f = R.fieldsOf(m);
  const parts = String(order || 'id desc').split(',').map((s) => s.trim().split(/\s+/)).filter(([c]) => c === 'id' || (f[c] && f[c].store !== false && f[c].type !== 'one2many') || c === 'create_date' || c === 'write_date');
  return parts.length ? parts.map(([c, d]) => [c, /desc/i.test(d || '') ? 'DESC' : 'ASC']) : [['id', 'DESC']];
};

const search = async (m, domain = [], { offset = 0, limit = null, order = null } = {}) => {
  if (!R.isOwn(m)) throw httpError(400, `${m} is not searchable here`);
  const rows = await R.MODELS[m].findAll({
    where: await whereFor(m, domain), attributes: ['id'], order: orderFor(m, order),
    offset: offset || 0, ...(limit ? { limit } : {}), raw: true,
  });
  return rows.map((r) => r.id);
};
const searchCount = async (m, domain = []) => R.MODELS[m].count({ where: await whereFor(m, domain) });

// ── Read ─────────────────────────────────────────────────────────────────────
// Non-stored values the views test: counters and related fields.
const COMPUTES = {};
const registerCompute = (m, field, fn) => { COMPUTES[`${m}.${field}`] = fn; };

const relatedValue = async (m, rec, related) => {
  let model = m;
  let cur = rec;
  const pathParts = related.split('.');
  for (let i = 0; i < pathParts.length; i += 1) {
    const key = pathParts[i];
    const f = R.fieldsOf(model)[key];
    const raw = cur ? cur[key] : null;
    if (i === pathParts.length - 1) return { f, raw };
    if (!f || !f.relation || !raw) return { f: null, raw: null };
    const id = Array.isArray(raw) ? raw[0] : raw;
    if (R.isOwn(f.relation)) cur = await R.MODELS[f.relation].findByPk(id, { raw: true });
    else if (R.isRef(f.relation)) {
      const r = await R.OgRef.findOne({ where: { model: f.relation, ref_id: String(id) }, raw: true });
      cur = r ? { ...(r.data || {}), id: r.ref_id, name: r.name } : null;
    } else {
      const e = external(f.relation);
      const r = e ? await e.Model.findByPk(id, { raw: true }) : null;
      cur = r ? { ...r, name: r.companyName || r.name, street: r.streetName, street2: r.street2, zip: r.zip } : null;
    }
    model = f.relation;
  }
  return { f: null, raw: null };
};

const read = async (m, ids, fields = null) => {
  if (!R.isOwn(m)) throw httpError(400, `${m} cannot be read here`);
  const all = R.fieldsOf(m);
  const want = (fields && fields.length ? fields : Object.keys(all)).filter((k) => all[k] || k === 'id' || k === 'display_name');
  const rows = await R.MODELS[m].findAll({ where: { id: { [Op.in]: ids } }, raw: true });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = ids.map((id) => byId.get(Number(id))).filter(Boolean);

  // Batch the many2one names per target model.
  const m2oNames = new Map();
  for (const k of want) {
    const f = all[k];
    if (!f || f.type !== 'many2one') continue;
    const vals = ordered.map((r) => r[k]).filter(Boolean);
    for (const [id, name] of await nameGet(f.relation, vals)) m2oNames.set(`${f.relation}:${id}`, name);
  }

  const out = [];
  for (const r of ordered) {
    const rec = { id: r.id };
    for (const k of want) {
      if (k === 'id') continue;
      if (k === 'display_name') { rec.display_name = displayOf(m, r); continue; }
      const f = all[k];
      if (COMPUTES[`${m}.${k}`]) { rec[k] = await COMPUTES[`${m}.${k}`](r); continue; }
      if (f.type === 'one2many') {
        rec[k] = R.isOwn(f.relation) && f.relation_field
          ? (await R.MODELS[f.relation].findAll({ where: { [f.relation_field]: String(r.id) }, attributes: ['id'], order: [['id', 'ASC']], raw: true })).map((x) => x.id)
          : [];
        continue;
      }
      if (f.store === false) {
        if (f.related) {
          const { f: rf, raw } = await relatedValue(m, r, f.related);
          if (rf && rf.type === 'many2one' && raw) {
            const id = Array.isArray(raw) ? raw[0] : raw;
            const [nm] = await nameGet(rf.relation, [id]);
            rec[k] = nm || false;
          } else rec[k] = raw === undefined || raw === null ? false : raw;
        } else if (/_count$/.test(k) && f.type === 'integer') {
          const o2m = all[k.replace(/_count$/, '_ids')];
          rec[k] = o2m && o2m.type === 'one2many' && R.isOwn(o2m.relation) && o2m.relation_field
            ? await R.MODELS[o2m.relation].count({ where: { [o2m.relation_field]: String(r.id) } }) : 0;
        } else rec[k] = f.type === 'many2many' || f.type === 'one2many' ? [] : f.type === 'boolean' ? false : (['integer', 'float', 'monetary'].includes(f.type) ? 0 : false);
        continue;
      }
      let v = r[k];
      if (f.type === 'many2one') {
        if (!v) { rec[k] = false; continue; }
        const id = R.isOwn(f.relation) || (R.isRef(f.relation) && !isNaN(Number(v))) ? Number(v) : v;
        rec[k] = [id, m2oNames.get(`${f.relation}:${id}`) || m2oNames.get(`${f.relation}:${v}`) || String(v)];
        continue;
      }
      if (f.type === 'many2many') { rec[k] = Array.isArray(v) ? v : (typeof v === 'string' ? JSON.parse(v || '[]') : []); continue; }
      if (f.type === 'monetary' || f.type === 'float') v = v === null || v === undefined ? 0 : Number(v);
      if (f.type === 'integer') v = v === null || v === undefined ? 0 : Number(v);
      if (f.type === 'boolean') v = !!v;
      if (f.type === 'datetime' && v) v = new Date(v).toISOString().replace('T', ' ').slice(0, 19);
      rec[k] = v === null || v === undefined ? false : v;
    }
    out.push(rec);
  }
  return out;
};

const searchRead = async (m, domain, fields, opts = {}) => read(m, await search(m, domain, opts), fields);

// ── Write ────────────────────────────────────────────────────────────────────
const toColumn = (f, v) => {
  if (v === false || v === undefined) return f.type === 'boolean' ? false : null;
  if (f.type === 'many2one') return Array.isArray(v) ? String(v[0]) : String(v);
  if (f.type === 'datetime' && typeof v === 'string') return new Date(v.includes('T') ? v : `${v.replace(' ', 'T')}Z`);
  return v;
};

/** Split vals into column values and x2many commands. */
const prepare = (m, vals) => {
  const all = R.fieldsOf(m);
  const cols = {};
  const lines = [];
  for (const [k, v] of Object.entries(vals || {})) {
    const f = all[k];
    if (!f || R.SYSTEM_FIELDS.has(k)) continue;
    if (f.type === 'one2many') { lines.push([k, f, v]); continue; }
    if (f.type === 'many2many') { lines.push([k, f, v]); continue; }
    if (f.store === false || f.readonly_compute) continue;
    cols[k] = toColumn(f, v);
  }
  return { cols, lines };
};

const applyLines = async (m, id, lines, ctx) => {
  const rec = await R.MODELS[m].findByPk(id);
  for (const [k, f, cmds] of lines) {
    if (f.type === 'many2many') {
      let cur = Array.isArray(rec[k]) ? [...rec[k]] : [];
      for (const c of (Array.isArray(cmds) ? cmds : [])) {
        if (!Array.isArray(c)) continue;
        if (c[0] === 6) cur = [...(c[2] || [])];
        else if (c[0] === 4) cur = [...new Set([...cur, c[1]])];
        else if (c[0] === 3) cur = cur.filter((x) => x != c[1]); // eslint-disable-line eqeqeq
        else if (c[0] === 5) cur = [];
      }
      await rec.update({ [k]: cur });
      continue;
    }
    if (!R.isOwn(f.relation) || !f.relation_field) continue;
    for (const c of (Array.isArray(cmds) ? cmds : [])) {
      if (!Array.isArray(c)) continue;
      if (c[0] === 0) await create(f.relation, { ...(c[2] || {}), [f.relation_field]: id }, ctx);
      else if (c[0] === 1) await write(f.relation, [c[1]], c[2] || {}, ctx);
      else if (c[0] === 2) await unlink(f.relation, [c[1]], ctx);
      else if (c[0] === 3) await R.MODELS[f.relation].update({ [f.relation_field]: null }, { where: { id: c[1] } });
      else if (c[0] === 4) await R.MODELS[f.relation].update({ [f.relation_field]: String(id) }, { where: { id: c[1] } });
      else if (c[0] === 5) await R.MODELS[f.relation].update({ [f.relation_field]: null }, { where: { [f.relation_field]: String(id) } });
      else if (c[0] === 6) {
        await R.MODELS[f.relation].update({ [f.relation_field]: null }, { where: { [f.relation_field]: String(id) } });
        await R.MODELS[f.relation].update({ [f.relation_field]: String(id) }, { where: { id: { [Op.in]: c[2] || [] } } });
      }
    }
  }
};

const hooks = () => require('./methods');

const create = async (m, vals, ctx = {}) => {
  if (!R.isOwn(m)) throw httpError(400, `${m} cannot be created here`);
  const defaults = await defaultGet(m, Object.keys(R.fieldsOf(m)), ctx);
  let merged = { ...defaults, ...vals };
  if (hooks().beforeCreate) merged = (await hooks().beforeCreate(m, merged, ctx)) || merged;
  const { cols, lines } = prepare(m, merged);
  const missing = Object.entries(R.fieldsOf(m)).filter(([k, f]) => f.required && f.store !== false && f.type !== 'one2many' && !f.related
    && (cols[k] === null || cols[k] === undefined || cols[k] === '') && !lines.some(([n]) => n === k)).map(([, f]) => f.string);
  if (missing.length) throw httpError(422, `The following fields are invalid: ${missing.join(', ')}`);
  cols.create_uid = ctx.uid || null;
  cols.write_uid = ctx.uid || null;
  const rec = await R.MODELS[m].create(cols);
  await applyLines(m, rec.id, lines, ctx);
  if (hooks().afterWrite) await hooks().afterWrite(m, [rec.id], merged, ctx, true);
  return rec.id;
};

const write = async (m, ids, vals, ctx = {}) => {
  if (!R.isOwn(m)) throw httpError(400, `${m} cannot be written here`);
  let v = vals;
  if (hooks().beforeWrite) v = (await hooks().beforeWrite(m, ids, vals, ctx)) || vals;
  const { cols, lines } = prepare(m, v);
  cols.write_uid = ctx.uid || null;
  for (const id of ids) {
    await R.MODELS[m].update(cols, { where: { id } });
    await applyLines(m, id, lines, ctx);
  }
  if (hooks().afterWrite) await hooks().afterWrite(m, ids, v, ctx, false);
  return true;
};

const unlink = async (m, ids, ctx = {}) => {
  if (hooks().beforeUnlink) await hooks().beforeUnlink(m, ids, ctx);
  // Lines go with their parent (ondelete cascade upstream).
  for (const [, f] of Object.entries(R.fieldsOf(m))) {
    if (f.type === 'one2many' && R.isOwn(f.relation) && f.relation_field) {
      const child = await R.MODELS[f.relation].findAll({ where: { [f.relation_field]: { [Op.in]: ids.map(String) } }, attributes: ['id'], raw: true });
      if (child.length) await unlink(f.relation, child.map((c) => c.id), ctx);
    }
  }
  await R.MODELS[m].destroy({ where: { id: { [Op.in]: ids } } });
  return true;
};

// ── Defaults ─────────────────────────────────────────────────────────────────
const defaultGet = async (m, fields, ctx = {}) => {
  const up = (R.MASTER_DATA && R.MASTER_DATA.defaults && R.MASTER_DATA.defaults[m]) || {};
  const all = R.fieldsOf(m);
  const out = {};
  for (const k of fields || Object.keys(all)) {
    const f = all[k];
    if (!f) continue;
    if (k in up) {
      const v = up[k];
      // Upstream user/company ids mean "the current one" here.
      if (f.type === 'many2one' && f.relation === 'res.users') out[k] = ctx.uid || false;
      else if (f.type === 'many2one' && f.relation === 'res.partner') continue;
      else out[k] = v;
    } else if (f.type === 'date' && f.required) out[k] = new Date().toISOString().slice(0, 10);
  }
  if (hooks().defaults) Object.assign(out, await hooks().defaults(m, ctx));
  return out;
};

// ── Group by (list grouping and search panel counts) ─────────────────────────
const readGroup = async (m, domain, groupby) => {
  const field = String(Array.isArray(groupby) ? groupby[0] : groupby).split(':')[0];
  const f = R.fieldsOf(m)[field];
  if (!f || f.store === false) return [];
  const Model = R.MODELS[m];
  const rows = await Model.findAll({
    where: await whereFor(m, domain), attributes: [field, [Model.sequelize.fn('COUNT', '*'), '__count']], group: [field], raw: true,
  });
  let names = new Map();
  if (f.type === 'many2one') names = new Map((await nameGet(f.relation, rows.map((r) => r[field]))).map(([id, n]) => [String(id), n]));
  return rows.map((r) => {
    const v = r[field];
    let value = v === null ? false : v;
    if (f.type === 'many2one') value = v ? [isNaN(Number(v)) ? v : Number(v), names.get(String(v)) || String(v)] : false;
    if (f.type === 'selection' && v) value = v;
    return { [field]: value, [`${field}_count`]: Number(r.__count), __count: Number(r.__count), __domain: [[field, '=', v === null ? false : (f.type === 'many2one' ? (isNaN(Number(v)) ? v : Number(v)) : v)]] };
  });
};

module.exports = {
  search, searchCount, read, searchRead, nameGet, nameSearch, create, write, unlink, defaultGet, readGroup,
  registerCompute, displayOf, httpError, whereFor,
};
