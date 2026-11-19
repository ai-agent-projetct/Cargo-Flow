// End-to-end: Liner Agency / NVOCC module against a running backend.
//   booking -> CRO -> approval -> export job (containers + charges copied)
//   -> tariff charge assignment -> BL -> invoice posted in Accounting -> job
//   roll-up follows; import job -> manifest -> index -> D/O; EDI import with a
//   discrepancy that resolves once mapped; inspection -> repair -> recharge.
// Run: node scripts/e2e-agency.js   (CARGOFLO_API overrides the base URL)
const BASE = process.env.CARGOFLO_API || 'http://[::1]:5000/api';
let T = '';
let failed = 0;
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
const ok = (label, cond, detail = '') => {
  if (!cond) failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
};
const act = (res, id, action, body) => call('POST', `/agency/${res}/${id}/actions/${action}`, body);
const today = new Date().toISOString().slice(0, 10);

(async () => {
  T = (await call('POST', '/auth/login', { email: 'admin@cargoflo.com', password: 'Admin@123' })).j.data.accessToken;
  const look = async (ref, search) => ((await call('GET', `/agency/lookup/${encodeURIComponent(ref)}?search=${encodeURIComponent(search || '')}`)).j.data || [])[0];

  const customer = await look('org', 'KHAS TRADING');
  const pol = await look('port', 'PKKHI');
  const pod = await look('port', 'AEJEA');
  const t20 = await look('container-type', '20SD');
  ok('lookups resolve', customer && pol && pod && t20);

  // --- Booking -> export job ------------------------------------------------
  let r = await call('POST', '/agency/pre-booking', {
    date: today, clientId: customer.id, shipmentType: 'export', cargoType: 'FCL', portOfLoadingId: pol.id, portOfDischargeId: pod.id,
    grossWeight: 20000, volume: 30, allowApproval: true,
  });
  ok('pre-booking created with numbers', r.code === 201 && /^PB-SEA-EXP-FCL\//.test(r.j.data.name) && r.j.data.croNo, `${r.code} ${r.j.data && r.j.data.name} CRO ${r.j.data && r.j.data.croNo}`);
  const pb = r.j.data;
  r = await act('pre-booking', pb.id, 'generate-cro');
  ok('CRO refused without containers', r.code === 422, r.j.message);
  await call('POST', '/agency/pre-booking-container', { preBookingId: pb.id, containerTypeId: t20.id, quantity: 2, soc: 'N' });
  for (const a of ['generate-cro', 'send-for-approval', 'approve']) {
    r = await act('pre-booking', pb.id, a);
    ok(`booking ${a}`, r.code === 200, `${r.code} ${r.j.message}`);
  }
  r = await call('PUT', `/agency/pre-booking/${pb.id}`, { remarks: 'late edit' });
  ok('approved booking is locked', r.code === 409, r.j.message);
  r = await act('pre-booking', pb.id, 'convert-to-export-job');
  ok('converts to export job', r.code === 200 && r.j.result.redirect, r.j.message);
  const jobId = r.j.result.redirect.id;
  let job = (await call('GET', `/agency/job/${jobId}`)).j.data;
  ok('job numbered and linked', /^SEA-E-FCL-/.test(job.name) && job.preBookingId === pb.id && job.croNo === pb.croNo, job.name);
  ok('booked boxes became container lines', job.teuTotal === 2, `TEU ${job.teuTotal}`);
  r = await act('pre-booking', pb.id, 'convert-to-export-job');
  ok('cannot convert twice', r.code === 409, r.j.message);

  // --- Containers, tariff charges, BL ---------------------------------------
  const lines = (await call('GET', `/agency/container-line?jobId=${jobId}&limit=all`)).j.data;
  const num = `CFAU${String(Date.now()).slice(-6)}`;
  r = await call('PUT', `/agency/container-line/${lines[0].id}`, { containerNumber: num + 0, sealNumber: 'S1' });
  ok('container number registers the box', r.code === 200 && r.j.data.containerRegistryId, r.j.message);
  r = await act('job', jobId, 'assign-charges');
  ok('tariff charges assigned', r.code === 200, r.j.message);
  const charges = (await call('GET', `/charge-lines?parentType=nvocc_job&parentId=${jobId}&limit=all`)).j.data.lines;
  ok('job has revenue and cost lines', charges.some((l) => l.side === 'revenue') && charges.some((l) => l.side === 'cost'), `${charges.length} lines`);
  r = await act('job', jobId, 'assign-charges');
  const again = (await call('GET', `/charge-lines?parentType=nvocc_job&parentId=${jobId}&limit=all`)).j.data.lines;
  ok('re-assigning adds nothing', again.length === charges.length, r.j.message);
  job = (await call('GET', `/agency/job/${jobId}`)).j.data;
  ok('job roll-up has revenue, cost, margin', Number(job.estimatedRevenue) > 0 && Number(job.estimatedCost) > 0, `rev ${job.estimatedRevenue} cost ${job.estimatedCost} margin ${job.estimatedMargin}`);
  r = await act('job', jobId, 'generate-bl');
  ok('BL generated', r.code === 200 && r.j.data.hblNumber && r.j.data.state === 'bl_generated', r.j.message);
  r = await act('job', jobId, 'export-edi');
  ok('EDI export is XML with the BL', r.j.result.download && r.j.result.download.content.includes(r.j.data.hblNumber));

  // --- Invoice through Accounting -------------------------------------------
  r = await act('job', jobId, 'generate-invoice');
  ok('draft invoice from job charges', r.code === 200 && /invoices\//.test(r.j.result.link), r.j.message);
  const moveId = r.j.result.link.split('/').pop();
  r = await call('POST', `/accounting/moves/${moveId}/confirm`, { overrideCreditLimit: true });
  ok('invoice posts', r.code === 200, `${r.code} ${r.j.message} ${r.j.data && r.j.data.name}`);
  job = (await call('GET', `/agency/job/${jobId}`)).j.data;
  ok('job received revenue follows the posted invoice', Number(job.receivedRevenue) > 0 && job.state === 'invoice_generated', `received ${job.receivedRevenue}`);
  ok('job shows the invoice', job._counts.Invoices >= 1, JSON.stringify(job._counts));
  r = await act('job', jobId, 'generate-invoice');
  ok('second invoice refused', r.code === 409, r.j.message);
  r = await call('DELETE', `/agency/job/${jobId}`);
  ok('invoiced job cannot be deleted', r.code === 409, r.j.message);

  // --- Import: manifest, index, D/O -----------------------------------------
  const vessel = await look('md:vessel', 'GSL');
  r = await call('POST', '/agency/job', { shipmentType: 'import', shipmentDate: today, customerId: customer.id, hblNumber: `E2E${Date.now()}`, originPortId: pod.id, destinationPortId: pol.id });
  const imp = r.j.data;
  ok('import job numbered', /^SEA-I-FCL-/.test(imp.name), imp.name);
  r = await call('POST', '/agency/manifest', { shipmentType: 'import', vesselId: vessel.id, voyageNumber: 'E2E1', lastPortCallId: pod.id, igmNo: '9999', igmDate: today, startingIndex: 50 });
  const man = r.j.data;
  ok('manifest numbered', /^IMP-MH-\d{5}\/\d\d$/.test(man.name), man.name);
  r = await act('manifest', man.id, 'attach-jobs', { jobIds: [imp.id] });
  ok('job attached to manifest', r.code === 200 && r.j.data.serviceJobCount === 1, r.j.message);
  r = await act('manifest', man.id, 'update-job-index');
  const impNow = (await call('GET', `/agency/job/${imp.id}`)).j.data;
  ok('index and IGM written to the job', impNow.indexNumber === '050' && impNow.igmNumber === '9999', `${impNow.indexNumber} ${impNow.igmNumber}`);
  r = await act('job', imp.id, 'generate-do');
  ok('D/O refused before request', r.code === 409, r.j.message);
  for (const a of ['arrival-notice', 'request-do', 'generate-do']) {
    r = await act('job', imp.id, a);
    ok(`import ${a}`, r.code === 200, r.j.message);
  }
  ok('D/O numbered with validity', /^DO-/.test(r.j.data.doNumber) && r.j.data.doValidity, `${r.j.data.doNumber} valid ${r.j.data.doValidity}`);

  // --- EDI import with a discrepancy ----------------------------------------
  const bl = `EDI${Date.now()}`;
  // Unique per run: a value mapped by an earlier run resolves, as it should.
  const unknownPort = `NOWHERE-${bl.slice(-6)}`;
  const xml = `<shipments><shipment><BLNumber>${bl}</BLNumber><Customer>KHAS TRADING CO</Customer><PortOfLoading>${unknownPort}</PortOfLoading><PortOfDischarge>PKKHI</PortOfDischarge><Vessel>GSL ELIZABETH</Vessel><Voyage>E2E</Voyage><container><ContainerNo>${num}1</ContainerNo><ContainerType>40HC</ContainerType></container></shipment></shipments>`;
  r = await call('POST', '/agency/edi/import', { content: xml, filename: 'e2e.xml', shipmentType: 'import' });
  ok('EDI creates the job', r.code === 201 && r.j.data.created.length === 1, r.j.message);
  ok('unknown port reported as a discrepancy', r.j.data.discrepancies.some((d) => d.includes(unknownPort)));
  const disc = (await call('GET', `/agency/edi-mapping?search=${unknownPort}`)).j.data[0];
  ok('discrepancy stored for mapping', !!disc);
  await call('PUT', `/agency/edi-mapping/${disc.id}`, { resId: pod.id, resValue: pod.label });
  r = await call('POST', '/agency/edi/import', { content: xml.replace(bl, `${bl}B`), filename: 'e2e.xml', shipmentType: 'import' });
  ok('mapped value resolves on the next import', r.j.data.discrepancies.length === 0, r.j.message);

  // --- Inspection -> repair -> recharge -------------------------------------
  const box = (await call('GET', `/agency/container-registry?name=${num}0`)).j.data[0];
  const type = await look('maintenance-request-type', 'Inspection');
  const team = await look('maintenance-team', '');
  const me = await look('user', 'admin');
  r = await call('POST', '/agency/maintenance-request', { name: 'E2E inspection', containerId: box.id, requestDate: today, requestTypeId: type.id, teamId: team.id, userId: me.id, priority: '3', jobId });
  const mr = r.j.data;
  ok('maintenance request numbered', /^MR\//.test(mr.requestNumber), mr.requestNumber);
  await act('maintenance-request', mr.id, 'start');
  const checks = (await call('GET', `/agency/maintenance-check-result?requestId=${mr.id}&limit=all`)).j.data;
  ok('checklist generated on start', checks.length > 0, `${checks.length} checks`);
  await call('PUT', `/agency/maintenance-check-result/${checks[0].id}`, { result: 'damaged', remark: 'dent' });
  r = await act('maintenance-request', mr.id, 'create-repair-request');
  ok('repair request raised from damage', r.code === 200 && r.j.result.redirect, r.j.message);
  const rrId = r.j.result.redirect.id;
  for (const a of ['send-for-approval', 'approve', 'start', 'mark-repaired', 'done']) {
    r = await act('repair-request', rrId, a);
    ok(`repair ${a}`, r.code === 200, r.j.message);
  }
  const recharge = (await call('GET', `/charge-lines?parentType=nvocc_job&parentId=${jobId}&limit=all`)).j.data.lines.find((l) => /MAINTAINANCE/.test(l.chargeDescription));
  ok('repair recharged to the job', !!recharge, recharge ? `${recharge.totalSellAmount} AED` : '');
  const boxNow = (await call('GET', `/agency/container-registry/${box.id}`)).j.data;
  ok('registry shows the latest activity', boxNow._labels.lastActivityTypeId === 'RCVR', boxNow._labels.lastActivityTypeId);

  // --- Reports ---------------------------------------------------------------
  for (const id of ['nvocc-op-job-list', 'nvocc-cro-operation', 'nvocc-soa-summary', 'nvocc-container-maintenance', 'nvocc-op-do-status']) {
    r = await call('GET', `/accounting/reports/${id}`);
    ok(`report ${id}`, r.code === 200 && r.j.data.rows.length > 0, `${r.j.data && r.j.data.rows.length} rows`);
  }
  console.log(`\n${failed ? `${failed} FAILED` : 'ALL PASS'}  job ${job.name}  import ${imp.name}`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
