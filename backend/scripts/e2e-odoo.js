// Smoke test for the SearatesERP Agency clone API (/api/odoo).
// Run against a running backend: node scripts/e2e-odoo.js
const BASE = process.env.CARGOFLO_API || 'http://[::1]:5000/api';
let T = '';
let failed = 0;
const call = async (method, path, body) => {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(T ? { Authorization: `Bearer ${T}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = null;
  try { j = await r.json(); } catch { /* empty */ }
  return { code: r.status, j };
};
const kw = async (model, method, args = [], kwargs = {}) => {
  const r = await call('POST', '/odoo/call', { model, method, args, kwargs });
  if (r.code !== 200) return { ERR: `${r.code} ${r.j && r.j.message}` };
  return r.j.result;
};
const ok = (label, cond, detail = '') => {
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
};

(async () => {
  T = (await call('POST', '/auth/login', { email: 'admin@cargoflo.com', password: 'Admin@123' })).j.data.accessToken;

  const menus = (await call('GET', '/odoo/menus')).j.result;
  ok('menus served with actions', menus.length > 30, `${menus.length} entries`);
  ok('Sea Export menu opens nvocc.service.job filtered to export', menus.some((m) => m.path === 'Operations/Jobs/Sea Export' && m.action.res_model === 'nvocc.service.job' && /shipment_type_id/.test(m.action.domain)));

  const views = await kw('nvocc.service.job', 'load_views', [[[false, 'tree'], [false, 'form'], [false, 'search']]]);
  ok('job form/list/search views load', views.fields_views && views.fields_views.form && views.fields_views.tree && views.fields_views.search);

  const ports = await kw('freight.port', 'search_read', [[], ['name', 'display_name']], { limit: 5 });
  ok('master ports seeded', ports.length === 597 || ports.length > 100, `${ports.length} ports`);
  const ns = await kw('freight.port', 'name_search', [], { name: 'JEA', limit: 5 });
  ok('name_search on ports', Array.isArray(ns) && ns.length > 0, JSON.stringify(ns[0]));
  const st = await kw('shipment.type', 'search_read', [[], ['name', 'display_name']]);
  ok('shipment types keep upstream ids', st.records.some((s) => s.id === 1), st.records.map((s) => `${s.id}:${s.display_name}`).join(' '));

  const defaults = await kw('nvocc.pre.booking', 'default_get', [['state', 'company_id', 'user_id', 'date', 'source']]);
  ok('pre-booking defaults from upstream', defaults.state === 'draft', JSON.stringify(defaults));

  // Create a pre-booking with a container line through x2many commands.
  const ctype = (await kw('freight.container.type', 'name_search', [], { name: '20', limit: 1 }))[0];
  const cargo = (await kw('cargo.type', 'search_read', [[], ['name']])).records[0];
  const pol = ns[0];
  const id = await kw('nvocc.pre.booking', 'create', [{
    date: new Date().toISOString().slice(0, 10), shipment_type_id: 1, cargo_type_id: cargo && cargo.id, port_of_loading_id: pol && pol[0],
    pre_booking_container_line_ids: ctype ? [[0, 0, { container_type_id: ctype[0], quantity: 2 }]] : [],
  }]);
  ok('pre-booking created with numbering', typeof id === 'number', JSON.stringify(id));
  const [pb] = await kw('nvocc.pre.booking', 'read', [[id], ['name', 'cro_no', 'state', 'port_of_loading_id', 'pre_booking_container_line_ids', 'display_name']]);
  ok('read returns upstream shapes', pb && /^PB-SEA-EXP-/.test(pb.name) && Array.isArray(pb.port_of_loading_id) && pb.pre_booking_container_line_ids.length === 1, JSON.stringify(pb));
  ok('write updates', (await kw('nvocc.pre.booking', 'write', [[id], { remarks: 'e2e' }])) === true);
  const found = await kw('nvocc.pre.booking', 'search_read', [[['remarks', '=', 'e2e']], ['name']]);
  ok('domain search', found.length >= 1);
  const grouped = await kw('nvocc.pre.booking', 'read_group', [[], ['state'], ['state']]);
  ok('read_group by state', Array.isArray(grouped) && grouped.some((g) => g.state === 'draft'), JSON.stringify(grouped).slice(0, 120));
  ok('unlink', (await kw('nvocc.pre.booking', 'unlink', [[id]])) === true);
  console.log(`\n${failed ? `${failed} FAILED` : 'ALL PASS'}`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
