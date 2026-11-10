// Seed for the Sales & CRM / costing / vendor-rate wave.
//
// Everything here is linked to records that already exist - prospects are
// raised against real organizations, leads carry real ports, charge lines are
// derived from the quotes and jobs already in the database. Nothing is
// deleted or rewritten: the flat charge fields on `quotations` stay exactly as
// they were and become the header roll-up of the charge lines seeded under
// them, so old screens keep reading the same numbers.
//
// Every block is guarded by a count of the rows that block owns, so a restart
// never duplicates and a partially seeded database fills in the rest.

const { Op } = require('sequelize');
const { recalcLine, rollup } = require('../services/chargeRollup');
const { computeChargeable } = require('../services/chargeableWeight');

const LEAD_STAGES = [
  { name: 'New', sequence: 10 },
  { name: 'Contacted', sequence: 20 },
  { name: 'Qualified', sequence: 30, isCreateOpportunity: true },
  { name: 'Unqualified', sequence: 40, isLost: true, fold: true },
];

const OPPORTUNITY_STAGES = [
  { name: 'New', sequence: 10 },
  { name: 'Requirement Gathering', sequence: 20 },
  { name: 'Pricing', sequence: 30, allowQuoteCreation: true },
  { name: 'Quotation Sent', sequence: 40, allowQuoteCreation: true },
  { name: 'Negotiation', sequence: 50, allowQuoteCreation: true },
  { name: 'Won', sequence: 60, isWon: true },
  { name: 'Lost', sequence: 70, isLost: true, fold: true },
];

const SALES_TEAMS = [
  { name: 'Sea Freight - Gulf', code: 'SF-GULF', sequence: 10 },
  { name: 'Air Freight - Global', code: 'AF-GLB', sequence: 20 },
  { name: 'Road & Cross Border', code: 'RD-XB', sequence: 30 },
  { name: 'Projects & Heavy Lift', code: 'PRJ', sequence: 40 },
];

// New lookup lists this wave introduces. They go into the shared
// master_data_items table, the same as the other 35 Manage lists.
const MASTER_LISTS = {
  'lead-source': [
    { name: 'Database', code: 'DB', extra: 'yes' },
    { name: 'Social Media', code: 'SOCIAL', extra: 'yes' },
    { name: 'Customer Referral', code: 'REF', extra: 'yes' },
    { name: 'Trade Show', code: 'TRADE', extra: 'yes' },
    { name: 'Inbound Enquiry', code: 'INBOUND', extra: 'yes' },
    { name: 'Website', code: 'WEB', extra: 'yes' },
  ],
  'client-tag': [
    { name: 'Key Account', code: 'KEY' },
    { name: 'Strategic', code: 'STRAT' },
    { name: 'SME', code: 'SME' },
    { name: 'Government', code: 'GOVT' },
    { name: 'Freight Forwarder', code: 'FF' },
    { name: 'Project Cargo', code: 'PRJ' },
  ],
  'carrier-service-type': [
    { name: 'Port to Port', code: 'P2P' },
    { name: 'Door to Door', code: 'D2D' },
    { name: 'Door to Port', code: 'D2P' },
    { name: 'Port to Door', code: 'P2D' },
    { name: 'Express', code: 'EXP' },
    { name: 'Standard', code: 'STD' },
    { name: 'Deferred', code: 'DEF' },
  ],
  'contact-tag': [
    { name: 'Decision Maker', code: 'DM' },
    { name: 'Operations', code: 'OPS' },
    { name: 'Accounts Payable', code: 'AP' },
    { name: 'Logistics Coordinator', code: 'LOG' },
  ],
  'contact-title': [
    { name: 'Mr.', code: 'MR' },
    { name: 'Mrs.', code: 'MRS' },
    { name: 'Ms.', code: 'MS' },
    { name: 'Dr.', code: 'DR' },
    { name: 'Eng.', code: 'ENG' },
  ],
  industry: [
    { name: 'Oil & Gas', code: 'OANDG' },
    { name: 'Construction & Building Materials', code: 'CONST' },
    { name: 'Food & Beverage', code: 'FNB' },
    { name: 'Automotive & Spare Parts', code: 'AUTO' },
    { name: 'Pharmaceuticals & Healthcare', code: 'PHARMA' },
    { name: 'Electronics & Consumer Goods', code: 'ELEC' },
    { name: 'Textiles & Garments', code: 'TEX' },
    { name: 'Chemicals', code: 'CHEM' },
    { name: 'Events & Exhibitions', code: 'EVENT' },
    { name: 'Retail & E-commerce', code: 'RETAIL' },
  ],
  'measurement-basis': [
    { name: 'Chargeable Weight', code: 'CW' },
    { name: 'Gross Weight', code: 'GW' },
    { name: 'Net Weight', code: 'NW' },
    { name: 'Volume', code: 'CBM' },
    { name: 'W/M', code: 'WM' },
    { name: 'Container', code: 'CNTR' },
    { name: 'Per Truck', code: 'TRUCK' },
    { name: 'Per Package', code: 'PKG' },
    { name: 'Per Shipment', code: 'SHPT' },
    { name: 'Per BL', code: 'BL' },
    { name: 'TEU', code: 'TEU' },
  ],
  'volumetric-divided-value': [
    { name: 'Air - IATA 1:6000', code: '6000', extra: 'AIR' },
    { name: 'Courier / Express 1:5000', code: '5000', extra: 'COURIER' },
    { name: 'Road groupage 333 kg/m3', code: '333', extra: 'ROAD' },
  ],
};

// Charge catalogue used to build charge lines. `basis` drives the quantity,
// `mode` limits which legs a charge can appear on (null = any mode).
// `full` restricts a charge to full-load shipments (FCL, FTL) and `groupage`
// to consolidated ones (LCL, LTL, loose). Without this, an FCL shipment picked
// up an LCL Freight line billed on W/M alongside its per-container ocean
// freight - two freight charges for one movement, one of them nonsense.
const CHARGE_CATALOGUE = [
  { code: 'OFR', name: 'Ocean Freight', basis: 'Container', mode: 'SEA', load: 'full', buy: 1450, sell: 1750, side: 'main' },
  { code: 'LCL', name: 'LCL Freight', basis: 'W/M', mode: 'SEA', load: 'groupage', buy: 42, sell: 58, side: 'main' },
  { code: 'AFR', name: 'Air Freight', basis: 'Chargeable Weight', mode: 'AIR', buy: 4.2, sell: 5.6, side: 'main' },
  { code: 'RDF', name: 'Road Freight', basis: 'Per Truck', mode: 'ROAD', load: 'full', buy: 1850, sell: 2350, side: 'main' },
  { code: 'RDL', name: 'Road Groupage', basis: 'Chargeable Weight', mode: 'ROAD', load: 'groupage', buy: 0.95, sell: 1.4, side: 'main' },
  { code: 'CRF', name: 'Courier Charge', basis: 'Chargeable Weight', mode: 'COURIER', buy: 11, sell: 16.5, side: 'main' },
  { code: 'THC', name: 'Terminal Handling Charge', basis: 'Container', mode: 'SEA', load: 'full', buy: 420, sell: 520 },
  { code: 'DTHC', name: 'Destination Terminal Handling', basis: 'Container', mode: 'SEA', load: 'full', buy: 380, sell: 470 },
  { code: 'CFS', name: 'CFS Handling Charge', basis: 'W/M', mode: 'SEA', load: 'groupage', buy: 28, sell: 42 },
  { code: 'BL', name: 'Bill of Lading Fee', basis: 'Per BL', mode: 'SEA', buy: 150, sell: 220 },
  { code: 'AWB', name: 'AWB Fee', basis: 'Per Shipment', mode: 'AIR', buy: 90, sell: 150 },
  { code: 'SSC', name: 'Security Surcharge', basis: 'Chargeable Weight', mode: 'AIR', buy: 0.35, sell: 0.55 },
  { code: 'FSC', name: 'Fuel Surcharge', basis: 'Chargeable Weight', mode: 'AIR', buy: 0.85, sell: 1.15 },
  { code: 'CUS', name: 'Customs Clearance', basis: 'Per Shipment', mode: null, buy: 350, sell: 550 },
  { code: 'DOC', name: 'Documentation Charge', basis: 'Per Shipment', mode: null, buy: 120, sell: 200 },
  { code: 'HAN', name: 'Handling Charge', basis: 'Per Shipment', mode: null, buy: 180, sell: 290 },
  { code: 'TRN', name: 'Inland Transportation', basis: 'Per Truck', mode: null, buy: 650, sell: 900 },
  { code: 'DO', name: 'Delivery Order Fee', basis: 'Per Shipment', mode: null, buy: 100, sell: 175 },
  { code: 'INS', name: 'Cargo Insurance', basis: 'Per Shipment', mode: null, buy: 140, sell: 240 },
  { code: 'DGS', name: 'Dangerous Goods Surcharge', basis: 'Per Shipment', mode: null, buy: 450, sell: 700, special: 'dg' },
  { code: 'RFR', name: 'Reefer Monitoring', basis: 'Container', mode: null, buy: 300, sell: 450, special: 'reefer' },
  { code: 'OOG', name: 'Out of Gauge Surcharge', basis: 'Container', mode: null, buy: 900, sell: 1350, special: 'oog' },
];

const VAT_5 = [{ name: 'VAT 5%', percent: 5 }];

const pick = (arr, i) => (arr.length ? arr[i % arr.length] : null);
const daysFrom = (base, n) => {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
};
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const seq = (prefix, year, n, width = 5) =>
  `${prefix}/${year}/${String(n).padStart(width, '0')}`;

// Full-load shipment types bill per container or per truck; everything else
// is groupage and bills on weight or measurement.
const FULL_LOAD_TYPES = new Set(['FCL', 'FTL', 'RORO', 'BULK']);

const loadKind = (shipmentType) => (
  FULL_LOAD_TYPES.has(String(shipmentType || '').toUpperCase()) ? 'full' : 'groupage'
);

/** Charges that fit a given leg/shipment profile. */
const chargesFor = ({
  transportMode, shipmentType, hasCustoms, isDangerous, isReefer, isOutOfGauge,
}) => {
  const mode = String(transportMode || 'SEA').toUpperCase();
  const load = loadKind(shipmentType);
  return CHARGE_CATALOGUE.filter((c) => {
    if (c.special === 'dg') return !!isDangerous;
    if (c.special === 'reefer') return !!isReefer;
    if (c.special === 'oog') return !!isOutOfGauge;
    if (c.code === 'CUS') return hasCustoms !== false;
    // A full-load charge never belongs on a groupage shipment, nor the reverse.
    if (c.load && c.load !== load) return false;
    if (!c.mode) return true;
    return c.mode === mode;
  });
};

/**
 * Build charge-line payloads for one parent from the charge catalogue.
 * Buy and sell rates are jittered deterministically off the record index so
 * the seeded margins vary the way real ones do, without being random on
 * every restart.
 */
const buildChargeLines = ({
  parentType, parentId, side, cargo, profile, index = 0,
  creditorId, debtorId, companyId, legId, legSequence, currency = 'AED',
}) => {
  const charges = chargesFor(profile);
  const jitter = 1 + ((index % 7) - 3) / 100; // -3% .. +3%
  // A cost charge has no sell rate and a revenue charge has no buy rate -
  // only a quote line ('both') carries the pair. Writing both sides onto a
  // one-sided charge would leave every shipment looking like it had twice the
  // revenue it really has.
  const wantsCost = side === 'cost' || side === 'both';
  const wantsSell = side === 'revenue' || side === 'both';
  return charges.map((c, i) => {
    const base = {
      parentType,
      parentId,
      side,
      sequence: (i + 1) * 10,
      chargeCode: c.code,
      serviceName: c.name,
      chargeDescription: c.name,
      measurementBasis: c.basis,
      uom: c.basis === 'Chargeable Weight' ? 'kg' : 'unit',
      costCurrency: currency,
      costConversionRate: 1,
      costAmountRate: wantsCost ? Number((c.buy * jitter).toFixed(4)) : 0,
      sellCurrency: currency,
      sellConversionRate: 1,
      sellAmountRate: wantsSell ? Number((c.sell * jitter).toFixed(4)) : 0,
      creditorPartnerId: wantsCost ? (creditorId || null) : null,
      debtorPartnerId: wantsSell ? (debtorId || null) : null,
      taxes: wantsSell ? VAT_5 : null,
      supplierTaxes: wantsCost ? VAT_5 : null,
      transportMode: String(profile.transportMode || 'SEA').toUpperCase(),
      multimodalLineId: legId || null,
      modeTypeSequence: legSequence || null,
      companyId: companyId || null,
      currency,
      chargeSource: 'erp',
    };
    return recalcLine(base, cargo);
  });
};

const seedSalesData = async () => {
  const models = require('../models');
  const {
    CrmStage, SalesTeam, SalesTarget, Prospect, Lead, QuoteTemplate,
    QuoteLeg, ChargeLine, RateRequest, RateRequestLine, PdcPayment,
    MasterDataItem, Organization, User, Port, Carrier, Quotation, FFJob,
    Opportunity, ServiceJob, AccountJournal, Product, Schedule,
  } = models;

  try {
    const year = new Date().getFullYear();
    const today = new Date();

    // --- 1. lookup lists --------------------------------------------------
    for (const [category, rows] of Object.entries(MASTER_LISTS)) {
      const have = await MasterDataItem.count({ where: { category } });
      if (have > 0) continue;
      await MasterDataItem.bulkCreate(
        rows.map((r, i) => ({ ...r, category, sortOrder: (i + 1) * 10 })),
      );
    }

    // --- 2. CRM stages ----------------------------------------------------
    if ((await CrmStage.count({ where: { kind: 'lead' } })) === 0) {
      await CrmStage.bulkCreate(LEAD_STAGES.map((s) => ({ ...s, kind: 'lead' })));
    }
    if ((await CrmStage.count({ where: { kind: 'opportunity' } })) === 0) {
      await CrmStage.bulkCreate(OPPORTUNITY_STAGES.map((s) => ({ ...s, kind: 'opportunity' })));
    }
    const leadStages = await CrmStage.findAll({
      where: { kind: 'lead' }, order: [['sequence', 'ASC']],
    });
    const oppStages = await CrmStage.findAll({
      where: { kind: 'opportunity' }, order: [['sequence', 'ASC']],
    });

    const users = await User.findAll({ limit: 12, order: [['createdAt', 'ASC']] });
    const companyId = users[0] ? users[0].companyId : null;

    // --- 3. sales teams ---------------------------------------------------
    if ((await SalesTeam.count()) === 0) {
      await SalesTeam.bulkCreate(SALES_TEAMS.map((t, i) => ({
        ...t,
        leaderId: pick(users, i) ? pick(users, i).id : null,
        memberIds: users.slice(i, i + 3).map((u) => u.id),
        companyId,
      })));
    }
    const teams = await SalesTeam.findAll({ order: [['sequence', 'ASC']] });

    // --- 4. sales targets -------------------------------------------------
    if ((await SalesTarget.count()) === 0 && users.length) {
      const params = [
        { targetParameter: 'gross_revenue', targetValue: 2500000 },
        { targetParameter: 'gross_margin', targetValue: 600000 },
        { targetParameter: 'teu', targetValue: 450 },
        { targetParameter: 'weight', targetValue: 185000 },
        { targetParameter: 'quotation', targetValue: 120 },
        { targetParameter: 'volume', targetValue: 3200 },
      ];
      const rows = [];
      params.forEach((p, i) => {
        const owner = pick(users, i);
        const team = pick(teams, i);
        rows.push({
          name: `${p.targetParameter.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} target ${year} - ${owner.name || owner.email}`,
          userId: owner.id,
          managerId: team && team.leaderId ? team.leaderId : null,
          salesTeamId: team ? team.id : null,
          dateFrom: `${year}-01-01`,
          dateTo: `${year}-12-31`,
          transportMode: pick(['SEA', 'AIR', 'ROAD', null, 'SEA', 'AIR'], i),
          targetParameter: p.targetParameter,
          targetValue: p.targetValue,
          targetCurrency: 'AED',
          incentiveType: 'percentage',
          incentiveUnit: 1.5,
          incentiveUnitType: 'gross',
          remarks: 'Annual target. Achievement is recomputed from live shipments, quotes and charge lines.',
          companyId,
        });
      });
      await SalesTarget.bulkCreate(rows);
    }

    // --- 5. quote templates -----------------------------------------------
    if ((await QuoteTemplate.count()) === 0) {
      await QuoteTemplate.bulkCreate([
        {
          name: 'Sea Export - FCL Standard Terms',
          templateFor: 'shipment', transportMode: 'SEA', shipmentType: 'FCL',
          isDefault: true, sequence: 10, companyId,
          bodyHtml: '<p><strong>Terms &amp; Conditions</strong></p><ul>'
            + '<li>Rates are valid for the period stated above and are subject to space and equipment availability.</li>'
            + '<li>Rates exclude any duties, taxes, demurrage, detention or storage unless expressly listed.</li>'
            + '<li>Free time at destination is as stated; thereafter carrier detention and demurrage tariffs apply.</li>'
            + '<li>Subject to General Rate Increase, Peak Season Surcharge and currency adjustment as announced by the carrier.</li>'
            + '<li>All business is transacted under our Standard Trading Conditions.</li></ul>',
        },
        {
          name: 'Air Export - Standard Terms',
          templateFor: 'shipment', transportMode: 'AIR',
          isDefault: true, sequence: 20, companyId,
          bodyHtml: '<p><strong>Terms &amp; Conditions</strong></p><ul>'
            + '<li>Chargeable weight is the greater of actual gross weight and volumetric weight at 1:6000 (IATA).</li>'
            + '<li>Rates exclude customs duty, VAT, storage and any charges levied by the airline after acceptance.</li>'
            + '<li>Fuel and security surcharges are as ruling on the date of uplift.</li>'
            + '<li>Space is subject to confirmation at the time of booking.</li></ul>',
        },
        {
          name: 'Road - Cross Border Terms',
          templateFor: 'shipment', transportMode: 'ROAD',
          isDefault: true, sequence: 30, companyId,
          bodyHtml: '<p><strong>Terms &amp; Conditions</strong></p><ul>'
            + '<li>Rates include one free loading and one free unloading; waiting time beyond 4 hours is chargeable.</li>'
            + '<li>Border crossing fees, escort charges and customs transit guarantees are at actual.</li>'
            + '<li>Rates assume a clear road permit; detours and road closures are chargeable at actual.</li></ul>',
        },
        {
          name: 'Multimodal - Door to Door Terms',
          templateFor: 'shipment', transportMode: null,
          sequence: 40, companyId,
          bodyHtml: '<p><strong>Terms &amp; Conditions</strong></p><ul>'
            + '<li>Each leg is priced separately and the transit time quoted is the sum of the legs plus handover time at each interchange.</li>'
            + '<li>A delay on one leg does not void the rates for the remaining legs.</li>'
            + '<li>Transshipment and change of carrier mid-route are at our option unless otherwise agreed.</li></ul>',
        },
        {
          name: 'Service Job - Customs Clearance Terms',
          templateFor: 'job', sequence: 50, companyId,
          bodyHtml: '<p><strong>Terms &amp; Conditions</strong></p><ul>'
            + '<li>Duty and VAT are payable by the client and are not included in the clearance fee.</li>'
            + '<li>Clearance is subject to complete and accurate documentation being supplied before vessel or flight arrival.</li>'
            + '<li>Inspection, scanning and testing charges levied by the authority are at actual.</li></ul>',
        },
      ]);
    }

    // --- 6. prospects, raised against real organizations -------------------
    if ((await Prospect.count()) === 0) {
      const orgs = await Organization.findAll({
        where: { parentId: null, isActive: true },
        limit: 18,
        order: [['createdAt', 'ASC']],
      });
      const industries = MASTER_LISTS.industry.map((i) => i.name);
      const tags = MASTER_LISTS['client-tag'].map((t) => t.name);

      // Converted prospects: linked back to the organization they became.
      const converted = orgs.slice(0, 10).map((o, i) => ({
        prospectNumber: seq('PROS', year, i + 1, 4),
        name: o.companyName || o.name,
        street1: o.streetName || 'Jebel Ali Free Zone',
        street2: o.street2 || null,
        city: o.city || 'Dubai',
        state: o.state || null,
        country: o.country || 'United Arab Emirates',
        zip: o.zip || null,
        contactName: o.contactPerson || 'Logistics Manager',
        designation: 'Logistics Manager',
        department: 'Supply Chain',
        email: o.email || null,
        phone: o.phone || null,
        mobile: o.mobile || null,
        website: o.website || null,
        partyTypes: o.partyTypes || ['Customer'],
        industry: pick(industries, i),
        natureOfBusiness: `${pick(industries, i)} - import and export`,
        companyTurnover: 4000000 + i * 1750000,
        turnoverCurrency: 'AED',
        clientTag: pick(tags, i),
        relatedPartnerId: o.id,
        convertedAt: daysFrom(today, -200 + i * 9),
        assignedTo: pick(users, i) ? pick(users, i).id : null,
        salesTeamId: pick(teams, i) ? pick(teams, i).id : null,
        companyId,
        remarks: 'Converted to a customer account. Retained for pipeline history.',
      }));

      // Still-open prospects with no organization yet - these are what the
      // sales team is actually working on.
      const openNames = [
        ['Gulf Marine Supplies LLC', 'Abu Dhabi', 'Oil & Gas'],
        ['Northern Steel Trading FZE', 'Sharjah', 'Construction & Building Materials'],
        ['Emirates Cold Chain Logistics', 'Dubai', 'Food & Beverage'],
        ['Arabian Auto Spares Co', 'Dubai', 'Automotive & Spare Parts'],
        ['MedSupply Middle East DMCC', 'Dubai', 'Pharmaceuticals & Healthcare'],
        ['Levant Textile Mills', 'Ajman', 'Textiles & Garments'],
        ['Desert Rose Exhibitions LLC', 'Dubai', 'Events & Exhibitions'],
        ['Oasis Petrochem Trading', 'Ruwais', 'Chemicals'],
      ];
      const open = openNames.map(([name, city, industry], i) => ({
        prospectNumber: seq('PROS', year, 11 + i, 4),
        name,
        street1: `${city} Industrial Area`,
        city,
        country: 'United Arab Emirates',
        contactName: pick(['Imran Qureshi', 'Fatima Al Marri', 'Rahul Menon', 'Sara Haddad',
          'Yusuf Demir', 'Anita Rao', 'Khalid Al Zaabi', 'Grace Owusu'], i),
        designation: pick(['Procurement Head', 'Logistics Manager', 'Supply Chain Director',
          'Operations Manager'], i),
        department: 'Supply Chain',
        email: `${name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '')}@example.ae`,
        phone: `+9714${String(2200000 + i * 3137).slice(0, 7)}`,
        partyTypes: ['Customer'],
        industry,
        natureOfBusiness: `${industry} - regional distribution`,
        companyTurnover: 1800000 + i * 950000,
        turnoverCurrency: 'AED',
        clientTag: pick(tags, i + 2),
        assignedTo: pick(users, i) ? pick(users, i).id : null,
        salesTeamId: pick(teams, i) ? pick(teams, i).id : null,
        companyId,
        remarks: 'Active prospect. No account opened yet.',
      }));

      await Prospect.bulkCreate([...converted, ...open]);
    }
    const prospects = await Prospect.findAll({ order: [['prospectNumber', 'ASC']] });

    // --- 7. leads ----------------------------------------------------------
    if ((await Lead.count()) === 0 && prospects.length) {
      const ports = await Port.findAll({ limit: 24, order: [['code', 'ASC']] });
      const sources = await MasterDataItem.findAll({ where: { category: 'lead-source' } });
      const lanes = [
        ['SEA', 'FCL', 'EXPORT', 'United Arab Emirates', 'India'],
        ['SEA', 'LCL', 'IMPORT', 'China', 'United Arab Emirates'],
        ['AIR', 'Air Freight', 'EXPORT', 'United Arab Emirates', 'United Kingdom'],
        ['AIR', 'Air Freight', 'IMPORT', 'Germany', 'United Arab Emirates'],
        ['ROAD', 'FTL', 'EXPORT', 'United Arab Emirates', 'Saudi Arabia'],
        ['ROAD', 'LTL', 'EXPORT', 'United Arab Emirates', 'Oman'],
        ['SEA', 'FCL', 'IMPORT', 'Brazil', 'United Arab Emirates'],
        ['MULTIMODAL', 'FCL', 'EXPORT', 'United Arab Emirates', 'Uzbekistan'],
      ];
      const commodities = ['Valves and fittings', 'Steel coils', 'Chilled produce',
        'Automotive spares', 'Pharmaceuticals', 'Cotton fabric', 'Exhibition stands',
        'Industrial chemicals'];

      const rows = [];
      prospects.forEach((p, i) => {
        // 1-2 leads per prospect, so the funnel is not a flat one-to-one.
        const count = i % 3 === 0 ? 2 : 1;
        for (let k = 0; k < count; k += 1) {
          const n = rows.length;
          const [mode, shipmentType, direction, originCountry, destinationCountry] = lanes[n % lanes.length];
          // Converted prospects get qualified leads; open prospects spread
          // across the earlier stages.
          const stage = p.relatedPartnerId
            ? leadStages.find((s) => s.isCreateOpportunity) || leadStages[2]
            : pick(leadStages.filter((s) => !s.isLost), n);
          rows.push({
            leadNumber: seq('LEAD', year, n + 1, 5),
            name: `${commodities[n % commodities.length]} - ${originCountry} to ${destinationCountry}`,
            date: iso(daysFrom(today, -150 + n * 4)),
            prospectId: p.id,
            stageId: stage.id,
            contactName: p.contactName,
            designation: p.designation,
            department: p.department,
            email: p.email,
            phone: p.phone,
            mobile: p.mobile,
            street: p.street1,
            city: p.city,
            country: p.country,
            leadSource: pick(['db', 'social', 'customer_ref', 'trade_show', 'inbound'], n),
            leadSourceId: pick(sources, n) ? pick(sources, n).id : null,
            leadCategory: pick(['hot', 'warm', 'warm', 'cold'], n),
            transportMode: mode,
            shipmentType,
            direction,
            originCountry,
            destinationCountry,
            portOfLoadingId: pick(ports, n) ? pick(ports, n).id : null,
            portOfDischargeId: pick(ports, n + 5) ? pick(ports, n + 5).id : null,
            commodity: commodities[n % commodities.length],
            businessService: p.industry,
            expectedAnnualRevenue: 180000 + n * 46000,
            annualRevenueCurrency: 'AED',
            expectedAnnualVolume: mode === 'AIR' ? 24000 + n * 1800 : 120 + n * 14,
            volumeUom: mode === 'AIR' ? 'kg' : 'TEU',
            targetDate: iso(daysFrom(today, 30 + n * 7)),
            natureOfBusiness: p.natureOfBusiness,
            companyTurnover: p.companyTurnover,
            turnoverCurrency: 'AED',
            assignedTo: p.assignedTo,
            salesTeamId: p.salesTeamId,
            createdBy: p.assignedTo,
            companyId,
            status: stage.isCreateOpportunity ? 'converted' : 'open',
            remarks: `Enquiry for regular ${mode.toLowerCase()} ${direction.toLowerCase()} movements.`,
            notes: `Expecting ${mode === 'AIR' ? 'weekly consignments' : 'monthly sailings'}. `
              + 'Needs an all-in door rate and a transit-time commitment.',
          });
        }
      });
      await Lead.bulkCreate(rows);
    }

    // --- 8. link leads to the opportunities that already exist -------------
    // The opportunities were seeded earlier without a source lead. Pointing
    // them at a converted lead closes the funnel so the CRM reports read a
    // complete chain rather than orphaned records.
    const unlinkedOpps = await Opportunity.findAll({
      where: { leadId: null },
      order: [['createdAt', 'ASC']],
      limit: 40,
    });
    if (unlinkedOpps.length) {
      const convertedLeads = await Lead.findAll({
        where: { status: 'converted', opportunityId: null },
        order: [['leadNumber', 'ASC']],
      });
      for (let i = 0; i < unlinkedOpps.length; i += 1) {
        const opp = unlinkedOpps[i];
        const lead = convertedLeads[i];
        const stage = pick(oppStages.filter((s) => !s.isLost), i);
        const patch = {
          stageId: stage ? stage.id : null,
          salesTeamId: pick(teams, i) ? pick(teams, i).id : null,
          opportunityType: i % 3 === 0 ? 'new' : 'existing',
          opportunityFor: 'shipment',
          opportunitySource: i % 2 ? 'offline' : 'online',
          customerType: pick(['consignor', 'consignee', 'agent'], i),
          companyId: opp.companyId || companyId,
        };
        if (lead) {
          Object.assign(patch, {
            leadId: lead.id,
            prospectId: lead.prospectId,
            isCreateFromLead: true,
            transportMode: lead.transportMode === 'MULTIMODAL' ? opp.transportMode : lead.transportMode,
            shipmentType: lead.shipmentType,
            commodity: lead.commodity,
            originCountry: lead.originCountry,
            destinationCountry: lead.destinationCountry,
            portOfLoadingId: lead.portOfLoadingId,
            portOfDischargeId: lead.portOfDischargeId,
          });
          await lead.update({ opportunityId: opp.id, convertedAt: daysFrom(today, -120 + i * 3) });
        }
        await opp.update(patch);
      }
    }

    // --- 8a. customer visits on opportunities -----------------------------
    // The Customer Visit report reads these. Guarded on "nobody has any", so
    // a visit a user records by hand is never overwritten.
    const allOpps = await Opportunity.findAll({ order: [['createdAt', 'ASC']] });
    const anyVisits = allOpps.some((o) => Array.isArray(o.customerVisits) && o.customerVisits.length);
    if (!anyVisits && allOpps.length) {
      const purposes = [
        'Introductory meeting and capability presentation',
        'Rate discussion for the annual tender',
        'Site visit to review loading and packing',
        'Service review after the first shipments',
        'Negotiation on free time and payment terms',
      ];
      const outcomes = [
        'Interested; asked for a door-to-door rate',
        'Shared volumes; rate request raised to vendors',
        'Agreed to a trial shipment next month',
        'Price-sensitive; competitor quoting 6% lower',
        'Positive; awaiting their procurement approval',
      ];
      const next = [
        'Send quotation by Thursday',
        'Follow up after vendor rates arrive',
        'Book the trial shipment',
        'Re-quote with an alternative routing',
        'Call procurement next week',
      ];
      for (let i = 0; i < allOpps.length; i += 1) {
        const o = allOpps[i];
        const count = 1 + (i % 3);
        const visits = [];
        for (let k = 0; k < count; k += 1) {
          const n = i + k;
          visits.push({
            date: iso(daysFrom(today, -90 + n * 6)),
            visitedBy: pick(users, n) ? (pick(users, n).name || pick(users, n).email) : 'Sales',
            purpose: pick(purposes, n),
            outcome: pick(outcomes, n),
            nextAction: pick(next, n),
          });
        }
        await o.update({ customerVisits: visits });
      }
    }

    // --- 8b. cargo figures on quotes and shipments that have none ----------
    // A per-kg or per-CBM charge against a null weight bills zero, which made
    // an air export job look like it earned a few hundred dirhams. Filling
    // the cargo figures before pricing is what makes every downstream
    // chargeable-weight, profitability and volume report read true. Only
    // null/zero fields are touched, so real captured figures are untouched.
    await backfillJobCargo(models);

    // --- 9. charge lines on existing quotations ---------------------------
    // The flat charge fields on the quote stay untouched; the charge lines
    // seeded here are what the costing and profitability reports read.
    if ((await ChargeLine.count({ where: { parentType: 'quote' } })) === 0) {
      const quotes = await Quotation.findAll({ order: [['createdAt', 'ASC']], limit: 120 });
      const vendors = await Organization.findAll({
        where: { partyTypes: { [Op.ne]: null } }, limit: 20, order: [['createdAt', 'ASC']],
      });
      const bulk = [];
      for (let i = 0; i < quotes.length; i += 1) {
        const q = quotes[i];
        const mode = String(q.transportMode || q.mode || 'SEA').toUpperCase();
        const normalised = mode === 'LAND' ? 'ROAD' : mode;
        const figures = computeChargeable({
          transportMode: normalised,
          shipmentType: q.shipmentType,
          grossWeight: q.cargoWeight,
          volume: q.cargoVolume,
          containerCount: q.containerCount,
        });
        const profile = {
          transportMode: normalised,
          shipmentType: q.shipmentType || q.cargoType,
          hasCustoms: true,
          isDangerous: q.isDangerous,
          isReefer: q.isTemperatureControlled,
          isOutOfGauge: q.isOutOfGauge,
        };
        const lines = buildChargeLines({
          parentType: 'quote',
          parentId: q.id,
          side: 'both',
          cargo: {
            transportMode: normalised,
            shipmentType: q.shipmentType,
            grossWeight: q.cargoWeight,
            volume: q.cargoVolume,
            containerCount: q.containerCount,
            truckCount: q.truckCount || 1,
            packUnit: q.packUnit,
          },
          profile,
          index: i,
          creditorId: pick(vendors, i) ? pick(vendors, i).id : null,
          debtorId: q.customerId,
          companyId: q.companyId || companyId,
          currency: q.currency || 'AED',
        });
        bulk.push(...lines);

        const roll = rollup(lines);
        await q.update({
          chargeableWeight: figures.chargeableWeight,
          chargeableVolume: figures.chargeableVolume,
          weightVolume: figures.weightVolume,
          chargeableBasis: figures.basis,
          volumetricDivisor: figures.divisorUsed,
          estimatedRevenue: roll.estimatedRevenue,
          estimatedCost: roll.estimatedCost,
          estimatedMargin: roll.estimatedMargin,
          estimatedMarginPercentage: roll.estimatedMarginPercentage,
          allInclusiveSellRate: roll.estimatedRevenue,
          companyId: q.companyId || companyId,
        });
      }
      if (bulk.length) await ChargeLine.bulkCreate(bulk);
    }

    // --- 10. charge lines on existing house shipments ---------------------
    // A shipment gets paired cost and revenue charges, which is what makes the
    // job cost sheet and the per-job P&L add up.
    if ((await ChargeLine.count({ where: { parentType: 'house_shipment' } })) === 0) {
      const jobs = await FFJob.findAll({ order: [['createdAt', 'ASC']], limit: 120 });
      const vendors = await Organization.findAll({ limit: 20, order: [['createdAt', 'ASC']] });
      for (let i = 0; i < jobs.length; i += 1) {
        const j = jobs[i];
        const mode = String(j.transportMode || 'SEA').toUpperCase();
        const normalised = mode === 'LAND' ? 'ROAD' : mode;
        const cargo = {
          transportMode: normalised,
          shipmentType: j.cargoType,
          grossWeight: j.grossWeight,
          volume: j.volume,
          containerCount: Array.isArray(j.containerNumbers) ? j.containerNumbers.length : 1,
          truckCount: 1,
          packUnit: j.packCount || j.packages,
        };
        const figures = computeChargeable(cargo);
        const profile = {
          transportMode: normalised,
          shipmentType: j.cargoType,
          hasCustoms: true,
          isDangerous: false,
          isReefer: /reefer|RF/i.test(j.cargoType || ''),
          isOutOfGauge: /OOG|flat rack|open top/i.test(j.cargoType || ''),
        };
        const costs = buildChargeLines({
          parentType: 'house_shipment', parentId: j.id, side: 'cost',
          cargo, profile, index: i,
          creditorId: pick(vendors, i) ? pick(vendors, i).id : null,
          companyId: j.companyId || companyId,
        });
        const revenues = buildChargeLines({
          parentType: 'house_shipment', parentId: j.id, side: 'revenue',
          cargo, profile, index: i,
          debtorId: j.customerId,
          companyId: j.companyId || companyId,
        });

        // Billing progress varies so the Aged / Outstanding reports have
        // something real to show: a third fully settled, a third partial,
        // a third untouched.
        const bucket = i % 3;
        revenues.forEach((l) => {
          if (bucket === 0) l.invoicedAmount = l.totalSellAmountIncl;
          else if (bucket === 1) l.invoicedAmount = Number((l.totalSellAmountIncl * 0.4).toFixed(2));
          recalcLine(l);
        });
        costs.forEach((l) => {
          if (bucket === 0) l.billedAmount = l.totalCostAmountIncl;
          else if (bucket === 1) l.billedAmount = Number((l.totalCostAmountIncl * 0.5).toFixed(2));
          recalcLine(l);
        });

        const created = await ChargeLine.bulkCreate([...costs, ...revenues], { returning: true });
        // Pair each cost with its matching revenue so the job cost sheet can
        // show them side by side.
        const byCode = {};
        created.forEach((l) => {
          byCode[l.chargeCode] = byCode[l.chargeCode] || {};
          byCode[l.chargeCode][l.side] = l;
        });
        for (const pair of Object.values(byCode)) {
          if (pair.cost && pair.revenue) {
            await pair.cost.update({ pairLineId: pair.revenue.id });
            await pair.revenue.update({ pairLineId: pair.cost.id });
          }
        }

        const roll = rollup(created);
        await j.update({
          chargeableWeight: figures.chargeableWeight,
          chargeableBasis: figures.basis,
          weightVolume: figures.weightVolume,
          volumetricDivisor: figures.divisorUsed,
          estimatedRevenue: roll.estimatedRevenue,
          estimatedCost: roll.estimatedCost,
          estimatedMargin: roll.estimatedMargin,
          estimatedMarginPercentage: roll.estimatedMarginPercentage,
          receivedRevenue: roll.receivedRevenue,
          paidCost: roll.paidCost,
          receivedMargin: roll.receivedMargin,
          dueRevenue: roll.dueRevenue,
          dueCost: roll.dueCost,
          revenueChargeStatus: roll.revenueStatus,
          costChargeStatus: roll.costStatus,
        });
      }
    }

    // --- 11. charge lines on service jobs ---------------------------------
    if ((await ChargeLine.count({ where: { parentType: 'service_job' } })) === 0) {
      const sjobs = await ServiceJob.findAll({ order: [['createdAt', 'ASC']], limit: 60 });
      const vendors = await Organization.findAll({ limit: 20, order: [['createdAt', 'ASC']] });
      for (let i = 0; i < sjobs.length; i += 1) {
        const s = sjobs[i];
        const cargo = { transportMode: 'SEA', shipmentType: 'LCL', grossWeight: s.grossWeight || 0, volume: s.volume || 0 };
        const profile = { transportMode: 'SEA', shipmentType: 'LCL', hasCustoms: true };
        const costs = buildChargeLines({
          parentType: 'service_job', parentId: s.id, side: 'cost', cargo, profile, index: i,
          creditorId: pick(vendors, i) ? pick(vendors, i).id : null, companyId: s.companyId || companyId,
        });
        const revenues = buildChargeLines({
          parentType: 'service_job', parentId: s.id, side: 'revenue', cargo, profile, index: i,
          debtorId: s.customerId, companyId: s.companyId || companyId,
        });
        const created = await ChargeLine.bulkCreate([...costs, ...revenues]);
        const roll = rollup([...costs, ...revenues]);
        await s.update({
          estimatedRevenue: roll.estimatedRevenue,
          estimatedCost: roll.estimatedCost,
          estimatedMargin: roll.estimatedMargin,
          estimatedMarginPercentage: roll.estimatedMarginPercentage,
          revenueChargeStatus: roll.revenueStatus,
          costChargeStatus: roll.costStatus,
          hasCustoms: true,
          serviceJobType: pick(['Customs Clearance', 'Transportation', 'Warehousing', 'Documentation'], i),
        });
        void created;
      }
    }

    // --- 12. multimodal quotes --------------------------------------------
    // Door-to-door movements under one quote number. These are what the
    // multimodal test scenarios exercise.
    if ((await QuoteLeg.count()) === 0) {
      await seedMultimodalQuotes(models, { companyId, users, teams, today, year });
    }

    // --- 13. vendor rate requests -----------------------------------------
    if ((await RateRequest.count()) === 0) {
      const quotes = await Quotation.findAll({ order: [['createdAt', 'ASC']], limit: 14 });
      const vendors = await Organization.findAll({ limit: 12, order: [['createdAt', 'ASC']] });
      const crypto = require('crypto');
      let n = 0;
      for (let i = 0; i < quotes.length; i += 1) {
        const q = quotes[i];
        const quoteLines = await ChargeLine.findAll({
          where: { parentType: 'quote', parentId: q.id },
          order: [['sequence', 'ASC']],
        });
        if (!quoteLines.length) continue;

        // Two vendors per quote so the comparison screen has something to
        // compare, and the states spread across the lifecycle.
        for (let v = 0; v < 2; v += 1) {
          n += 1;
          const vendor = pick(vendors, i * 2 + v);
          const phase = n % 4; // 0 pending, 1 submitted, 2 renegotiating, 3 selected
          const rr = await RateRequest.create({
            requestNumber: seq('RR', year, n, 5),
            quoteOptionName: `Option ${v + 1} - ${vendor ? (vendor.companyName || vendor.name) : 'Vendor'}`,
            agentId: vendor ? vendor.id : null,
            email: vendor ? vendor.email : null,
            rateRequestTo: 'vendor',
            quotationId: q.id,
            opportunityId: q.opportunityId || null,
            requestDate: iso(daysFrom(today, -40 + n)),
            validityDate: iso(daysFrom(today, 20 + n)),
            requestedBy: pick(users, i) ? pick(users, i).id : null,
            status: phase === 0 ? 'sent' : (phase === 2 ? 'renegotiate' : 'done'),
            vendorRateStatus: ['pending', 'submitted', 'renegotiate_submitted', 'submitted'][phase],
            isRenegotiate: phase === 2,
            renegotiateStatus: phase === 2 ? 'pending' : null,
            renegotiateNote: phase === 2
              ? 'Ocean freight is 8% above the market for this lane. Please revise or we will award elsewhere.'
              : null,
            isRateSelected: phase === 3,
            selectedAt: phase === 3 ? daysFrom(today, -5) : null,
            submittedOn: phase === 0 ? null : daysFrom(today, -30 + n),
            currency: q.currency || 'AED',
            transitDays: 12 + (n % 9),
            accessToken: crypto.randomBytes(24).toString('hex'),
            tokenExpiresAt: daysFrom(today, 45),
            emailSentAt: daysFrom(today, -39 + n),
            companyId: q.companyId || companyId,
            createdBy: pick(users, i) ? pick(users, i).id : null,
            remarks: 'Buy rates requested for the charges listed. Validity and transit time to be confirmed.',
          });

          const lineRows = quoteLines.slice(0, 6).map((ql, k) => {
            const submitted = phase !== 0;
            // Vendor 2 is cheaper, so the comparison has a winner.
            const factor = (v === 0 ? 1 : 0.94) * (1 + ((k % 5) - 2) / 100);
            const buyRate = submitted ? Number((Number(ql.costAmountRate) * factor).toFixed(4)) : 0;
            const quantity = Number(ql.quantity) || 1;
            const minAmount = k === 0 ? Number((buyRate * 0.8).toFixed(2)) : 0;
            const lineTotal = submitted
              ? Number(Math.max(buyRate * quantity, minAmount).toFixed(2))
              : 0;
            return {
              rateRequestId: rr.id,
              sequence: (k + 1) * 10,
              chargeCode: ql.chargeCode,
              chargeDescription: ql.chargeDescription,
              measurementBasis: ql.measurementBasis,
              uom: ql.uom,
              quantity,
              currency: rr.currency,
              buyRate,
              minAmount,
              targetCurrency: rr.currency,
              exchangeRate: 1,
              convertedBuyRate: buyRate,
              lineTotal,
              transitDays: rr.transitDays,
              validFrom: rr.requestDate,
              validTo: rr.validityDate,
              counterRate: phase === 2 && k === 0 ? Number((buyRate * 0.92).toFixed(4)) : null,
              isCounterLine: phase === 2 && k === 0,
              rateReceivedBy: 'portal',
              source: submitted ? 'portal' : 'manual',
              checkStatus: submitted ? (factor > 1.01 ? 'high' : 'ok') : null,
              rateAgentId: rr.agentId,
              rateVendorGroupName: rr.quoteOptionName,
              rateSubmittedOn: rr.submittedOn,
              sourceQuoteLineId: ql.id,
              remarks: submitted ? 'Rate valid subject to space and equipment.' : null,
            };
          });
          await RateRequestLine.bulkCreate(lineRows);

          const total = lineRows.reduce((s, l) => s + Number(l.lineTotal), 0);
          await rr.update({ rateTotal: Number(total.toFixed(2)) });

          if (phase === 3) {
            await q.update({
              quoteRateRequestState: 'vendor_rate_submitted',
              currentRateRequestId: rr.id,
            });
          } else if (phase === 1) {
            await q.update({ quoteRateRequestState: 'vendor_rate_submitted' });
          } else if (phase === 2) {
            await q.update({ quoteRateRequestState: 'vendor_rate_renegotiate_requested' });
          } else {
            await q.update({ quoteRateRequestState: 'vendor_rate_requested' });
          }
        }
      }
    }

    // --- 14. post-dated cheques -------------------------------------------
    if ((await PdcPayment.count()) === 0) {
      const journals = await AccountJournal.findAll({
        where: { type: { [Op.in]: ['bank', 'cash'] } }, limit: 4,
      });
      const journal = journals[0] || (await AccountJournal.findOne());
      if (journal) {
        const partners = await Organization.findAll({ limit: 10, order: [['createdAt', 'ASC']] });
        const rows = [];
        const states = ['registered', 'registered', 'deposited', 'done', 'done', 'bounced', 'returned', 'deposited'];
        for (let i = 0; i < 14; i += 1) {
          const state = states[i % states.length];
          const partner = pick(partners, i);
          const received = daysFrom(today, -70 + i * 4);
          const chequeDate = daysFrom(received, 30 + (i % 4) * 15);
          rows.push({
            name: seq('PDC', year, i + 1, 5),
            chequeRef: `${100000 + i * 1371}`,
            paymentType: i % 5 === 4 ? 'outbound' : 'inbound',
            partnerId: partner ? partner.id : null,
            journalId: journal.id,
            bankName: pick(['Emirates NBD', 'Mashreq Bank', 'ADCB', 'First Abu Dhabi Bank', 'RAKBANK'], i),
            date: iso(received),
            paymentDate: iso(chequeDate),
            clearingDate: state === 'done' ? iso(daysFrom(chequeDate, 2)) : null,
            amount: 12500 + i * 4375,
            currency: 'AED',
            companyCurrency: 'AED',
            conversionRate: 1,
            state,
            isReconciled: state === 'done',
            bounceCharge: state === 'bounced' ? 150 : 0,
            bounceReason: state === 'bounced' ? 'Insufficient funds' : null,
            memo: state === 'returned'
              ? 'Cheque returned to the customer at their request; replacement awaited.'
              : `Post-dated cheque against open invoices for ${partner ? (partner.companyName || partner.name) : 'customer'}.`,
            companyId,
          });
        }
        await PdcPayment.bulkCreate(rows);
      }
    }

    console.log('Sales & CRM / costing seed complete.');
  } catch (error) {
    // Sequelize wraps driver errors and sometimes leaves `message` empty, so
    // the SQL-level detail is pulled out explicitly - without it an aborted
    // seed is impossible to diagnose.
    const sql = error.original || error.parent || {};
    console.error('\n=============================================');
    console.error('SALES SEED ABORTED - later steps did NOT run');
    if (sql.sqlMessage) console.error(`SQL: ${sql.code || ''} ${sql.sqlMessage}`);
    if (sql.sql) console.error(`STMT: ${String(sql.sql).slice(0, 400)}`);
    console.error(error.stack || error.message || String(error));
    console.error('=============================================\n');
  }
};

// Typical cargo for a lane, by transport mode and cargo type. Values are the
// mid-points a UAE forwarder actually sees, so the seeded weights produce
// believable chargeable weights and freight costs rather than round numbers.
// [minWeightKg, maxWeightKg, minVolumeM3, maxVolumeM3, minPackages, maxPackages]
const CARGO_PROFILES = {
  'AIR:LSE': [180, 2800, 1.2, 18, 4, 120],
  'AIR:CR': [8, 220, 0.05, 1.6, 1, 14],
  'AIR:*': [240, 3600, 2, 24, 6, 160],
  'SEA:FCL': [16000, 26000, 52, 66, 180, 1100],
  'SEA:LCL': [1800, 9500, 4, 26, 12, 320],
  'SEA:BULK': [120000, 480000, 0, 0, 0, 0],
  'SEA:RORO': [1400, 24000, 0, 0, 1, 24],
  'SEA:BREAKBULK': [22000, 95000, 70, 240, 4, 60],
  'SEA:*': [4000, 22000, 12, 58, 20, 400],
  'ROAD:FTL': [14000, 24000, 48, 82, 120, 900],
  'ROAD:LTL': [400, 5200, 2.5, 22, 6, 180],
  'ROAD:*': [2000, 18000, 10, 60, 20, 500],
  'RAIL:*': [18000, 28000, 55, 70, 200, 1000],
  'COURIER:*': [2, 90, 0.02, 0.7, 1, 8],
  '*': [1500, 12000, 6, 40, 15, 300],
};

// Stable 0..1 from a string, so a job gets the same cargo on every restart.
const hashUnit = (s) => {
  let h = 2166136261;
  for (let i = 0; i < String(s).length; i += 1) {
    h ^= String(s).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
};

const cargoProfileFor = (mode, cargoType) => CARGO_PROFILES[`${mode}:${cargoType}`]
  || CARGO_PROFILES[`${mode}:*`]
  || CARGO_PROFILES['*'];

/**
 * Fill in weight, volume and package counts on shipments that were seeded
 * without them. Only touches a field that is null or zero, so any real figure
 * already captured is left exactly as it is.
 */
const backfillJobCargo = async (models) => {
  const { FFJob, MasterShipment, Quotation } = models;

  // Quotes first - a quote with no cargo figures prices every per-kg charge
  // at zero, and the shipment created from it inherits the same hole.
  const quotes = await Quotation.findAll({
    where: {
      isMultimodal: false,
      [Op.or]: [
        { cargoWeight: null }, { cargoWeight: 0 },
        { cargoVolume: null }, { cargoVolume: 0 },
      ],
    },
    attributes: ['id', 'quoteNumber', 'transportMode', 'mode', 'cargoType',
      'cargoWeight', 'cargoVolume', 'containerCount', 'packUnit'],
  });
  for (const q of quotes) {
    const raw = String(q.transportMode || q.mode || 'SEA').toUpperCase();
    const mode = raw === 'LAND' ? 'ROAD' : raw;
    const [wMin, wMax, vMin, vMax, pMin, pMax] = cargoProfileFor(mode, String(q.cargoType || '').toUpperCase());
    const u = hashUnit(q.quoteNumber || q.id);
    const span = (min, max) => min + (max - min) * u;
    const boxes = Math.max(1, Number(q.containerCount) || 1);

    const patch = {};
    if (!Number(q.cargoWeight)) patch.cargoWeight = Number((span(wMin, wMax) * boxes).toFixed(3));
    if (!Number(q.cargoVolume) && vMax > 0) patch.cargoVolume = Number((span(vMin, vMax) * boxes).toFixed(3));
    if (!Number(q.packUnit) && pMax > 0) patch.packUnit = Math.max(1, Math.round(span(pMin, pMax) * boxes));
    if (Object.keys(patch).length) await q.update(patch);
  }
  if (quotes.length) console.log(`  cargo figures filled on ${quotes.length} quotation(s)`);

  const jobs = await FFJob.findAll({
    where: {
      [Op.or]: [
        { grossWeight: null }, { grossWeight: 0 },
        { volume: null }, { volume: 0 },
      ],
    },
    attributes: ['id', 'jobNumber', 'transportMode', 'cargoType', 'grossWeight',
      'volume', 'netWeight', 'packages', 'packCount', 'containerNumbers'],
  });

  let filled = 0;
  for (const j of jobs) {
    const mode = String(j.transportMode || 'SEA').toUpperCase();
    const [wMin, wMax, vMin, vMax, pMin, pMax] = cargoProfileFor(mode, String(j.cargoType || '').toUpperCase());
    const u = hashUnit(j.jobNumber || j.id);
    const span = (min, max) => min + (max - min) * u;

    const containers = Array.isArray(j.containerNumbers) ? j.containerNumbers.length : 0;
    // An FCL job's cargo scales with how many boxes it actually has.
    const boxes = mode === 'SEA' && containers > 0 ? containers : 1;

    const patch = {};
    if (!Number(j.grossWeight)) {
      patch.grossWeight = Number((span(wMin, wMax) * boxes).toFixed(3));
    }
    if (!Number(j.volume) && vMax > 0) {
      patch.volume = Number((span(vMin, vMax) * boxes).toFixed(3));
    }
    if (!Number(j.netWeight)) {
      // Net is the cargo without packaging: a few percent under gross.
      const gross = patch.grossWeight || Number(j.grossWeight) || 0;
      if (gross) patch.netWeight = Number((gross * 0.94).toFixed(3));
    }
    if (!Number(j.packages) && !Number(j.packCount) && pMax > 0) {
      const count = Math.max(1, Math.round(span(pMin, pMax) * boxes));
      patch.packages = count;
      patch.packCount = count;
    }
    if (Object.keys(patch).length) {
      await j.update(patch);
      filled += 1;
    }
  }

  // Master shipments carry the sum of their house shipments, so they are
  // derived rather than invented.
  const masters = await MasterShipment.findAll({ attributes: ['id'] });
  for (const m of masters) {
    const houses = await FFJob.findAll({
      where: { masterShipmentId: m.id },
      attributes: ['grossWeight', 'volume', 'packages'],
    });
    if (!houses.length) continue;
    const sum = (field) => houses.reduce((s, h) => s + (Number(h[field]) || 0), 0);
    await m.update({
      grossWeight: Number(sum('grossWeight').toFixed(3)),
      volume: Number(sum('volume').toFixed(3)),
      packages: Math.round(sum('packages')),
    });
  }

  if (filled) console.log(`  cargo figures filled on ${filled} house shipment(s)`);

  await backfillCarriersAndContainers(models);
};

// Container owner prefixes by shipping line. The SCAC (e.g. CMDU) and the
// container owner code (CMAU) are different registers, so this is a lookup
// rather than a reuse of the carrier code.
const OWNER_PREFIX = {
  'CMA CGM': 'CMAU',
  'Evergreen Marine': 'EGHU',
  'Maersk Line': 'MSKU',
  'MSC (Mediterranean Shipping Company)': 'MSCU',
};

/**
 * Give every shipment a carrier and every full-container sea shipment its
 * container numbers. Older shipments were seeded without either, which left
 * the shipping-line and TEU reports with one "Not set" row and flagged every
 * FCL job as a data discrepancy. Only empty fields are filled, and container
 * numbers carry a valid ISO 6346 check digit.
 */
const backfillCarriersAndContainers = async (models) => {
  const { FFJob, Carrier } = models;
  const { make } = require('../utils/containerNumber');

  const carriers = await Carrier.findAll({ order: [['name', 'ASC']], raw: true });
  const byType = (t) => carriers.filter((c) => c.type === t);
  const lines = byType('shipping_line');
  const airlines = byType('airline');
  const truckers = byType('trucking');
  if (!carriers.length) return;

  const jobs = await FFJob.findAll({
    attributes: ['id', 'jobNumber', 'transportMode', 'cargoType', 'carrier', 'containerNumbers'],
  });

  let carriersSet = 0;
  let boxesSet = 0;
  for (const j of jobs) {
    const mode = String(j.transportMode || '').toUpperCase();
    const u = hashUnit(j.jobNumber || j.id);
    const patch = {};

    let carrierName = j.carrier;
    if (!carrierName) {
      const pool = mode === 'SEA' ? lines : (mode === 'AIR' || mode === 'COURIER') ? airlines : truckers;
      const chosen = pool.length ? pool[Math.floor(u * pool.length) % pool.length] : null;
      if (chosen) {
        carrierName = chosen.name;
        patch.carrier = chosen.name;
        carriersSet += 1;
      }
    }

    const hasBoxes = Array.isArray(j.containerNumbers) && j.containerNumbers.length;
    if (!hasBoxes && mode === 'SEA' && String(j.cargoType).toUpperCase() === 'FCL') {
      // One to three boxes, weighted towards one, the way FCL bookings run.
      const count = u < 0.6 ? 1 : (u < 0.88 ? 2 : 3);
      const prefix = OWNER_PREFIX[carrierName] || 'CFXU';
      const base = Math.floor(u * 900000) + 100000;
      patch.containerNumbers = Array.from({ length: count }, (_, i) => make(prefix, base + i * 17));
      boxesSet += 1;
    }

    if (Object.keys(patch).length) await j.update(patch);
  }
  if (carriersSet || boxesSet) {
    console.log(`  carriers set on ${carriersSet} shipment(s), containers on ${boxesSet}`);
  }
};

/**
 * Three multimodal quotes, one per shape the test plan calls for:
 * road+sea+road door to door, road+air, and a four-leg
 * road -> sea -> road -> air movement with a change of carrier mid-route.
 */
const seedMultimodalQuotes = async (models, ctx) => {
  const { Quotation, QuoteLeg, ChargeLine, Organization, Port, Carrier, Customer } = models;
  const { companyId, users, teams, today, year } = ctx;

  const ports = await Port.findAll({ limit: 40, order: [['code', 'ASC']] });
  const carriers = await Carrier.findAll({ limit: 12, order: [['name', 'ASC']] });
  const customers = await Customer.findAll({ limit: 8, order: [['createdAt', 'ASC']] });
  const vendors = await Organization.findAll({ limit: 12, order: [['createdAt', 'ASC']] });
  if (!customers.length) return;

  const portBy = (code) => ports.find((p) => (p.code || '').toUpperCase() === code) || null;

  const PLANS = [
    {
      label: 'Door to door - Dubai to Gandhinagar',
      transportMode: 'MULTIMODAL',
      shipmentType: 'FCL',
      cargoType: 'FCL',
      direction: 'EXPORT',
      commodity: 'Valves and fittings',
      grossWeight: 18400,
      volume: 58,
      containerCount: 1,
      packUnit: 420,
      legs: [
        {
          transportMode: 'ROAD', shipmentType: 'FTL', truckCount: 1,
          originCountry: 'United Arab Emirates', originLocation: 'Dubai Investment Park',
          destinationCountry: 'United Arab Emirates', destinationLocation: 'Jebel Ali Port',
          destPort: 'AEJEA', transitDays: 1,
          pickupLocationType: 'Factory', deliveryLocationType: 'Port',
        },
        {
          transportMode: 'SEA', shipmentType: 'FCL', containerCount: 1,
          originCountry: 'United Arab Emirates', originLocation: 'Jebel Ali',
          originPort: 'AEJEA',
          destinationCountry: 'India', destinationLocation: 'Nhava Sheva',
          destPort: 'INNSA', transitDays: 6,
          pickupLocationType: 'Port', deliveryLocationType: 'Port',
          addVesselDetails: true, vesselName: 'MSC Kalina', voyageNumber: '428W',
        },
        {
          transportMode: 'ROAD', shipmentType: 'FTL', truckCount: 1,
          originCountry: 'India', originLocation: 'Nhava Sheva',
          originPort: 'INNSA',
          destinationCountry: 'India', destinationLocation: 'Gandhinagar',
          transitDays: 2,
          pickupLocationType: 'Port', deliveryLocationType: 'Warehouse',
        },
      ],
    },
    {
      label: 'Road feeder plus air - Sharjah to Frankfurt',
      transportMode: 'MULTIMODAL',
      shipmentType: 'Air Freight',
      // Air cargo is loose, not containerised, so the cargo type is LSE.
      cargoType: 'LSE',
      direction: 'EXPORT',
      commodity: 'Pharmaceuticals',
      grossWeight: 1240,
      volume: 7.4,
      packUnit: 36,
      isTemperatureControlled: true,
      legs: [
        {
          transportMode: 'ROAD', shipmentType: 'LTL',
          originCountry: 'United Arab Emirates', originLocation: 'Sharjah Airport Free Zone',
          destinationCountry: 'United Arab Emirates', destinationLocation: 'Dubai International Airport',
          destPort: 'AEDXB', transitDays: 1,
          pickupLocationType: 'Warehouse', deliveryLocationType: 'Airport',
          isTemperatureControl: true, temperatureDetails: '2 to 8 degrees C, reefer truck',
        },
        {
          transportMode: 'AIR', shipmentType: 'Air Freight',
          originCountry: 'United Arab Emirates', originLocation: 'Dubai',
          originPort: 'AEDXB',
          destinationCountry: 'Germany', destinationLocation: 'Frankfurt',
          destPort: 'DEFRA', transitDays: 1,
          pickupLocationType: 'Airport', deliveryLocationType: 'Airport',
          addFlightDetails: true, flightNumber: 'EK047', aircraftType: 'pax',
          isTemperatureControl: true, temperatureDetails: 'Envirotainer RAP e2, 2 to 8 degrees C',
        },
      ],
    },
    {
      label: 'Four leg project move - Jebel Ali to Tashkent',
      transportMode: 'MULTIMODAL',
      shipmentType: 'FCL',
      // Out-of-gauge project cargo on flat racks is break bulk, not plain FCL.
      cargoType: 'BREAKBULK',
      direction: 'EXPORT',
      commodity: 'Transformer and switchgear',
      grossWeight: 26800,
      volume: 96,
      containerCount: 2,
      packUnit: 14,
      isDangerous: false,
      isOutOfGauge: true,
      legs: [
        {
          transportMode: 'ROAD', shipmentType: 'FTL', truckCount: 2,
          originCountry: 'United Arab Emirates', originLocation: 'Dubai Industrial City',
          destinationCountry: 'United Arab Emirates', destinationLocation: 'Jebel Ali Port',
          destPort: 'AEJEA', transitDays: 1,
          pickupLocationType: 'Factory', deliveryLocationType: 'Port',
          isOutOfGauge: true, outOfGaugeDetails: 'Transformer 4.1 m wide on a low-bed trailer; police permit required',
        },
        {
          transportMode: 'SEA', shipmentType: 'FCL', containerCount: 2,
          originCountry: 'United Arab Emirates', originLocation: 'Jebel Ali',
          originPort: 'AEJEA',
          destinationCountry: 'Iran', destinationLocation: 'Bandar Abbas',
          transitDays: 3,
          pickupLocationType: 'Port', deliveryLocationType: 'Port',
          addVesselDetails: true, vesselName: 'Gulf Navigator', voyageNumber: '112N',
          transshipment: true, transshipmentPort: 'Bandar Abbas - change of carrier',
          isOutOfGauge: true, outOfGaugeDetails: 'Flat rack, out of gauge in width',
        },
        {
          transportMode: 'ROAD', shipmentType: 'FTL', truckCount: 2,
          originCountry: 'Iran', originLocation: 'Bandar Abbas',
          destinationCountry: 'Uzbekistan', destinationLocation: 'Tashkent',
          transitDays: 9,
          pickupLocationType: 'Port', deliveryLocationType: 'Warehouse',
          isOutOfGauge: true, outOfGaugeDetails: 'Multi-country transit permits',
        },
        {
          transportMode: 'AIR', shipmentType: 'Air Freight',
          originCountry: 'United Arab Emirates', originLocation: 'Dubai',
          originPort: 'AEDXB',
          destinationCountry: 'Uzbekistan', destinationLocation: 'Tashkent',
          transitDays: 1,
          pickupLocationType: 'Airport', deliveryLocationType: 'Airport',
          addFlightDetails: true, flightNumber: 'HY604', aircraftType: 'coa',
          note: 'Commissioning spares and instrumentation flown ahead of the sea cargo.',
        },
      ],
    },
  ];

  for (let i = 0; i < PLANS.length; i += 1) {
    const plan = PLANS[i];
    const customer = customers[i % customers.length];
    const first = plan.legs[0];
    const last = plan.legs[plan.legs.length - 1];
    const transitDays = plan.legs.reduce((s, l) => s + (l.transitDays || 0), 0);

    const figures = computeChargeable({
      transportMode: plan.legs.find((l) => l.transportMode === 'AIR') ? 'AIR' : 'SEA',
      shipmentType: plan.shipmentType,
      grossWeight: plan.grossWeight,
      volume: plan.volume,
      containerCount: plan.containerCount,
    });

    const quote = await Quotation.create({
      customerId: customer.id,
      createdBy: users[0] ? users[0].id : null,
      companyId,
      status: i === 0 ? 'approved' : 'sent',
      mode: 'multimodal',
      transportMode: 'MULTIMODAL',
      direction: plan.direction,
      cargoType: plan.cargoType,
      shipmentType: plan.shipmentType,
      isMultimodal: true,
      legCount: plan.legs.length,
      quoteFor: 'shipment',
      source: 'system',
      salesTeamId: teams[0] ? teams[0].id : null,
      originCountry: first.originCountry,
      destinationCountry: last.destinationCountry,
      originCity: first.originLocation,
      destinationCity: last.destinationLocation,
      originPortId: first.originPort && portBy(first.originPort) ? portBy(first.originPort).id : null,
      destinationPortId: last.destPort && portBy(last.destPort) ? portBy(last.destPort).id : null,
      commodity: plan.commodity,
      cargoWeight: plan.grossWeight,
      cargoVolume: plan.volume,
      cargoWeightUnit: 'kg',
      containerCount: plan.containerCount || 0,
      packUnit: plan.packUnit,
      chargeableWeight: figures.chargeableWeight,
      chargeableVolume: figures.chargeableVolume,
      weightVolume: figures.weightVolume,
      chargeableBasis: figures.basis,
      volumetricDivisor: figures.divisorUsed,
      estimatedTransitDays: transitDays,
      currency: 'AED',
      validUntil: daysFrom(today, 30),
      isTemperatureControlled: !!plan.isTemperatureControlled,
      isDangerous: !!plan.isDangerous,
      isOutOfGauge: !!plan.isOutOfGauge,
      outOfGaugeDetails: plan.isOutOfGauge ? 'Out of gauge on one or more legs' : null,
      enableQuoteRouting: true,
      notes: plan.label,
      remarks: `Multimodal movement in ${plan.legs.length} legs. `
        + 'Each leg is priced separately; the totals below are the sum of all legs.',
      addTransportationDetails: true,
    });

    const allLines = [];
    for (let k = 0; k < plan.legs.length; k += 1) {
      const l = plan.legs[k];
      const legCargo = {
        transportMode: l.transportMode,
        shipmentType: l.shipmentType,
        grossWeight: plan.grossWeight,
        volume: plan.volume,
        containerCount: l.containerCount || 0,
        truckCount: l.truckCount || 0,
      };
      const legFigures = computeChargeable(legCargo);

      const leg = await QuoteLeg.create({
        quotationId: quote.id,
        legSequence: k + 1,
        transportMode: l.transportMode,
        shipmentType: l.shipmentType,
        cargoType: plan.cargoType,
        isCourierLeg: l.transportMode === 'COURIER',
        originCountry: l.originCountry,
        originLocation: l.originLocation,
        originPortId: l.originPort && portBy(l.originPort) ? portBy(l.originPort).id : null,
        destinationCountry: l.destinationCountry,
        destinationLocation: l.destinationLocation,
        destinationPortId: l.destPort && portBy(l.destPort) ? portBy(l.destPort).id : null,
        pickupLocationType: l.pickupLocationType,
        deliveryLocationType: l.deliveryLocationType,
        carrierId: pick(carriers, k + i) ? pick(carriers, k + i).id : null,
        carrierServiceType: l.pickupLocationType === 'Factory' ? 'Door to Port' : 'Port to Port',
        transitDays: l.transitDays,
        transitTime: `${l.transitDays} day${l.transitDays === 1 ? '' : 's'}`,
        estimatedPickup: daysFrom(today, 7 + plan.legs.slice(0, k).reduce((s, x) => s + (x.transitDays || 0), 0)),
        expectedDelivery: daysFrom(today, 7 + plan.legs.slice(0, k + 1).reduce((s, x) => s + (x.transitDays || 0), 0)),
        vesselName: l.vesselName || null,
        voyageNumber: l.voyageNumber || null,
        flightNumber: l.flightNumber || null,
        aircraftType: l.aircraftType || null,
        addVesselDetails: !!l.addVesselDetails,
        addFlightDetails: !!l.addFlightDetails,
        addTransportationDetails: l.transportMode === 'ROAD',
        packUnit: plan.packUnit,
        grossWeight: plan.grossWeight,
        volume: plan.volume,
        weightVolume: legFigures.weightVolume,
        chargeableWeight: legFigures.chargeableWeight,
        chargeableVolume: legFigures.chargeableVolume,
        chargeableBasis: legFigures.basis,
        volumetricDivisor: legFigures.divisorUsed,
        containerCount: l.containerCount || 0,
        truckCount: l.truckCount || 0,
        isTemperatureControl: !!l.isTemperatureControl,
        temperatureDetails: l.temperatureDetails || null,
        isOutOfGauge: !!l.isOutOfGauge,
        outOfGaugeDetails: l.outOfGaugeDetails || null,
        transshipment: !!l.transshipment,
        transshipmentPort: l.transshipmentPort || null,
        state: quote.status === 'approved' ? 'approved' : 'sent',
        remarks: l.note || `Leg ${k + 1} of ${plan.legs.length}: ${l.transportMode}.`,
        note: l.note || null,
        companyId,
        currency: 'AED',
      });

      const legLines = buildChargeLines({
        parentType: 'quote',
        parentId: quote.id,
        side: 'both',
        cargo: legCargo,
        profile: {
          transportMode: l.transportMode,
          shipmentType: l.shipmentType,
          hasCustoms: k === 0 || k === plan.legs.length - 1,
          isDangerous: plan.isDangerous,
          isReefer: l.isTemperatureControl,
          isOutOfGauge: l.isOutOfGauge,
        },
        index: i * 4 + k,
        creditorId: pick(vendors, i * 4 + k) ? pick(vendors, i * 4 + k).id : null,
        debtorId: customer.id,
        companyId,
        legId: leg.id,
        legSequence: k + 1,
      });
      await ChargeLine.bulkCreate(legLines);
      allLines.push(...legLines);

      const legRoll = rollup(legLines);
      await leg.update({
        totalCostAmount: legRoll.estimatedCost,
        totalSellAmount: legRoll.estimatedRevenue,
        estimatedMargin: legRoll.estimatedMargin,
        allInclusiveSellRate: legRoll.estimatedRevenue,
      });
    }

    const roll = rollup(allLines);
    await quote.update({
      estimatedRevenue: roll.estimatedRevenue,
      estimatedCost: roll.estimatedCost,
      estimatedMargin: roll.estimatedMargin,
      estimatedMarginPercentage: roll.estimatedMarginPercentage,
      allInclusiveSellRate: roll.estimatedRevenue,
      totalBuyRate: roll.estimatedCost,
      totalSellRate: roll.estimatedRevenue,
      totalAmount: roll.estimatedRevenue,
      profit: roll.estimatedMargin,
    });
  }
};

module.exports = {
  seedSalesData, seedMultimodalQuotes, buildChargeLines, backfillJobCargo,
  CHARGE_CATALOGUE, CARGO_PROFILES,
};
