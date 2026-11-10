// Schema for the Sales & CRM / costing / vendor-rate wave.
//
// New tables are created with each model's own `sync()` - that issues
// CREATE TABLE IF NOT EXISTS, so it never touches an existing table and never
// drops anything. It is deliberately not `sequelize.sync()`, which is disabled
// project-wide because it would try to alter every table in the app.
//
// Columns added to tables that already hold data go through explicit
// addColumn calls guarded by describeTable, the same way the rest of
// ensureOperationsTables works.

const { DataTypes } = require('sequelize');

const NEW_MODELS = [
  'CrmStage',
  'SalesTeam',
  'SalesTarget',
  'Prospect',
  'Lead',
  'QuoteTemplate',
  'QuoteLeg',
  'ChargeLine',
  'RateRequest',
  'RateRequestLine',
  'PdcPayment',
];

// Columns the costing / multimodal / CRM work adds to `quotations`.
const QUOTATION_COLUMNS = {
  opportunityId: { type: DataTypes.UUID, allowNull: true },
  salesTeamId: { type: DataTypes.UUID, allowNull: true },
  pricingTeamId: { type: DataTypes.UUID, allowNull: true },
  quoteTemplateId: { type: DataTypes.UUID, allowNull: true },
  source: { type: DataTypes.ENUM('system', 'customer', 'portal'), allowNull: false, defaultValue: 'system' },
  generatedFromPortal: { type: DataTypes.BOOLEAN, defaultValue: false },
  quoteFor: { type: DataTypes.ENUM('shipment', 'job'), allowNull: false, defaultValue: 'shipment' },
  shipmentCount: { type: DataTypes.ENUM('single', 'multiple'), allowNull: false, defaultValue: 'single' },
  serviceJobType: { type: DataTypes.STRING(60), allowNull: true },
  isMultimodal: { type: DataTypes.BOOLEAN, defaultValue: false },
  selectedMultimodalMode: { type: DataTypes.ENUM('SEA', 'AIR', 'ROAD', 'RAIL', 'COURIER'), allowNull: true },
  legCount: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
  quoteRateRequestState: {
    type: DataTypes.ENUM(
      'draft', 'vendor_rate_requested', 'vendor_rate_submitted',
      'vendor_rate_renegotiate_requested', 'vendor_rate_renegotiate_submitted',
      'pricing_approval', 'to_approve', 'approved',
    ),
    allowNull: false,
    defaultValue: 'draft',
  },
  currentRateRequestId: { type: DataTypes.UUID, allowNull: true },
  shipperId: { type: DataTypes.UUID, allowNull: true },
  consigneeId: { type: DataTypes.UUID, allowNull: true },
  agentId: { type: DataTypes.UUID, allowNull: true },
  coLoaderId: { type: DataTypes.UUID, allowNull: true },
  clientTag: { type: DataTypes.STRING(80), allowNull: true },
  consolidationType: { type: DataTypes.STRING(40), allowNull: true },
  serviceMode: { type: DataTypes.STRING(40), allowNull: true },
  carrierServiceType: { type: DataTypes.STRING(80), allowNull: true },
  referenceNumber: { type: DataTypes.STRING(80), allowNull: true },
  pickupLocationType: { type: DataTypes.STRING(60), allowNull: true },
  deliveryLocationType: { type: DataTypes.STRING(60), allowNull: true },
  pickupAddress: { type: DataTypes.TEXT, allowNull: true },
  deliveryAddress: { type: DataTypes.TEXT, allowNull: true },
  pickupZipcode: { type: DataTypes.STRING(20), allowNull: true },
  deliveryZipcode: { type: DataTypes.STRING(20), allowNull: true },
  estimatedPickup: { type: DataTypes.DATE, allowNull: true },
  expectedDelivery: { type: DataTypes.DATE, allowNull: true },
  freeDays: { type: DataTypes.STRING(40), allowNull: true },
  enableQuoteRouting: { type: DataTypes.BOOLEAN, defaultValue: false },
  routes: { type: DataTypes.JSON, allowNull: true },
  packUnit: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
  packUnitUom: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'PKG' },
  netWeight: { type: DataTypes.DECIMAL(14, 3), allowNull: true, defaultValue: 0 },
  weightVolume: { type: DataTypes.DECIMAL(14, 3), allowNull: true, defaultValue: 0 },
  chargeableWeight: { type: DataTypes.DECIMAL(14, 3), allowNull: true, defaultValue: 0 },
  chargeableVolume: { type: DataTypes.DECIMAL(14, 3), allowNull: true, defaultValue: 0 },
  chargeableBasis: { type: DataTypes.STRING(20), allowNull: true },
  volumetricDivisor: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  totalTeu: { type: DataTypes.DECIMAL(10, 2), allowNull: true, defaultValue: 0 },
  truckCount: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
  containerLines: { type: DataTypes.JSON, allowNull: true },
  cargoLines: { type: DataTypes.JSON, allowNull: true },
  isPackageGroup: { type: DataTypes.BOOLEAN, defaultValue: false },
  packagingMode: { type: DataTypes.ENUM('container', 'package'), allowNull: true },
  goodsValue: { type: DataTypes.DECIMAL(16, 2), allowNull: true, defaultValue: 0 },
  goodsValueCurrency: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'AED' },
  insuranceValue: { type: DataTypes.DECIMAL(16, 2), allowNull: true, defaultValue: 0 },
  insuranceValueCurrency: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'AED' },
  hazClass: { type: DataTypes.STRING(40), allowNull: true },
  hazUnNumber: { type: DataTypes.STRING(20), allowNull: true },
  dangerousGoodNote: { type: DataTypes.TEXT, allowNull: true },
  isStackable: { type: DataTypes.BOOLEAN, defaultValue: true },
  temperatureDetails: { type: DataTypes.STRING(120), allowNull: true },
  isOutOfGauge: { type: DataTypes.BOOLEAN, defaultValue: false },
  outOfGaugeDetails: { type: DataTypes.STRING(200), allowNull: true },
  isCourierShipment: { type: DataTypes.BOOLEAN, defaultValue: false },
  serviceType: { type: DataTypes.ENUM('Standard', 'Priority'), allowNull: true },
  flightNumber: { type: DataTypes.STRING(30), allowNull: true },
  aircraftType: { type: DataTypes.ENUM('coa', 'pax'), allowNull: true },
  addFlightDetails: { type: DataTypes.BOOLEAN, defaultValue: false },
  addVesselDetails: { type: DataTypes.BOOLEAN, defaultValue: false },
  addTransportationDetails: { type: DataTypes.BOOLEAN, defaultValue: false },
  scheduleId: { type: DataTypes.UUID, allowNull: true },
  estimatedRevenue: { type: DataTypes.DECIMAL(16, 2), allowNull: true, defaultValue: 0 },
  estimatedCost: { type: DataTypes.DECIMAL(16, 2), allowNull: true, defaultValue: 0 },
  estimatedMargin: { type: DataTypes.DECIMAL(16, 2), allowNull: true, defaultValue: 0 },
  estimatedMarginPercentage: { type: DataTypes.DECIMAL(9, 4), allowNull: true, defaultValue: 0 },
  allInclusiveSellRate: { type: DataTypes.DECIMAL(16, 2), allowNull: true, defaultValue: 0 },
  isGroupSimilarCharge: { type: DataTypes.BOOLEAN, defaultValue: false },
  divideValue: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
  hideTotalInWords: { type: DataTypes.BOOLEAN, defaultValue: false },
  showInclSingleLine: { type: DataTypes.BOOLEAN, defaultValue: false },
  multiCarrierQuote: { type: DataTypes.BOOLEAN, defaultValue: false },
  selectedCarrierId: { type: DataTypes.UUID, allowNull: true },
  selectedTransitTime: { type: DataTypes.INTEGER, allowNull: true },
  allowApproval: { type: DataTypes.BOOLEAN, defaultValue: false },
  approvingUserId: { type: DataTypes.UUID, allowNull: true },
  approverRejectReason: { type: DataTypes.STRING(250), allowNull: true },
  signedBy: { type: DataTypes.STRING(150), allowNull: true },
  signedOn: { type: DataTypes.DATE, allowNull: true },
  declineMessage: { type: DataTypes.TEXT, allowNull: true },
  changeReason: { type: DataTypes.STRING(150), allowNull: true },
  isRenegotiated: { type: DataTypes.BOOLEAN, defaultValue: false },
  portalCancelReason: { type: DataTypes.STRING(250), allowNull: true },
  originalQuoteId: { type: DataTypes.UUID, allowNull: true },
  cancelledQuoteId: { type: DataTypes.UUID, allowNull: true },
  isSupplementary: { type: DataTypes.BOOLEAN, defaultValue: false },
  supplementaryLastNo: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
  isDuplicated: { type: DataTypes.BOOLEAN, defaultValue: false },
  tags: { type: DataTypes.JSON, allowNull: true },
  accessToken: { type: DataTypes.STRING(64), allowNull: true },
  companyId: { type: DataTypes.UUID, allowNull: true },
};

// Columns that let one `schedules` table serve both Sailing and Air Schedules.
const SCHEDULE_COLUMNS = {
  serviceName: { type: DataTypes.STRING(120), allowNull: true },
  source: { type: DataTypes.ENUM('manual', 'inttra', 'carrier_api'), allowNull: false, defaultValue: 'manual' },
  originCountry: { type: DataTypes.STRING(100), allowNull: true },
  destinationCountry: { type: DataTypes.STRING(100), allowNull: true },
  actualDepartureDate: { type: DataTypes.DATE, allowNull: true },
  actualArrivalDate: { type: DataTypes.DATE, allowNull: true },
  siCutoff: { type: DataTypes.DATE, allowNull: true },
  parentScheduleId: { type: DataTypes.UUID, allowNull: true },
  legSequence: { type: DataTypes.INTEGER, allowNull: true },
  quoteLegId: { type: DataTypes.UUID, allowNull: true },
  scacNumber: { type: DataTypes.STRING(20), allowNull: true },
  vesselCutoff: { type: DataTypes.DATE, allowNull: true },
  vgmCutoff: { type: DataTypes.DATE, allowNull: true },
  iataNumber: { type: DataTypes.STRING(20), allowNull: true },
  icaoNumber: { type: DataTypes.STRING(20), allowNull: true },
  aircraftType: { type: DataTypes.ENUM('coa', 'pax'), allowNull: true },
  onboardingCutoff: { type: DataTypes.DATE, allowNull: true },
  flightStatus: { type: DataTypes.STRING(40), allowNull: true },
};

// Roll-up columns the charge-line engine writes onto shipment-like records.
const COSTING_ROLLUP_COLUMNS = {
  estimatedRevenue: { type: DataTypes.DECIMAL(16, 2), allowNull: true, defaultValue: 0 },
  estimatedCost: { type: DataTypes.DECIMAL(16, 2), allowNull: true, defaultValue: 0 },
  estimatedMargin: { type: DataTypes.DECIMAL(16, 2), allowNull: true, defaultValue: 0 },
  estimatedMarginPercentage: { type: DataTypes.DECIMAL(9, 4), allowNull: true, defaultValue: 0 },
  receivedRevenue: { type: DataTypes.DECIMAL(16, 2), allowNull: true, defaultValue: 0 },
  paidCost: { type: DataTypes.DECIMAL(16, 2), allowNull: true, defaultValue: 0 },
  receivedMargin: { type: DataTypes.DECIMAL(16, 2), allowNull: true, defaultValue: 0 },
  dueRevenue: { type: DataTypes.DECIMAL(16, 2), allowNull: true, defaultValue: 0 },
  dueCost: { type: DataTypes.DECIMAL(16, 2), allowNull: true, defaultValue: 0 },
  revenueChargeStatus: { type: DataTypes.STRING(20), allowNull: true, defaultValue: 'no' },
  costChargeStatus: { type: DataTypes.STRING(20), allowNull: true, defaultValue: 'no' },
  chargeableWeight: { type: DataTypes.DECIMAL(14, 3), allowNull: true, defaultValue: 0 },
  chargeableBasis: { type: DataTypes.STRING(20), allowNull: true },
  weightVolume: { type: DataTypes.DECIMAL(14, 3), allowNull: true, defaultValue: 0 },
  volumetricDivisor: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  quoteLegId: { type: DataTypes.UUID, allowNull: true },
};

/**
 * Add every column in `columns` that the table does not already have.
 * Returns the names actually added so the caller can log a real summary.
 */
const addMissingColumns = async (qi, table, columns) => {
  let existing;
  try {
    existing = await qi.describeTable(table);
  } catch (err) {
    // Table not created yet (fresh database, earlier step still to run).
    return [];
  }
  const added = [];
  for (const [name, spec] of Object.entries(columns)) {
    if (existing[name]) continue;
    try {
      await qi.addColumn(table, name, spec);
      added.push(name);
    } catch (err) {
      // A duplicate-column race is harmless; anything else is worth seeing.
      if (!/duplicate column|already exists/i.test(err.message || '')) {
        console.error(`  ! ${table}.${name}: ${err.message}`);
      }
    }
  }
  return added;
};

// Columns on charge_lines that hold a party or a parent record which may live
// in more than one table. A charge's creditor or debtor can be an
// Organization or a Customer; a converted quote leg can become an FFJob or a
// Shipment. An earlier build of this table constrained them to one table,
// which rejected valid ids from the other, so any such constraint left over
// from that build is dropped here.
const POLYMORPHIC_COLUMNS = {
  charge_lines: ['creditorPartnerId', 'debtorPartnerId', 'productId', 'carrierId'],
  quote_legs: ['convertedShipmentId'],
};

const dropPartyForeignKeys = async (qi, sequelize) => {
  const dbName = sequelize.config.database;
  for (const [table, columns] of Object.entries(POLYMORPHIC_COLUMNS)) {
    let rows;
    try {
      [rows] = await sequelize.query(
        `SELECT CONSTRAINT_NAME AS name, COLUMN_NAME AS col
           FROM information_schema.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME = ?
            AND REFERENCED_TABLE_NAME IS NOT NULL`,
        { replacements: [dbName, table] },
      );
    } catch (err) {
      continue;
    }
    for (const r of rows || []) {
      if (!columns.includes(r.col)) continue;
      try {
        await qi.removeConstraint(table, r.name);
        console.log(`  dropped FK ${table}.${r.col} (${r.name})`);
      } catch (err) {
        console.error(`  ! could not drop FK ${r.name} on ${table}: ${err.message}`);
      }
    }
  }
};

// Enum values the courier and multimodal work needs that the original schema
// did not have. Widening an enum is additive - every value already stored
// stays valid - so this is safe to re-run and never rewrites a row.
//
// MULTIMODAL is a real value on a quote header: a door-to-door quote covering
// road, sea and air has no single carriage mode, and the per-leg modes live on
// `quote_legs`. COURIER is a mode in its own right because it bills on a
// 1:5000 volumetric divisor rather than air's 1:6000.
const ENUM_ADDITIONS = [
  { table: 'quotations', column: 'transportMode', values: ['SEA', 'AIR', 'ROAD', 'RAIL', 'COURIER', 'MULTIMODAL'] },
  { table: 'quotations', column: 'direction', values: ['EXPORT', 'IMPORT', 'LOCAL', 'CROSS_TRADE'] },
  { table: 'ff_jobs', column: 'transportMode', values: ['AIR', 'SEA', 'ROAD', 'RAIL', 'COURIER', 'MULTIMODAL'] },
  { table: 'ff_jobs', column: 'direction', values: ['EXPORT', 'IMPORT', 'LOCAL', 'CROSS_TRADE'] },
  { table: 'master_shipments', column: 'transportMode', values: ['AIR', 'SEA', 'ROAD', 'RAIL', 'COURIER', 'MULTIMODAL'] },
  { table: 'consolidations', column: 'transportMode', values: ['AIR', 'SEA', 'ROAD', 'RAIL', 'COURIER', 'MULTIMODAL'] },
  { table: 'rates', column: 'mode', values: ['sea', 'air', 'land', 'rail', 'courier', 'multimodal'] },
  { table: 'schedules', column: 'mode', values: ['sea', 'air', 'land', 'rail', 'courier'] },
  { table: 'opportunities', column: 'transportMode', values: ['SEA', 'AIR', 'ROAD', 'RAIL', 'COURIER', 'MULTIMODAL'] },
  { table: 'opportunities', column: 'direction', values: ['EXPORT', 'IMPORT', 'LOCAL', 'CROSS_TRADE'] },
  // `proposition` and `pricing` were the original stage labels; the stage
  // table now drives the pipeline but the enum stays so old rows stay valid.
  {
    table: 'opportunities',
    column: 'stage',
    values: ['new', 'qualified', 'proposition', 'negotiation', 'won', 'lost'],
  },
];

const widenEnums = async (sequelize) => {
  const dbName = sequelize.config.database;
  for (const { table, column, values } of ENUM_ADDITIONS) {
    let current;
    try {
      const [rows] = await sequelize.query(
        `SELECT COLUMN_TYPE AS ty, IS_NULLABLE AS nullable, COLUMN_DEFAULT AS deflt
           FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        { replacements: [dbName, table, column] },
      );
      current = rows && rows[0];
    } catch (err) {
      continue;
    }
    if (!current || !/^enum\(/i.test(current.ty)) continue;

    const existing = current.ty
      .replace(/^enum\(/i, '')
      .replace(/\)$/, '')
      .split(',')
      .map((v) => v.trim().replace(/^'|'$/g, ''));
    const missing = values.filter((v) => !existing.includes(v));
    if (!missing.length) continue;

    // Keep every value already in the column and append only what is new, so
    // no existing row is invalidated.
    const merged = [...existing, ...missing];
    const nullClause = current.nullable === 'YES' ? 'NULL' : 'NOT NULL';
    const defaultClause = current.deflt != null
      ? ` DEFAULT ${sequelize.escape(current.deflt)}`
      : '';
    const list = merged.map((v) => sequelize.escape(v)).join(',');
    try {
      await sequelize.query(
        `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ENUM(${list}) ${nullClause}${defaultClause}`,
      );
      console.log(`  ${table}.${column} enum += ${missing.join(', ')}`);
    } catch (err) {
      console.error(`  ! could not widen ${table}.${column}: ${err.message}`);
    }
  }
};

/**
 * Create the wave's tables and widen the ones it extends.
 * @param {import('sequelize').Sequelize} sequelize
 */
const ensureSalesTables = async (sequelize) => {
  const qi = sequelize.getQueryInterface();
  const models = require('../models');

  const created = [];
  for (const name of NEW_MODELS) {
    const model = models[name];
    if (!model) {
      console.error(`  ! salesWave: model ${name} is not exported from models/index.js`);
      continue;
    }
    // CREATE TABLE IF NOT EXISTS - never alters or drops an existing table.
    await model.sync();
    created.push(model.getTableName());
  }
  console.log(`  Sales/costing tables ready: ${created.join(', ')}`);

  await dropPartyForeignKeys(qi, sequelize);
  await widenEnums(sequelize);

  const q = await addMissingColumns(qi, 'quotations', QUOTATION_COLUMNS);
  if (q.length) console.log(`  quotations +${q.length} columns`);

  const s = await addMissingColumns(qi, 'schedules', SCHEDULE_COLUMNS);
  if (s.length) console.log(`  schedules +${s.length} columns`);

  // Shipment-like records that charge lines roll up onto. `ff_jobs` is the
  // house shipment in this codebase; `shipments` and `master_shipments` and
  // `service_jobs` take the same roll-up so one report query covers them all.
  for (const table of ['ff_jobs', 'shipments', 'master_shipments', 'service_jobs']) {
    const added = await addMissingColumns(qi, table, COSTING_ROLLUP_COLUMNS);
    if (added.length) console.log(`  ${table} +${added.length} costing columns`);
  }

  // Service jobs also gain the customs block the upstream Service Job form has.
  const serviceJobCustoms = {
    serviceJobType: { type: DataTypes.STRING(60), allowNull: true },
    bookingNominationNo: { type: DataTypes.STRING(60), allowNull: true },
    hasCustoms: { type: DataTypes.BOOLEAN, defaultValue: false },
    customsAdCode: { type: DataTypes.STRING(40), allowNull: true },
    customsLocation: { type: DataTypes.STRING(150), allowNull: true },
    customsDeclarationNumber: { type: DataTypes.STRING(60), allowNull: true },
    customsDeclarationDate: { type: DataTypes.DATEONLY, allowNull: true },
    customsClearanceDatetime: { type: DataTypes.DATE, allowNull: true },
    customsProcedureCode: { type: DataTypes.STRING(40), allowNull: true },
    customsBeType: { type: DataTypes.STRING(60), allowNull: true },
    tariffDeterminationNumber: { type: DataTypes.STRING(60), allowNull: true },
    valueDeterminationNumber: { type: DataTypes.STRING(60), allowNull: true },
    boeNumber: { type: DataTypes.STRING(60), allowNull: true },
    boeDate: { type: DataTypes.DATEONLY, allowNull: true },
    ownership: { type: DataTypes.ENUM('self', 'third_party'), allowNull: true },
    ownershipPartnerId: { type: DataTypes.UUID, allowNull: true },
    isHazardous: { type: DataTypes.BOOLEAN, defaultValue: false },
    hazClass: { type: DataTypes.STRING(40), allowNull: true },
    hazUnNumber: { type: DataTypes.STRING(20), allowNull: true },
    hazRemark: { type: DataTypes.TEXT, allowNull: true },
    transportMode: { type: DataTypes.STRING(20), allowNull: true },
    shipmentType: { type: DataTypes.STRING(30), allowNull: true },
    cargoType: { type: DataTypes.STRING(30), allowNull: true },
    salesAgentId: { type: DataTypes.UUID, allowNull: true },
    clientTag: { type: DataTypes.STRING(80), allowNull: true },
    etd: { type: DataTypes.DATE, allowNull: true },
    eta: { type: DataTypes.DATE, allowNull: true },
    atd: { type: DataTypes.DATE, allowNull: true },
    ata: { type: DataTypes.DATE, allowNull: true },
    grossWeight: { type: DataTypes.DECIMAL(14, 3), allowNull: true, defaultValue: 0 },
    volume: { type: DataTypes.DECIMAL(14, 3), allowNull: true, defaultValue: 0 },
    packUnit: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
  };
  const sj = await addMissingColumns(qi, 'service_jobs', serviceJobCustoms);
  if (sj.length) console.log(`  service_jobs +${sj.length} customs/cargo columns`);

  // Leads and opportunities link both ways; `leadId` closes the loop so an
  // opportunity can show where it came from.
  const oppColumns = {
    leadId: { type: DataTypes.UUID, allowNull: true },
    prospectId: { type: DataTypes.UUID, allowNull: true },
    stageId: { type: DataTypes.UUID, allowNull: true },
    salesTeamId: { type: DataTypes.UUID, allowNull: true },
    pricingTeamId: { type: DataTypes.UUID, allowNull: true },
    opportunityType: { type: DataTypes.ENUM('new', 'existing'), allowNull: true },
    opportunityFor: { type: DataTypes.ENUM('shipment', 'job'), allowNull: true },
    opportunitySource: { type: DataTypes.ENUM('online', 'offline'), allowNull: true },
    customerType: { type: DataTypes.ENUM('consignor', 'consignee', 'agent'), allowNull: true },
    roadCustomerType: { type: DataTypes.ENUM('sending_forwarder', 'receiving_forwarder'), allowNull: true },
    clientTag: { type: DataTypes.STRING(80), allowNull: true },
    shipmentType: { type: DataTypes.STRING(30), allowNull: true },
    cargoType: { type: DataTypes.STRING(30), allowNull: true },
    cargoDescription: { type: DataTypes.TEXT, allowNull: true },
    cargoStatus: { type: DataTypes.ENUM('ready', 'later'), allowNull: true },
    commodity: { type: DataTypes.STRING(200), allowNull: true },
    shipmentDueDate: { type: DataTypes.DATEONLY, allowNull: true },
    incoterm: { type: DataTypes.STRING(20), allowNull: true },
    serviceMode: { type: DataTypes.STRING(40), allowNull: true },
    serviceJobType: { type: DataTypes.STRING(60), allowNull: true },
    originCountry: { type: DataTypes.STRING(100), allowNull: true },
    destinationCountry: { type: DataTypes.STRING(100), allowNull: true },
    portOfLoadingId: { type: DataTypes.UUID, allowNull: true },
    portOfDischargeId: { type: DataTypes.UUID, allowNull: true },
    pickupAddress: { type: DataTypes.TEXT, allowNull: true },
    deliveryAddress: { type: DataTypes.TEXT, allowNull: true },
    pickupLocationType: { type: DataTypes.STRING(60), allowNull: true },
    deliveryLocationType: { type: DataTypes.STRING(60), allowNull: true },
    pickupZipcode: { type: DataTypes.STRING(20), allowNull: true },
    deliveryZipcode: { type: DataTypes.STRING(20), allowNull: true },
    packageLines: { type: DataTypes.JSON, allowNull: true },
    containerLines: { type: DataTypes.JSON, allowNull: true },
    customerVisits: { type: DataTypes.JSON, allowNull: true },
    additionalServices: { type: DataTypes.JSON, allowNull: true },
    agentIds: { type: DataTypes.JSON, allowNull: true },
    agentId: { type: DataTypes.UUID, allowNull: true },
    transitDays: { type: DataTypes.INTEGER, allowNull: true },
    rateApproverId: { type: DataTypes.UUID, allowNull: true },
    rateRequestEmailSent: { type: DataTypes.BOOLEAN, defaultValue: false },
    rateRequestApproved: { type: DataTypes.BOOLEAN, defaultValue: false },
    pricingApproval: { type: DataTypes.BOOLEAN, defaultValue: false },
    currentRateRequestId: { type: DataTypes.UUID, allowNull: true },
    accessToken: { type: DataTypes.STRING(64), allowNull: true },
    isCreateFromLead: { type: DataTypes.BOOLEAN, defaultValue: false },
    companyId: { type: DataTypes.UUID, allowNull: true },
    contactDesignation: { type: DataTypes.STRING(120), allowNull: true },
    contactDepartment: { type: DataTypes.STRING(120), allowNull: true },
  };
  const op = await addMissingColumns(qi, 'opportunities', oppColumns);
  if (op.length) console.log(`  opportunities +${op.length} columns`);
};

module.exports = { ensureSalesTables, addMissingColumns };
