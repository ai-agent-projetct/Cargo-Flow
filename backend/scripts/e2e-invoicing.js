// End-to-end: quote -> approve -> FF job (charges copied) -> customer invoice
// and vendor bill pulled from the job's charges -> post -> charges and job
// roll-up follow -> reset reverses.
// Run against a live backend: node scripts/e2e-invoicing.js
// [::1] rather than localhost, because another local service may hold 127.0.0.1:5000.
const BASE = process.env.CARGOFLO_API || 'http://[::1]:5000/api';
let T = '';
const call = async (method, path, body) => {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(T ? { Authorization: `Bearer ${T}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null;
  try { j = await r.json(); } catch { /* empty */ }
  return { code: r.status, j };
};
const ok = (label, cond, detail = '') => console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
const n = (v) => Math.round(Number(v || 0) * 100) / 100;

(async () => {
  T = (await call('POST', '/auth/login', { email: 'admin@cargoflo.com', password: 'Admin@123' })).j.data.accessToken;

  // --- 1. Quote with charges -> approve -> FF job ---------------------------
  const quotes = (await call('GET', '/quotations/?limit=200')).j.data;
  const list = Array.isArray(quotes) ? quotes : quotes.quotations || quotes.rows;
  const candidates = list.filter((q) => !q.isMultimodal && ['draft', 'sent', 'pending'].includes(q.status) && !q.ffJobId);
  let quote = null;
  for (const q of candidates) {
    const cl = (await call('GET', `/charge-lines?parentType=quote&parentId=${q.id}&limit=all`)).j.data.lines;
    if (cl.length) { quote = { ...q, lineCount: cl.length }; break; }
  }
  ok('found an open single-mode quote with charge lines', !!quote, quote ? `${quote.quoteNumber} (${quote.lineCount} lines)` : '');
  if (!quote) return;

  let r = await call('POST', `/quotations/${quote.id}/approve`, {});
  ok('approve route exists and approves', r.code === 200, `${r.code} ${r.j && r.j.message}`);

  r = await call('POST', `/quotations/${quote.id}/convert-to-ffjob`, {});
  ok('convert-to-ffjob creates a job', r.code === 201, `${r.code} ${r.j && r.j.message}`);
  const job = r.j && r.j.data && r.j.data.ffJob;
  if (!job) return;

  const jobLines = (await call('GET', `/charge-lines?parentType=house_shipment&parentId=${job.id}&limit=all`)).j.data.lines;
  const cost = jobLines.filter((l) => l.side === 'cost');
  const rev = jobLines.filter((l) => l.side === 'revenue');
  ok('quote charges copied as cost + revenue pairs', cost.length === quote.lineCount && rev.length === quote.lineCount,
    `${cost.length} cost / ${rev.length} revenue from ${quote.lineCount}`);
  ok('pairs cross-linked', rev.every((l) => l.pairLineId && cost.some((c) => c.id === l.pairLineId)));

  let jobNow = (await call('GET', `/ffjobs/${job.id}`)).j.data;
  const estRev = n(jobNow.estimatedRevenue);
  ok('job roll-up has estimated revenue', estRev > 0, `est rev ${estRev} cost ${n(jobNow.estimatedCost)}`);

  // --- 2. Customer invoice pulled from the job ------------------------------
  r = await call('POST', '/accounting/moves?menu=invoices', {
    partner: 'QA Customer', partnerId: quote.customerId, invoiceDate: new Date().toISOString().slice(0, 10), currency: 'AED',
  });
  ok('draft customer invoice created', r.code === 201, `${r.code}`);
  const inv = r.j.data;
  r = await call('POST', `/accounting/moves/${inv.id}/pull-charges`, { kind: 'house', refs: [jobNow.jobNumber] });
  const pulled = (r.j.data.lines || []).filter((l) => l.chargeLineId);
  ok('invoice pulls the job revenue charges', pulled.length === rev.length, `${pulled.length} of ${rev.length} (${r.j.message})`);
  const invRec = r.j.data;
  const sumIncl = n(rev.reduce((s, l) => s + Number(l.totalSellAmountIncl), 0));
  ok('invoice total = revenue charges incl. VAT', Math.abs(n(invRec.amountTotal) - sumIncl) < 0.05,
    `invoice ${n(invRec.amountTotal)} vs charges ${sumIncl}; VAT ${n(invRec.amountTax)}`);
  ok('VAT is 5% of untaxed', Math.abs(n(invRec.amountTax) - n(invRec.amountUntaxed) * 0.05) < 0.05);

  r = await call('POST', `/accounting/moves/${inv.id}/confirm`, { overrideCreditLimit: true });
  ok('invoice posts', r.code === 200, `${r.code} ${r.j.message} ${r.j.data && r.j.data.name}`);
  const ji = r.j.data.journalItems || [];
  const dr = n(ji.reduce((s, x) => s + Number(x.debit), 0));
  const cr = n(ji.reduce((s, x) => s + Number(x.credit), 0));
  ok('customer invoice journal balances', dr === cr && dr > 0, `Dr ${dr} = Cr ${cr}`);
  ok('customer invoice debits Accounts Receivable', ji.some((x) => /Receivable/.test(x.account) && Number(x.debit) > 0));
  ok('customer invoice credits Sales and VAT Payable',
    ji.some((x) => /Sales/.test(x.account) && Number(x.credit) > 0) && ji.some((x) => /VAT Payable/.test(x.account) && Number(x.credit) > 0));

  const revAfter = (await call('GET', `/charge-lines?parentType=house_shipment&parentId=${job.id}&side=revenue&limit=all`)).j.data.lines;
  ok('revenue charges now fully invoiced', revAfter.every((l) => l.billingStatus === 'fully_invoiced'),
    revAfter.map((l) => l.billingStatus).join(','));
  jobNow = (await call('GET', `/ffjobs/${job.id}`)).j.data;
  ok('job actual revenue follows the invoice', Math.abs(n(jobNow.receivedRevenue) - sumIncl) < 0.05, `received ${n(jobNow.receivedRevenue)}`);

  // Pulling again must refuse: nothing left to invoice.
  r = await call('POST', '/accounting/moves?menu=invoices', { partner: 'QA Customer', partnerId: quote.customerId, currency: 'AED' });
  const inv2 = r.j.data;
  r = await call('POST', `/accounting/moves/${inv2.id}/pull-charges`, { kind: 'house', refs: [jobNow.jobNumber] });
  ok('second invoice refuses already-invoiced charges', r.code === 409, `${r.code} ${r.j.message}`);
  await call('DELETE', `/accounting/moves/${inv2.id}`);

  // --- 3. Vendor bill pulled from the same job ------------------------------
  r = await call('POST', '/accounting/moves?menu=bills', { partner: 'QA Vendor', currency: 'AED' });
  const bill = r.j.data;
  r = await call('POST', `/accounting/moves/${bill.id}/pull-charges`, { kind: 'house', refs: [jobNow.jobNumber] });
  const billLines = (r.j.data.lines || []).filter((l) => l.chargeLineId);
  ok('bill pulls the job cost charges', billLines.length === cost.length, `${billLines.length} of ${cost.length}`);
  r = await call('POST', `/accounting/moves/${bill.id}/confirm`, {});
  const bji = (r.j.data && r.j.data.journalItems) || [];
  ok('vendor bill posts', r.code === 200, `${r.code} ${r.j.message}`);
  ok('vendor bill credits Accounts Payable (not Receivable)',
    bji.some((x) => /Payable/.test(x.account) && !/VAT/.test(x.account) && Number(x.credit) > 0)
    && !bji.some((x) => /Receivable/.test(x.account) && !/VAT/.test(x.account)));
  ok('vendor bill debits Cost of Services', bji.some((x) => /Cost/.test(x.account) && Number(x.debit) > 0));
  const bdr = n(bji.reduce((s, x) => s + Number(x.debit), 0));
  const bcr = n(bji.reduce((s, x) => s + Number(x.credit), 0));
  ok('vendor bill journal balances', bdr === bcr && bdr > 0, `Dr ${bdr} = Cr ${bcr}`);
  jobNow = (await call('GET', `/ffjobs/${job.id}`)).j.data;
  ok('job paid cost follows the bill', n(jobNow.paidCost) > 0, `paid ${n(jobNow.paidCost)} actual margin ${n(jobNow.receivedMargin)}`);

  // --- 4. Reset reverses -----------------------------------------------------
  r = await call('POST', `/accounting/moves/${inv.id}/reset-to-draft`, {});
  ok('posted invoice resets to draft', r.code === 200, `${r.code}`);
  const revReset = (await call('GET', `/charge-lines?parentType=house_shipment&parentId=${job.id}&side=revenue&limit=all`)).j.data.lines;
  ok('reset puts revenue charges back to not billed', revReset.every((l) => l.billingStatus === 'no'), revReset.map((l) => l.billingStatus).join(','));
  jobNow = (await call('GET', `/ffjobs/${job.id}`)).j.data;
  ok('job actual revenue back to zero', n(jobNow.receivedRevenue) === 0, `received ${n(jobNow.receivedRevenue)}`);

  // Re-post so the QA job ends in a realistic, fully invoiced state.
  r = await call('POST', `/accounting/moves/${inv.id}/confirm`, { overrideCreditLimit: true });
  ok('invoice re-posts', r.code === 200);

  console.log(`\nQA job ${jobNow.jobNumber}  invoice ${inv.id}  bill ${bill.id}`);
})().catch((e) => console.error('SCRIPT ERROR', e));
