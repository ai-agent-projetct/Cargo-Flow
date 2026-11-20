// Every report wizard of the Agency clone returns a real XLSX:
// node scripts/e2e-reports.js
const BASE = process.env.CARGOFLO_API || 'http://[::1]:5000/api';
(async () => {
  const login = await (await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@cargoflo.com', password: 'Admin@123' }) })).json();
  const H = { Authorization: `Bearer ${login.data.accessToken}`, 'Content-Type': 'application/json' };
  const call = async (model, method, args = [], kwargs = {}) => {
    const j = await (await fetch(`${BASE}/odoo/call`, { method: 'POST', headers: H, body: JSON.stringify({ model, method, args, kwargs }) })).json();
    return j.success ? j.result : { ERR: j.message };
  };
  let failed = 0;
  const partner = ((await call('nvocc.service.job', 'search_read', [], { domain: [['customer_id', '!=', false]], fields: ['customer_id'], limit: 1, count: false }))[0] || {}).customer_id;
  const cases = [
    ['wizard.operation.report', 'print_report', ['vessel', 'container', 'loading', 'job_list', 'job_statistics', 'do_status', 'receive_agreed'].map((t) => ({ operation_report: t, container_ownership: 'all' }))],
    ['wizard.cro.customer.summary.report', 'print_report', [{ report_type: 'operation_cro_report' }, { report_type: 'customer_cro_report' }]],
    ['wizard.principal.soa.report', 'print_report', ['summary', 'export', 'import', 'detention', 'other', 'pending_do'].map((t) => ({ principal_report: t, based_on: 'job_date' }))],
    ['wizard.freight.manifest.job.report', 'print_xls', ['freight_manifest', 'freight_summary', 'freight_recapitulation'].map((t) => ({ report_type: t }))],
    ['invoice.list.outstanding.report', 'print_report', [{}]],
    ['wizard.customer.due.report', 'print_xlsx_report', [{}]],
    ['wizard.tax.payment.report', 'print_report', [{}]],
    ['wizard.account.principal.soa.report', 'print_report', [{}]],
    ['wiz.balance.confirmation.report', 'action_partner_balance_info', [{ partner_id: partner && partner[0] }]],
    ['wizard.bank.ledger.detail.report', 'print_report', [{}]],
  ];
  for (const [model, method, variants] of cases) {
    for (const vals of variants) {
      const id = await call(model, 'create', [vals]);
      const res = typeof id === 'number' ? await call(model, method, [[id]]) : id;
      const okx = res && res.type === 'cf.download' && res.download.encoding === 'base64' && res.download.content.startsWith('UEsDB');
      if (!okx) failed += 1;
      console.log(`${okx ? 'PASS' : 'FAIL'}  ${model} ${JSON.stringify(vals)}  ${okx ? res.download.filename : JSON.stringify(res).slice(0, 160)}`);
    }
  }
  console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e.message); process.exit(1); });
