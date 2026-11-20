// Prints a Bill of Lading and a CRO from the Agency clone through the
// instance's own Stimulsoft templates: node scripts/e2e-print.js
const fs = require('fs');
const path = require('path');

const BASE = process.env.CARGOFLO_API || 'http://[::1]:5000/api';
(async () => {
  const login = await (await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@cargoflo.com', password: 'Admin@123' }) })).json();
  const H = { Authorization: `Bearer ${login.data.accessToken}`, 'Content-Type': 'application/json' };
  const call = async (model, method, args = [], kwargs = {}) => (await (await fetch(`${BASE}/odoo/call`, { method: 'POST', headers: H, body: JSON.stringify({ model, method, args, kwargs }) })).json()).result;
  let failed = 0;
  const ok = (label, cond, detail = '') => { if (!cond) failed += 1; console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`); };

  const templates = (await (await fetch(`${BASE}/odoo/print/templates?model=nvocc.service.job`, { headers: H })).json()).result;
  ok('job print templates listed', templates.length >= 8, templates.map((t) => t.name).join(', '));
  const [job] = await call('nvocc.service.job', 'search_read', [], { domain: [], fields: ['name'], limit: 1, count: false });
  const [pb] = await call('nvocc.pre.booking', 'search_read', [], { domain: [], fields: ['name'], limit: 1, count: false });
  for (const [label, tid, id] of [['Bill of Lading', 42, job && job.id], ['CRO', 56, pb && pb.id]]) {
    const json = await (await fetch(`${BASE}/odoo/print/${tid}?res_id=${id}&format=json`, { headers: H })).json();
    ok(`${label} data built from the spec`, json.success && Object.keys(json.result.data).length > 20, `${Object.keys(json.result.data || {}).length} keys`);
    const res = await fetch(`${BASE}/odoo/print/${tid}?res_id=${id}`, { headers: H });
    const buf = Buffer.from(await res.arrayBuffer());
    ok(`${label} renders to PDF`, res.status === 200 && buf.slice(0, 4).toString() === '%PDF', `${res.status} ${buf.length} bytes`);
    if (res.status === 200) fs.writeFileSync(path.join(process.env.TEMP || '.', `${label.replace(/\W+/g, '_')}.pdf`), buf);
  }
  console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
