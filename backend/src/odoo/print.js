// Printed documents of the Agency clone: the instance's own Stimulsoft
// templates (agency-print.json) filled with JSON built by its own print
// specs (product.json.specification + properties).
//
// A spec property is either a field of the record (nested through another
// spec for links) or a Python snippet; snippets run unchanged in
// py/spec_runner.py against a snapshot of the record and its links.
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const R = require('./registry');

const orm = () => require('./orm');
const PRINT_FILE = path.join(__dirname, '../agency/upstream/agency-print.json');
let PRINT = null;
const print = () => {
  if (!PRINT) PRINT = fs.existsSync(PRINT_FILE) ? JSON.parse(fs.readFileSync(PRINT_FILE, 'utf8')) : { templates: [], reports: [] };
  return PRINT;
};
const recs = (m) => (R.MASTER_DATA && R.MASTER_DATA.records && R.MASTER_DATA.records[m]) || [];
const SPECS = () => recs('product.json.specification');
const PROPS = () => recs('product.json.specification.property');
const idOf = (v) => (Array.isArray(v) ? v[0] : v);

// ── Snapshot: the record and its links as plain JSON ─────────────────────────
const partnerOf = async (id) => {
  const { Organization } = require('../models');
  const o = id ? await Organization.findByPk(id, { raw: true }) : null;
  if (!o) return null;
  return {
    _model: 'res.partner', id: o.id, name: o.companyName || o.name, display_name: o.companyName || o.name,
    street: o.streetName || '', street2: o.street2 || '', city: o.city || '', zip: o.zip || '',
    country_id: o.country ? { _model: 'res.country', id: o.country, name: o.country, display_name: o.country } : null,
    state_id: o.state ? { _model: 'res.country.state', id: o.state, name: o.state } : null,
    phone: o.phone || '', mobile: o.mobile || '', email: o.email || '', vat: o.vat || '', ref: o.customerCode || '', website: o.website || '',
  };
};
const refOf = async (model, id) => {
  const r = id ? await R.OgRef.findOne({ where: { model, ref_id: String(id) }, raw: true }) : null;
  if (!r) return null;
  const data = typeof r.data === 'string' ? JSON.parse(r.data) : (r.data || {});
  return { ...data, _model: model, id: isNaN(Number(r.ref_id)) ? r.ref_id : Number(r.ref_id), name: data.name || r.name, display_name: r.name };
};
const companyOf = async () => {
  const c = await R.OgRef.findOne({ where: { model: 'res.company' }, raw: true });
  if (!c) return null;
  const d = typeof c.data === 'string' ? JSON.parse(c.data) : (c.data || {});
  const country = d.country_id ? await refOf('res.country', d.country_id) : null;
  const state = d.state_id ? await refOf('res.country.state', d.state_id) : null;
  return { ...d, _model: 'res.company', id: Number(c.ref_id), name: d.name || c.name, display_name: c.name, country_id: country, state_id: state, currency_id: d.currency_id ? await refOf('res.currency', d.currency_id) : null };
};

const snapshot = async (model, id, depth = 2, seen = new Set()) => {
  if (!id) return null;
  if (model === 'res.partner') return partnerOf(id);
  if (model === 'res.company') return companyOf();
  if (!R.isOwn(model)) return R.isRef(model) ? refOf(model, id) : { _model: model, id, name: String(id), display_name: String(id) };
  const key = `${model}:${id}`;
  const [row] = await orm().read(model, [Number(id)]);
  if (!row) return null;
  const fields = R.fieldsOf(model);
  // Field types let the runner hand snippets dates and empty recordsets.
  const out = { _model: model, _types: Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, f.type])) };
  for (const [k, v] of Object.entries(row)) {
    const f = fields[k];
    if (!f || !f.relation) { out[k] = v; continue; }
    if (f.type === 'many2one') {
      const rid = idOf(v);
      if (!rid) { out[k] = null; continue; }
      out[k] = depth > 0 && !seen.has(`${f.relation}:${rid}`)
        ? await snapshot(f.relation, rid, depth - 1, new Set([...seen, key]))
        : { _model: f.relation, id: rid, name: Array.isArray(v) ? v[1] : String(rid), display_name: Array.isArray(v) ? v[1] : String(rid) };
    } else {
      const ids = Array.isArray(v) ? v.slice(0, 300) : [];
      out[k] = depth > 0 ? (await Promise.all(ids.map((x) => snapshot(f.relation, x, depth - 1, new Set([...seen, key]))))).filter(Boolean) : ids.map((x) => ({ _model: f.relation, id: x }));
    }
  }
  return out;
};

// env.ref('module.xml_id') targets the snippets use, matched by name:
// freight_base.org_type_shipper -> res.partner.type "Shipper".
const xmlidsFor = (codes) => {
  const ids = new Set();
  for (const c of codes) for (const m of String(c).matchAll(/env\.ref\(\s*['"]([\w.]+)['"]/g)) ids.add(m[1]);
  const types = recs('res.partner.type');
  const out = {};
  for (const x of ids) {
    const tail = x.split('.').pop().replace(/^(org_type_|res_partner_type_|type_)/, '').replace(/_/g, ' ').toLowerCase();
    const hit = types.find((t) => String(t.name || '').toLowerCase() === tail) || types.find((t) => String(t.name || '').toLowerCase().replace(/\s+/g, '') === tail.replace(/\s+/g, ''));
    if (hit) out[x] = { _model: 'res.partner.type', id: hit.id, name: hit.name, display_name: hit.display_name || hit.name };
  }
  return out;
};

const runPython = (payload) => new Promise((resolve) => {
  const py = spawn(process.env.PYTHON || 'python', ['-I', path.join(__dirname, 'py/spec_runner.py')], { stdio: ['pipe', 'pipe', 'pipe'] });
  let out = '';
  let errOut = '';
  const timer = setTimeout(() => py.kill(), 20000);
  py.stdout.on('data', (d) => { out += d; });
  py.stderr.on('data', (d) => { errOut += d; });
  py.on('close', () => {
    clearTimeout(timer);
    try { resolve(JSON.parse(out || '{}')); } catch (e) { resolve({ __errors__: { runner: errOut.slice(0, 500) || e.message } }); }
  });
  py.on('error', (e) => { clearTimeout(timer); resolve({ __errors__: { runner: e.message } }); });
  py.stdin.end(JSON.stringify(payload));
});

// ── Spec -> JSON ─────────────────────────────────────────────────────────────
const buildSpec = async (specId, model, id, ctx, depth = 0, snapCache = new Map()) => {
  const spec = SPECS().find((s) => s.id === specId);
  if (!spec || !id || depth > 4) return {};
  const props = PROPS().filter((p) => idOf(p.specification_id) === specId).sort((a, b) => a.id - b.id);
  const key = `${model}:${id}`;
  if (!snapCache.has(key)) snapCache.set(key, await snapshot(model, id, 2));
  const snap = snapCache.get(key) || {};
  const empty = (ttype) => (spec.empty_string_for_non_bool && ttype !== 'boolean' ? '' : false);

  const py = props.filter((p) => p.property_type !== 'field' && String(p.python_code || '').split('\n').some((l) => l.trim() && !l.trim().startsWith('#')));
  const pyOut = py.length ? await runPython({
    record: snap,
    env: { user: { _model: 'res.users', id: ctx.uid || 0, name: ctx.userName || '', company_id: await companyOf() }, xmlids: xmlidsFor(py.map((p) => p.python_code)), refs: { 'res.partner.type': recs('res.partner.type').map((t) => ({ ...t, _model: 'res.partner.type' })) } },
    snippets: py.map((p) => ({ name: p.name, code: p.python_code })),
  }) : {};

  const nested = async (p, value) => {
    const sub = idOf(p.property_specification_id);
    const subSpec = SPECS().find((s) => s.id === sub);
    if (!sub || !subSpec) return value;
    const build = (v) => (v && v.id ? buildSpec(sub, v._model || subSpec.model_name, v.id, ctx, depth + 1, snapCache) : {});
    if (Array.isArray(value)) return Promise.all(value.map(build));
    return value ? build(value) : (['one2many', 'many2many'].includes(p.ttype) ? [] : {});
  };

  const out = {};
  for (const p of props) {
    let v;
    if (p.property_type === 'field') {
      v = snap[p.ir_model_field_name || p.name];
      if (p.property_specification_id) v = await nested(p, v);
      else if (v && typeof v === 'object' && !Array.isArray(v)) v = v.display_name || v.name || '';
      else if (Array.isArray(v)) v = v.map((x) => (x && typeof x === 'object' ? (x.display_name || x.name) : x));
    } else {
      v = pyOut[p.name];
      if (p.property_specification_id && v && typeof v === 'object') v = await nested(p, v);
    }
    out[p.name] = v === false || v === null || v === undefined ? empty(p.ttype) : v;
  }
  if (pyOut.__errors__ && depth === 0) out.__print_errors__ = pyOut.__errors__;
  return out;
};

const templatesFor = (model) => print().templates
  .filter((t) => t.model_name === model)
  .map((t) => ({ id: t.id, name: t.name, output_type: t.output_type }));

const render = async (templateId, resId, ctx) => {
  const t = print().templates.find((x) => x.id === Number(templateId));
  if (!t) throw Object.assign(new Error('Print template not found'), { statusCode: 404 });
  if (!R.isOwn(t.model_name)) throw Object.assign(new Error(`${t.name} prints from ${t.model_name}, which the clone does not hold`), { statusCode: 400 });
  const data = await buildSpec(idOf(t.json_spec_id), t.model_name, resId, ctx);
  return { id: t.id, name: t.name, output_type: t.output_type, mrt: Buffer.from(t.mrt_file || '', 'base64').toString('utf8'), data };
};

// ── Render with the Stimulsoft engine (the same engine upstream uses) ────────
// Without STIMULSOFT_LICENSE_KEY the engine runs in trial mode and stamps a
// watermark; set the company's key in the backend .env to remove it.
let STI = null;
const sti = () => {
  if (!STI) {
    STI = require('stimulsoft-reports-js');
    if (process.env.STIMULSOFT_LICENSE_KEY) STI.Base.StiLicense.key = process.env.STIMULSOFT_LICENSE_KEY;
  }
  return STI;
};

// The template's data sources are JSON paths flattened with '_' (root,
// root_company_address, root_routes_ids...). A path with no data would leave
// its source undefined and every text bound to it a parser error, so each
// missing one gets a single blank row, as an empty list prints upstream.
const ensureSources = (mrt, data) => {
  const sources = Object.values((mrt.Dictionary && mrt.Dictionary.DataSources) || {})
    .map((s) => String(s.NameInSource || s.Name || '').split('.').pop())
    .filter((n) => n.startsWith('root_'));
  for (const full of sources) {
    let node = data;
    let rest = full.slice(5);
    while (rest) {
      const cur = Array.isArray(node) ? (node[0] || (node[0] = {})) : node;
      const key = Object.keys(cur).filter((k) => rest === k || rest.startsWith(`${k}_`)).sort((a, b) => b.length - a.length)[0];
      if (!key) { cur[rest] = [{}]; break; }
      if (rest === key) {
        if (cur[key] === '' || cur[key] === false || cur[key] === null || (Array.isArray(cur[key]) && !cur[key].length)) cur[key] = [{}];
        else if (typeof cur[key] !== 'object') cur[key] = [{ value: cur[key] }];
        break;
      }
      if (cur[key] === '' || cur[key] === false || cur[key] === null) cur[key] = {};
      node = cur[key];
      rest = rest.slice(key.length + 1);
    }
  }
  return data;
};

/** A filled template as PDF bytes. */
const renderPdf = async (templateId, resId, ctx) => {
  const doc = await render(templateId, resId, ctx);
  const S = sti();
  const report = new S.Report.StiReport();
  report.load(doc.mrt);
  const mrt = JSON.parse(doc.mrt);
  const dbs = Object.values((mrt.Dictionary && mrt.Dictionary.Databases) || {});
  const name = (dbs[0] && dbs[0].Name) || 'data';
  report.dictionary.databases.clear();
  const ds = new S.System.Data.DataSet(name);
  const { __print_errors__: _skip, ...data } = doc.data;
  ds.readJson(JSON.stringify(ensureSources(mrt, data)));
  report.regData(name, name, ds);
  await new Promise((resolve) => report.renderAsync(resolve));
  const bytes = await new Promise((resolve) => report.exportDocumentAsync((d) => resolve(d), S.Report.StiExportFormat.Pdf));
  return { name: doc.name, pdf: Buffer.from(bytes), errors: doc.data.__print_errors__ || null };
};

const modelOf = (templateId) => (print().templates.find((x) => x.id === Number(templateId)) || {}).model_name || null;

module.exports = { templatesFor, render, renderPdf, buildSpec, snapshot, modelOf };
