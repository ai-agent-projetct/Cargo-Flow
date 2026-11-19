// Liner Agency tables and seed data.
//
// Tables are created with CREATE TABLE IF NOT EXISTS (Model.sync without
// alter), so this never touches an existing table. Masters are seeded only
// into empty tables; demo traffic only when there are no jobs. Transactions are
// driven through the same service and workflow code the screens use, so the
// seed doubles as a smoke test of every button it presses.
const { DataTypes } = require('sequelize');
const { AGENCY_MODELS: A } = require('./models');
const { RESOURCES, fieldsOf } = require('./spec');
const containerNo = require('../utils/containerNumber');

const ensureAgencyTables = async (sequelize) => {
  const qi = sequelize.getQueryInterface();
  for (const [key, Model] of Object.entries(A)) {
    await Model.sync();
    // A field added to spec.js after the table exists is added as a column.
    const cols = await qi.describeTable(RESOURCES[key].table);
    for (const [name, attr] of Object.entries(Model.rawAttributes)) {
      if (cols[name]) continue;
      await qi.addColumn(RESOURCES[key].table, name, { type: attr.type, allowNull: true, defaultValue: attr.defaultValue });
      console.log(`  ${RESOURCES[key].table} + ${name}`);
    }
  }
  console.log(`  Liner Agency tables ready (${Object.keys(A).length})`);
};

const seedIfEmpty = async (key, rows) => {
  if (await A[key].count()) return [];
  const out = [];
  for (const r of rows) out.push(await A[key].create(r));
  return out;
};

// From container.activity.type on the Agency instance.
const ACTIVITY_TYPES = [
  ['SNTA', 'SENT FOR AUCTION', 'full'], ['DCHF', 'DISCHARGED FULL', 'full'], ['DFRE', 'DISCHARGE FOR TRANSHIPMENT', 'full'],
  ['SNTD', 'DESTUFFING', 'full'], ['LFRE', 'LOADED AS TRANSSHIPMENT', 'full'], ['LODF', 'LOADED FULL', 'full', true],
  ['LOSS', 'TOTAL LOSS', 'full'], ['PURC', 'CONTAINER PURCHASE', 'full'], ['OFHI', 'OFF HIRE', 'full'], ['ONHI', 'ON HIRE', 'full'],
  ['DCHE', 'DISCHARGED EMPTY', 'empty', false, true], ['RCVC', 'RECEIVED FROM CONSIGNEE', 'empty', false, true],
  ['RCVF', 'RECEIVED FULL', 'full'], ['RCVR', 'RECEIVED AFTER REPAIR', 'full'], ['RCVS', 'RECEIVED FROM SHIPPER', 'full'],
  ['SALE', 'CONTAINER SALE', 'full'], ['SNTC', 'SENT TO CONSIGNEE', 'full'], ['SNTR', 'SENT FOR REPAIR', 'full'],
  ['TRDO', 'TRANSFER TO UPCOUNTRY (OUT)', 'empty'], ['SSTF', 'SENT FOR DOCK STUFFING', 'full'], ['TRDI', 'TRANSFER TO UPCOUNTRY (IN)', 'empty'],
  ['TRFF', 'TRANSFERRED FULL', 'full'], ['AUCD', 'AUCTION DISCHARGED', 'full'], ['AUCL', 'AUCTION DELIVERED', 'full'],
  ['AUCR', 'AUCTION EMPTY RECEIVED', 'empty'], ['TRFE', 'TRANSFERRED EMPTY', 'empty'], ['RCES', 'SHIPPER RETURN', 'empty'],
  ['SNTS', 'SENT TO SHIPPER', 'empty'], ['LODE', 'LOADED EMPTY', 'empty'], ['RCVE', 'RECEIVED EMPTY', 'empty'],
];

const CONTAINER_TYPES = [
  ['20SD', '20ft Standard Dry', '22G1', 1, 'dry', 2200, 28200], ['40SD', '40ft Standard Dry', '42G1', 2, 'dry', 3750, 26730],
  ['40HC', '40ft High Cube', '45G1', 2, 'dry', 3900, 26580], ['45HC', '45ft High Cube', 'L5G1', 2, 'dry', 4800, 27700],
  ['20RF', '20ft Reefer', '22R1', 1, 'reefer', 3080, 27400], ['40RF', '40ft Reefer High Cube', '45R1', 2, 'reefer', 4800, 29200],
  ['20OT', '20ft Open Top', '22U1', 1, 'open_top', 2350, 28130], ['40OT', '40ft Open Top', '42U1', 2, 'open_top', 3850, 26630],
  ['20FR', '20ft Flat Rack', '22P1', 1, 'flat_rack', 2700, 31300], ['40FR', '40ft Flat Rack', '45P3', 2, 'flat_rack', 5000, 40000],
  ['20TK', '20ft Tank', '22T6', 1, 'tank', 3650, 32350],
];

const TERMINALS = [
  ['HUTCHISON AJMAN INTERNATIONAL TERMINAL (HAJT)', 'HAJT', 'AEAJM', 'Hutchison Ports'],
  ['PORT OF FUJAIRAH', 'FJR', 'AEFJR', 'Fujairah Port Authority'],
  ['DP WORLD JEBEL ALI - CT1', 'DPWJA', 'AEJEA', 'DP World'], ['DP WORLD JEBEL ALI - CT2', 'DPWJ2', 'AEJEA', 'DP World'],
  ['DP WORLD JEBEL ALI - CT3', 'DPWJ3', 'AEJEA', 'DP World'], ['DP WORLD JEBEL ALI - CT4', 'DPWJ4', 'AEJEA', 'DP World'],
  ['CSP ABU DHABI TERMINAL', 'CSP', 'AEKHL', 'COSCO Shipping Ports'], ['KHALIFA PORT CONTAINER TERMINAL', 'ADT', 'AEKHL', 'AD Ports'],
  ['KHORFAKKAN CONTAINER TERMINAL', 'KCTKLF', 'AEKLF', 'Gulftainer'], ['MINA SAQR CONTAINER TERMINAL', 'SAQR', 'AERKT', 'RAK Ports'],
  ['SHARJAH CONTAINER TERMINAL', 'SHJSCT', 'AESHJ', 'Gulftainer'],
  ['KARACHI INTERNATIONAL CONTAINER TERMINAL', 'KICT', 'PKKHI', 'Hutchison Ports'],
  ['QASIM INTERNATIONAL CONTAINER TERMINAL', 'QICT', 'PKBQM', 'DP World'],
  ['SOUTH ASIA PAKISTAN TERMINALS', 'SAPT', 'PKKHI', 'Hutchison Ports'],
  ['DP WORLD JEDDAH - SOUTH CONTAINER TERMINAL', 'DPWJED', 'SAJED', 'DP World'],
];

const CHECKLIST = [
  ['Floor boards', 'interior'], ['Side panels (inside)', 'interior'], ['Roof (inside)', 'interior'], ['Odour / cleanliness', 'interior'],
  ['Lashing rings', 'interior'], ['Doors & gaskets', 'exterior'], ['Locking bars & cams', 'exterior'], ['Corner castings', 'exterior'],
  ['Side panels (outside)', 'exterior'], ['Markings & CSC plate', 'exterior'],
];

const REPAIR_ACTIVITIES = [
  ['General Repair', 'RGEN', 60], ['Floor board replacement', 'RFLR', 180], ['Side panel straightening', 'RSID', 120],
  ['Door gasket replacement', 'RDGS', 75], ['Locking bar repair', 'RLCK', 55], ['Container washing', 'RWSH', 25],
  ['Roof patch weld', 'RROF', 150], ['Corner casting weld', 'RCRN', 95],
];

const ensureOrg = async (models, name, partyTypes, extra = {}) => {
  const { Organization } = models;
  const { Op } = require('sequelize');
  let org = await Organization.findOne({ where: { [Op.or]: [{ name }, { companyName: name }] } });
  if (!org) org = await Organization.create({ companyType: 'company', name, companyName: name, partyTypes, isActive: true, ...extra });
  else {
    const types = Array.isArray(org.partyTypes) ? org.partyTypes : [];
    const merged = [...new Set([...types, ...partyTypes])];
    if (merged.length !== types.length) await org.update({ partyTypes: merged });
  }
  return org;
};

const ensurePort = async (models, code, name, country, countryCode) => {
  const [p] = await models.Port.findOrCreate({ where: { code }, defaults: { code, name, country, countryCode, type: 'sea', city: name.replace(/^Port of /, ''), status: 'active' } });
  return p;
};

const ensureMd = async (models, category, name, code = null) => {
  const [m] = await models.MasterDataItem.findOrCreate({ where: { category, name }, defaults: { category, name, code, isActive: true } });
  return m;
};

const seedMasters = async (models) => {
  await seedIfEmpty('container-type', CONTAINER_TYPES.map(([code, name, isoCode, teu, category, tareWeight, maxPayload]) => ({ code, name, isoCode, teu, category, tareWeight, maxPayload })));
  await seedIfEmpty('container-status', ['Normal', 'Damaged', 'Under Repair', 'Off Hire'].map((name) => ({ name })));
  await seedIfEmpty('container-activity-type', ACTIVITY_TYPES.map(([code, name, status, isDefault, isLast], i) => ({
    code, name, status, sysActivityCode: code, sequence: i + 1, isDefaultActivity: !!isDefault, isLastActivity: !!isLast,
  })));
  await seedIfEmpty('shipment-job-type', [{ name: 'Liner Agency/NVOCC', code: 'NVOCC' }, { name: 'Feeder', code: 'FEEDER' }]);
  await seedIfEmpty('job-stage', ['Booking', 'Documentation', 'Customs', 'Vessel Operation', 'Delivery', 'Closed'].map((name, i) => ({ name, sequence: (i + 1) * 10, active: true })));
  await seedIfEmpty('shipment-status', ['On Time', 'Delayed', 'Rolled Over', 'Short Shipped', 'Delivered'].map((name) => ({ name, active: true })));

  const ports = {
    AEJEA: await models.Port.findOne({ where: { code: 'AEJEA' } }) || await ensurePort(models, 'AEJEA', 'Port of Dubai (Jebel Ali)', 'United Arab Emirates', 'AE'),
    PKKHI: await ensurePort(models, 'PKKHI', 'Port of Karachi', 'Pakistan', 'PK'),
    PKBQM: await ensurePort(models, 'PKBQM', 'Port Qasim', 'Pakistan', 'PK'),
    SAJED: await ensurePort(models, 'SAJED', 'Port of Jeddah', 'Saudi Arabia', 'SA'),
    LKCMB: await models.Port.findOne({ where: { code: 'LKCMB' } }) || await ensurePort(models, 'LKCMB', 'Port of Colombo', 'Sri Lanka', 'LK'),
    AEKHL: await ensurePort(models, 'AEKHL', 'Khalifa Port', 'United Arab Emirates', 'AE'),
  };
  if (!(await A.terminal.count())) {
    for (const [name, terminalCode, unLocode, companyName] of TERMINALS) {
      const port = ports[unLocode] || await models.Port.findOne({ where: { code: unLocode } });
      await A.terminal.create({ name, terminalCode, unLocode, companyName, portId: port ? port.id : null });
    }
  }

  const admin = await models.User.findOne({ where: { email: 'admin@cargoflo.com' } }) || await models.User.findOne();
  await seedIfEmpty('maintenance-request-type', [{ name: 'Inspection' }, { name: 'Pre-Trip Inspection (Reefer)' }, { name: 'Off-Hire Survey' }]);
  if (!(await A['maintenance-team'].count()) && admin) await A['maintenance-team'].create({ name: 'Maintenance Team', userId: admin.id, memberIds: [admin.id] });
  if (!(await A['maintenance-checklist'].count())) {
    const insp = await A['maintenance-request-type'].findOne({ where: { name: 'Inspection' } });
    for (const [i, [name, category]] of CHECKLIST.entries()) await A['maintenance-checklist'].create({ name, category, requestTypeId: insp.id, sequence: (i + 1) * 10 });
  }
  await seedIfEmpty('repair-activity', REPAIR_ACTIVITIES.map(([name, chargeCode, defaultPrice]) => ({ name, chargeCode, defaultPrice })));
  await seedIfEmpty('work-center', [
    { name: 'Jebel Ali M&R Yard', code: 'JAMR', location: 'Jebel Ali Free Zone', capacity: 40 },
    { name: 'Karachi Depot Workshop', code: 'KHIW', location: 'Karachi', capacity: 25 },
  ]);
  await seedIfEmpty('edi-map-type', [
    { name: 'Port of Loading', targetRef: 'port', field: 'originPortId', active: true },
    { name: 'Port of Discharge', targetRef: 'port', field: 'destinationPortId', active: true },
    { name: 'Vessel', targetRef: 'md:vessel', field: 'vesselId', active: true },
    { name: 'Shipping Line', targetRef: 'carrier', field: 'shippingLineId', active: true },
  ]);
  await seedIfEmpty('edi-template', [{
    name: 'Unifeeder IGM XML', code: 'UNI-IGM', mode: 'xml', targetResource: 'job', recordTag: 'shipment', containerTag: 'container', active: true,
    description: 'Import manifest feed: one <shipment> per BL with nested <container> elements.',
    lines: [{ tag: 'BLNumber', field: 'hblNumber' }, { tag: 'Consignee', field: 'customerId' }],
  }]);
  await seedIfEmpty('cheque-book', [{ name: 'ENBD Current Account', bank: 'Emirates NBD', accountNumber: '1015-XXXX-01', startNumber: 100001, endNumber: 100100, nextNumber: 100014, active: true }]);
  return { ports, admin };
};

// ── Demo traffic ─────────────────────────────────────────────────────────────
const seedTraffic = async (models, { ports, admin }) => {
  if (await A.job.count()) return;
  const svc = require('./service');
  const ctx = { userId: admin && admin.id, userName: (admin && admin.name) || 'Administrator' };
  const run = (key, id, action, body = {}) => svc.runAction(models, key, id, action, body, ctx);
  const make = (key, body) => svc.create(models, key, body, ctx);

  // Parties
  const unifeeder = await ensureOrg(models, 'UNIFEEDER SHIPPING UK LTD', ['Principal', 'Vendor'], { customerCode: 'USUL-2', country: 'United Kingdom' });
  const xpress = await ensureOrg(models, 'X-PRESS FEEDERS', ['Principal', 'Vendor'], { customerCode: 'XPF-1', country: 'Singapore' });
  const cust = {};
  for (const [name, code] of [['KHAS TRADING CO', 'KTC-7'], ['SOHAIL INTERNATIONAL', 'SI-4'], ['VALDETRON', 'V-1'], ['ANWAR CO', 'AC-4'], ['MAGNET LOGISTICS INTERNATIONAL', 'MLI-1'], ['STAR FREIGHT (PVT) LTD', 'SFL-1']]) {
    cust[code] = await ensureOrg(models, name, ['Customer'], { customerCode: code, country: 'Pakistan' });
  }
  const [uniLine] = await models.Carrier.findOrCreate({ where: { name: 'UNIFEEDER' }, defaults: { name: 'UNIFEEDER', code: 'UNIF', type: 'shipping_line' } });
  const vessel = {};
  for (const v of ['DP WORLD JEDDAH', 'GSL ELIZABETH', 'WAN HAI 316', 'X-PRESS MEKONG']) vessel[v] = await ensureMd(models, 'vessel', v);
  const depot = await ensureMd(models, 'warehouse-depot', 'Jebel Ali Container Depot');
  const fob = await models.MasterDataItem.findOne({ where: { category: 'incoterm', name: 'FREE ON BOARD' } });
  const team = await models.SalesTeam.findOne();
  const jobType = await A['shipment-job-type'].findOne({ where: { code: 'NVOCC' } });
  const T = Object.fromEntries((await A['container-type'].findAll({ raw: true })).map((t) => [t.code, t.id]));

  // Container registry: real ISO 6346 numbers owned by the principals.
  const boxes = [];
  for (let i = 0; i < 24; i += 1) {
    const type = ['20SD', '40HC', '40HC', '20SD', '40RF', '40SD'][i % 6];
    boxes.push(await make('container-registry', {
      name: containerNo.make(i % 4 === 3 ? 'XPFU' : 'UNFU', 414031 + i * 37), containerTypeId: T[type],
      principalId: i % 4 === 3 ? xpress.id : unifeeder.id, yom: 2016 + (i % 8), weightLimit: type.startsWith('20') ? 30480 : 32500, weightUom: 'kg',
    }));
  }
  // Opening position: every box received empty at the depot.
  const empty = await A['container-status'].findOne({ where: { name: 'Normal' } });
  const yard = await models.MasterDataItem.findOne({ where: { category: 'location-type' } });
  const act = Object.fromEntries((await A['container-activity-type'].findAll({ raw: true })).map((a) => [a.code, a.id]));
  for (const b of boxes) {
    await make('container-activity', {
      containerId: b.id, activityTypeId: act.RCVE, date: '2026-10-01', containerStatusId: empty.id, containerStatus: 'empty',
      locationTypeId: yard && yard.id, location: 'Jebel Ali Container Depot', principalId: b.principalId, isOpening: true,
    });
  }

  // Tariffs: general sell, a customer-specific sell, the terminal's buy, detention.
  const tariff = async (body, lines) => {
    const t = await make('charges-tariff', { transportMode: 'sea', currency: 'USD', validFrom: '2026-01-01', validTo: '2026-12-31', ...body });
    for (const l of lines) await make('tariff-line', { tariffId: t.id, currency: 'USD', ...l });
    await run('charges-tariff', t.id, 'approve');
    return t;
  };
  await tariff({ name: 'GENERAL TARIFF EXPORT - USD', tariffType: 'sell_tariff', tariffBase: 'normal', operation: 'export' }, [
    { chargeCode: 'OFRT', chargeDescription: 'OCEAN FREIGHT', containerTypeId: T['20SD'], measurementBasis: 'container', rate: 450 },
    { chargeCode: 'OFRT', chargeDescription: 'OCEAN FREIGHT', containerTypeId: T['40HC'], measurementBasis: 'container', rate: 780 },
    { chargeCode: 'OFRT', chargeDescription: 'OCEAN FREIGHT', containerTypeId: T['40RF'], measurementBasis: 'container', rate: 1650 },
    { chargeCode: 'THCO', chargeDescription: 'TERMINAL HANDLING CHARGES (ORIGIN)', measurementBasis: 'teu', rate: 95 },
    { chargeCode: 'BLFE', chargeDescription: 'BL FEE', measurementBasis: 'bl', rate: 50 },
    { chargeCode: 'SEAL', chargeDescription: 'SEAL CHARGES', measurementBasis: 'container', rate: 10 },
  ]);
  await tariff({ name: 'KHAS TRADING', tariffType: 'sell_tariff', tariffBase: 'srr', operation: 'export', clientId: cust['KTC-7'].id }, [
    { chargeCode: 'OFRT', chargeDescription: 'OCEAN FREIGHT', containerTypeId: T['20SD'], measurementBasis: 'container', rate: 410 },
    { chargeCode: 'OFRT', chargeDescription: 'OCEAN FREIGHT', containerTypeId: T['40HC'], measurementBasis: 'container', rate: 720 },
    { chargeCode: 'THCO', chargeDescription: 'TERMINAL HANDLING CHARGES (ORIGIN)', measurementBasis: 'teu', rate: 90 },
    { chargeCode: 'BLFE', chargeDescription: 'BL FEE', measurementBasis: 'bl', rate: 45 },
  ]);
  await tariff({ name: 'KICT TARIFF', tariffType: 'buy_tariff', tariffBase: 'normal', operation: 'export', principalId: unifeeder.id }, [
    { chargeCode: 'OFRT', chargeDescription: 'SLOT COST', containerTypeId: T['20SD'], measurementBasis: 'container', rate: 300 },
    { chargeCode: 'OFRT', chargeDescription: 'SLOT COST', containerTypeId: T['40HC'], measurementBasis: 'container', rate: 540 },
    { chargeCode: 'OFRT', chargeDescription: 'SLOT COST', containerTypeId: T['40RF'], measurementBasis: 'container', rate: 1200 },
    { chargeCode: 'THCO', chargeDescription: 'TERMINAL HANDLING (KICT)', measurementBasis: 'teu', rate: 70 },
  ]);
  await tariff({ name: 'GENERAL TARIFF IMPORT - USD', tariffType: 'sell_tariff', tariffBase: 'normal', operation: 'import' }, [
    { chargeCode: 'DOFE', chargeDescription: 'DELIVERY ORDER FEE', measurementBasis: 'bl', rate: 100 },
    { chargeCode: 'THCD', chargeDescription: 'TERMINAL HANDLING CHARGES (DESTINATION)', measurementBasis: 'teu', rate: 110 },
    { chargeCode: 'CCLN', chargeDescription: 'CONTAINER CLEANING', measurementBasis: 'container', rate: 20 },
  ]);
  await tariff({ name: 'DETENTION TARIFF', tariffType: 'sell_tariff', tariffBase: 'normal', operation: 'import', validFrom: '2026-01-01', validTo: '2026-12-31' }, [
    { chargeCode: 'DETN', chargeDescription: 'DETENTION CHARGES', measurementBasis: 'container', rate: 25, chargeType: 'ccx' },
  ]);

  // Pre-bookings in every state, built and moved through the real buttons.
  const booking = async (code, extra, containers, steps) => {
    const b = await make('pre-booking', {
      date: '2026-11-10', bookingExpiryDate: '2026-12-10', clientId: cust[code].id, teamId: team && team.id, userId: admin && admin.id,
      shipmentType: 'export', cargoType: 'FCL', packagingMode: 'container', shipmentJobTypeId: jobType.id, incoterm: fob && fob.id,
      originLocation: 'KARACHI', portOfLoadingId: ports.PKKHI.id, portOfDischargeId: ports.AEJEA.id, destinationLocation: 'JEBEL ALI',
      carrierId: uniLine.id, vesselId: vessel['DP WORLD JEDDAH'].id, voyageNumber: '011', emptyDepotId: depot.id,
      grossWeight: 18000, volume: 28, packUnit: 400, allowApproval: true, ...extra,
    });
    for (const [type, qty] of containers) await make('pre-booking-container', { preBookingId: b.id, containerTypeId: T[type], quantity: qty, soc: 'N', grossWeight: 9000 });
    await make('pre-booking-cargo', { preBookingId: b.id, description: extra.cargo || 'GENERAL CARGO', hsCode: '6302.10', packages: 400, grossWeight: 18000, volume: 28 });
    const { addCharge } = require('./actions');
    await addCharge(models, 'nvocc_pre_booking', b.id, 'revenue', { code: 'OFRT', description: 'OCEAN FREIGHT', quantity: containers.reduce((s, [, q]) => s + q, 0), rate: 450, currency: 'USD', partnerId: cust[code].id });
    for (const s of steps) await run('pre-booking', b.id, s);
    return A['pre-booking'].findByPk(b.id);
  };
  await booking('MLI-1', { cargo: 'HOME TEXTILES' }, [['40HC', 1]], []);
  await booking('AC-4', { cargo: 'RICE IN BAGS' }, [['20SD', 2]], ['generate-cro']);
  await booking('SFL-1', { cargo: 'SURGICAL INSTRUMENTS' }, [['20SD', 1]], ['generate-cro', 'send-for-approval']);
  const approved = await booking('SI-4', { cargo: 'LEATHER GARMENTS' }, [['40HC', 2]], ['generate-cro', 'send-for-approval', 'approve']);
  const converted = await booking('KTC-7', { cargo: 'COTTON YARN' }, [['20SD', 2], ['40HC', 1]], ['generate-cro', 'send-for-approval', 'approve', 'convert-to-export-job']);
  const cancelled = await booking('V-1', { cargo: 'SPORTS GOODS' }, [['20SD', 1]], []);
  await run('pre-booking', cancelled.id, 'change-status', { state: 'cancel' });
  void approved;

  // Export jobs: the converted booking plus two direct ones.
  const reg = (i) => boxes[i];
  const exportJob = async (code, regIdx, extra = {}) => {
    const job = await make('job', {
      shipmentType: 'export', shipmentDate: '2026-11-12', transportMode: 'sea', cargoType: 'FCL', jobTypeId: jobType.id,
      customerId: cust[code].id, principalId: unifeeder.id, userId: admin && admin.id, teamId: team && team.id,
      originLocation: 'KARACHI', originPortId: ports.PKKHI.id, destinationPortId: ports.SAJED.id, destinationLocation: 'JEDDAH',
      shippingLineId: uniLine.id, vesselId: vessel['DP WORLD JEDDAH'].id, voyageNumber: '011', sailingDate: '2026-11-20',
      etd: '2026-11-20T10:00:00Z', eta: '2026-11-27T06:00:00Z', containerOwnership: 'coc', paymentTerms: 'ppx',
      description: 'GENERAL CARGO', marksnNumber: 'N/M', ...extra,
    });
    for (const i of regIdx) {
      const r = reg(i);
      await make('container-line', { jobId: job.id, containerNumber: r.name, containerTypeId: r.containerTypeId, soc: 'N', sealNumber: `UN${700100 + i}`, packages: 200, grossWeight: 12000 + i * 100, volume: 30 });
    }
    return job;
  };
  const convertedJob = await A.job.findByPk(converted.exportJobId);
  const lines = await A['container-line'].findAll({ where: { jobId: convertedJob.id }, order: [['createdAt', 'ASC']] });
  for (const [i, l] of lines.entries()) {
    const r = boxes.find((b) => String(b.containerTypeId) === String(l.containerTypeId) && !b._used);
    if (!r) continue;
    r._used = true;
    await svc.update(models, 'container-line', l.id, { containerNumber: r.name, sealNumber: `UN${700500 + i}`, packages: 150, grossWeight: 11000 }, ctx);
  }
  await svc.update(models, 'job', convertedJob.id, { principalId: unifeeder.id, sailingDate: '2026-11-20', description: 'COTTON YARN', autoUpdateWeightVolume: true }, ctx);
  const e1 = await exportJob('SI-4', [1, 2], { description: 'LEATHER GARMENTS' });
  const e2 = await exportJob('AC-4', [0, 3, 6], { description: 'RICE IN BAGS' });
  for (const j of [convertedJob, e1, e2]) await run('job', j.id, 'assign-charges');
  await run('job', convertedJob.id, 'generate-bl');
  await run('job', e1.id, 'generate-bl');
  // Loaded on board.
  for (const j of [convertedJob, e1]) {
    const cl = await A['container-line'].findAll({ where: { jobId: j.id }, raw: true });
    for (const c of cl) {
      if (!c.containerRegistryId) continue;
      await make('container-activity', {
        containerId: c.containerRegistryId, activityTypeId: act.LODF, date: '2026-11-20', containerStatusId: empty.id, containerStatus: 'laden',
        locationTypeId: yard && yard.id, location: 'KICT', jobId: j.id, hblNumber: (await A.job.findByPk(j.id)).hblNumber,
        vesselId: vessel['DP WORLD JEDDAH'].id, voyageNumber: '011', principalId: unifeeder.id,
      });
    }
  }
  await run('job', convertedJob.id, 'generate-invoice');

  // Import jobs: consolidated under one MBL, manifested, indexed, D/O issued.
  const importJob = async (code, regIdx, bl) => {
    const job = await make('job', {
      shipmentType: 'import', shipmentDate: '2026-11-05', transportMode: 'sea', cargoType: 'FCL', jobTypeId: jobType.id,
      hblNumber: bl, customerId: cust[code].id, principalId: unifeeder.id, userId: admin && admin.id,
      originPortId: ports.AEJEA.id, destinationPortId: ports.PKKHI.id, shippingLineId: uniLine.id,
      vesselId: vessel['GSL ELIZABETH'].id, voyageNumber: '012W', sailingDate: '2026-11-08', eta: '2026-11-08T08:00:00Z',
      containerOwnership: 'coc', paymentTerms: 'ccx', freeDays: 7, description: 'GENERAL CARGO',
    });
    for (const i of regIdx) {
      const r = reg(i);
      await make('container-line', { jobId: job.id, containerNumber: r.name, containerTypeId: r.containerTypeId, soc: 'N', sealNumber: `EM${400100 + i}`, packages: 300, grossWeight: 15000 });
    }
    return job;
  };
  const i1 = await importJob('KTC-7', [8, 9], 'JEAKHI26150101');
  const i2 = await importJob('V-1', [10], 'JEAKHI26150102');
  const i3 = await importJob('MLI-1', [11, 12], 'JEAKHI26150103');
  const cons = await make('consolidation', {
    mblNumber: 'UNIJEA2611001', shipmentDate: '2026-11-05', shipmentType: 'import', transportMode: 'sea', cargoType: 'FCL',
    originPortId: ports.AEJEA.id, destinationPortId: ports.PKKHI.id, vesselId: vessel['GSL ELIZABETH'].id, voyageNumber: '012W', userId: admin && admin.id,
  });
  await run('consolidation', cons.id, 'attach-jobs', { jobIds: [i1.id, i2.id] });
  const kict = await A.terminal.findOne({ where: { terminalCode: 'KICT' } });
  const man = await make('manifest', {
    shipmentType: 'import', vesselId: vessel['GSL ELIZABETH'].id, voyageNumber: '012W', shippingLineId: uniLine.id, principalId: unifeeder.id,
    igmNo: '0046', igmDate: '2026-11-07', virNo: 'KPPI-0046-07112026', arrivalDate: '2026-11-08', lastPortCallId: ports.AEJEA.id,
    localPortId: ports.PKKHI.id, terminalId: kict && kict.id, startingIndex: 1, berth: 'B-7',
  });
  await run('manifest', man.id, 'attach-jobs', { jobIds: [i1.id, i2.id, i3.id] });
  await run('manifest', man.id, 'update-job-index');
  for (const j of [i1, i2, i3]) {
    await run('job', j.id, 'assign-charges');
    const cl = await A['container-line'].findAll({ where: { jobId: j.id }, raw: true });
    for (const c of cl) {
      await make('container-activity', {
        containerId: c.containerRegistryId, activityTypeId: act.DCHF, date: '2026-11-08', containerStatusId: empty.id, containerStatus: 'laden',
        locationTypeId: yard && yard.id, location: 'KICT', jobId: j.id, manifestId: man.id, hblNumber: (await A.job.findByPk(j.id)).hblNumber,
        vesselId: vessel['GSL ELIZABETH'].id, voyageNumber: '012W', principalId: unifeeder.id,
      });
    }
    await run('job', j.id, 'arrival-notice');
  }
  await run('job', i1.id, 'generate-invoice');
  await run('job', i1.id, 'payment-received');
  await run('job', i1.id, 'request-do');
  await run('job', i1.id, 'generate-do');
  await run('job', i2.id, 'request-do');

  // Security deposit against the D/O'd import.
  const dep = await make('security-deposit', { partnerId: cust['KTC-7'].id, jobId: i1.id, date: '2026-11-09', amount: 1000, currency: 'USD', paymentMethod: 'cheque', chequeNo: '004512' });
  await run('security-deposit', dep.id, 'receive');

  // A box comes back damaged: inspection -> repair -> recharge to the job.
  const team_ = await A['maintenance-team'].findOne();
  const insp = await A['maintenance-request-type'].findOne({ where: { name: 'Inspection' } });
  const mr = await make('maintenance-request', {
    name: 'Return inspection', containerId: boxes[8].id, requestDate: '2026-11-15', teamId: team_ && team_.id,
    userId: admin && admin.id, requestUserId: admin && admin.id, priority: '3', requestTypeId: insp.id, jobId: i1.id,
    description: 'Box returned by consignee with visible dents.',
  });
  await run('maintenance-request', mr.id, 'start');
  const checks = await A['maintenance-check-result'].findAll({ where: { requestId: mr.id }, order: [['createdAt', 'ASC']] });
  for (const c of checks.slice(0, 2)) await svc.update(models, 'maintenance-check-result', c.id, { result: 'damaged', remark: 'Dented / broken' }, ctx);
  await run('maintenance-request', mr.id, 'create-repair-request');
  const rr = await A['repair-request'].findOne({ where: { requestId: mr.id } });
  for (const s of ['send-for-approval', 'approve', 'start', 'mark-repaired', 'done']) await run('repair-request', rr.id, s);
  // A second inspection still open, so the screens show work in flight.
  const mr2 = await make('maintenance-request', {
    name: 'Pre-trip inspection', containerId: boxes[4].id, requestDate: '2026-11-18', teamId: team_ && team_.id,
    userId: admin && admin.id, priority: '2', requestTypeId: insp.id,
  });
  await run('maintenance-request', mr2.id, 'start');

  await make('transfer-config', {
    name: 'Monthly freight accrual to principal', journal: 'Miscellaneous', dateStart: '2026-01-01', dateStop: '2026-12-31',
    frequency: 'month', sourceAccount: '500001 Sales', destinationAccount: '201001 Accounts Payable', percent: 10,
  });
  console.log('  Liner Agency demo traffic seeded (6 bookings, 6 jobs, 1 consolidation, 1 manifest, repair cycle)');
};

const seedAgency = async () => {
  const models = require('../models');
  try {
    const refs = await seedMasters(models);
    await seedTraffic(models, refs);
  } catch (e) {
    console.error('=============================================');
    console.error('LINER AGENCY SEED ABORTED - later steps did NOT run');
    console.error(e && (e.stack || e.message));
    console.error('=============================================');
  }
};

module.exports = { ensureAgencyTables, seedAgency, fieldsOf, DataTypes };
