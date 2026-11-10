const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// One table behind every charge line in the app: quote charge lines, house and
// master shipment cost/revenue charges, service job cost/revenue charges and
// pro forma invoice lines.
//
// Upstream keeps six near-identical tables (shipment.quote.line,
// house.shipment.charge.cost/.revenue, service.job.charge.cost/.revenue,
// pro.forma.invoice.line). They share ~95% of their columns and cross-reference
// each other constantly - a quote line spawns a cost charge and a revenue
// charge, which pair back to each other and then to invoice lines. Keeping
// them in one table makes those links plain self-references and lets the six
// "Settings > Technical > Charge Lines" views be filters rather than six
// screens.
//
// `side` is what distinguishes them: a quote line is 'both' (it carries a buy
// rate and a sell rate on one row, exactly as upstream does), while shipment
// and service-job charges are 'cost' or 'revenue'.
//
// ponytail: single table with a parentType discriminator. Split per parent
// only if one parent's charge volume makes the shared indexes hurt.
const ChargeLine = sequelize.define('ChargeLine', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },

  // --- what this line hangs off --------------------------------------------
  parentType: {
    type: DataTypes.ENUM('quote', 'house_shipment', 'master_shipment', 'service_job', 'pro_forma'),
    allowNull: false,
    comment: 'Which record owns this charge line',
  },
  parentId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  side: {
    type: DataTypes.ENUM('cost', 'revenue', 'both'),
    allowNull: false,
    defaultValue: 'both',
    comment: "'both' = a quote line carrying buy and sell together",
  },
  sequence: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 10,
  },

  // --- what is being charged -----------------------------------------------
  productId: { type: DataTypes.UUID, allowNull: true },
  chargeCode: { type: DataTypes.STRING(30), allowNull: true },
  serviceName: { type: DataTypes.STRING(200), allowNull: true },
  chargeDescription: { type: DataTypes.STRING(250), allowNull: false },
  chargeNote: { type: DataTypes.STRING(250), allowNull: true },

  uom: { type: DataTypes.STRING(20), allowNull: true },
  quantity: {
    type: DataTypes.DECIMAL(14, 3),
    allowNull: false,
    defaultValue: 1,
  },
  measurementBasis: {
    type: DataTypes.STRING(40),
    allowNull: true,
    comment: 'Chargeable Weight, W/M, Container, Per Shipment, ...',
  },
  containerType: { type: DataTypes.STRING(40), allowNull: true },
  chargeableWeight: { type: DataTypes.DECIMAL(14, 3), allowNull: true },

  // --- buy side -------------------------------------------------------------
  costCurrency: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'AED' },
  costConversionRate: { type: DataTypes.DECIMAL(16, 6), allowNull: true, defaultValue: 1 },
  costAmountRate: { type: DataTypes.DECIMAL(16, 4), allowNull: true, defaultValue: 0 },
  creditorPartnerId: { type: DataTypes.UUID, allowNull: true, comment: 'Vendor the cost is owed to' },
  creditorAddressId: { type: DataTypes.UUID, allowNull: true },
  costRemarks: { type: DataTypes.TEXT, allowNull: true },
  supplierTaxes: { type: DataTypes.JSON, allowNull: true },

  // --- sell side ------------------------------------------------------------
  sellCurrency: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'AED' },
  sellConversionRate: { type: DataTypes.DECIMAL(16, 6), allowNull: true, defaultValue: 1 },
  sellAmountRate: { type: DataTypes.DECIMAL(16, 4), allowNull: true, defaultValue: 0 },
  debtorPartnerId: { type: DataTypes.UUID, allowNull: true, comment: 'Customer the revenue is billed to' },
  debtorAddressId: { type: DataTypes.UUID, allowNull: true },
  sellRemarks: { type: DataTypes.TEXT, allowNull: true },
  taxes: { type: DataTypes.JSON, allowNull: true },

  // --- margin control ------------------------------------------------------
  useMargin: { type: DataTypes.BOOLEAN, defaultValue: false },
  marginType: { type: DataTypes.ENUM('amount', 'percentage'), allowNull: true },
  marginPercentage: { type: DataTypes.DECIMAL(9, 4), allowNull: true, defaultValue: 0 },
  marginAmount: { type: DataTypes.DECIMAL(16, 4), allowNull: true, defaultValue: 0 },

  // --- computed totals (persisted so list views and reports can sort) ------
  totalCostAmount: { type: DataTypes.DECIMAL(16, 4), allowNull: true, defaultValue: 0 },
  totalCostAmountIncl: { type: DataTypes.DECIMAL(16, 4), allowNull: true, defaultValue: 0 },
  totalSellAmount: { type: DataTypes.DECIMAL(16, 4), allowNull: true, defaultValue: 0 },
  totalSellAmountIncl: { type: DataTypes.DECIMAL(16, 4), allowNull: true, defaultValue: 0 },
  estimatedMargin: { type: DataTypes.DECIMAL(16, 4), allowNull: true, defaultValue: 0 },
  estimatedMarginPercentage: { type: DataTypes.DECIMAL(9, 4), allowNull: true, defaultValue: 0 },
  companyCurrencyAmount: { type: DataTypes.DECIMAL(16, 4), allowNull: true, defaultValue: 0 },

  // --- billing progress ----------------------------------------------------
  billedAmount: { type: DataTypes.DECIMAL(16, 4), allowNull: true, defaultValue: 0 },
  invoicedAmount: { type: DataTypes.DECIMAL(16, 4), allowNull: true, defaultValue: 0 },
  receivedAmount: { type: DataTypes.DECIMAL(16, 4), allowNull: true, defaultValue: 0 },
  residualAmount: { type: DataTypes.DECIMAL(16, 4), allowNull: true, defaultValue: 0 },
  creditNoteAmount: { type: DataTypes.DECIMAL(16, 4), allowNull: true, defaultValue: 0 },
  creditNoteQty: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
  billingStatus: {
    type: DataTypes.ENUM('no', 'partial', 'fully_billed', 'fully_invoiced', 'pro_forma', 'pro_forma_cancel'),
    allowNull: false,
    defaultValue: 'no',
  },
  dueBy: { type: DataTypes.ENUM('agent', 'carrier'), allowNull: true },
  chargeType: {
    type: DataTypes.ENUM('ppx', 'ccx', 'other'),
    allowNull: true,
    comment: 'Prepaid / collect / other, as printed on the AWB',
  },
  propertyAccountId: { type: DataTypes.UUID, allowNull: true },

  // --- links ---------------------------------------------------------------
  quoteLineId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'The quote line this shipment/job charge was created from',
  },
  pairLineId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'The opposite side of the same charge (cost <-> revenue)',
  },
  multimodalLineId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'The quote leg this charge belongs to',
  },
  rateRequestLineId: { type: DataTypes.UUID, allowNull: true },
  buyTariffLineId: { type: DataTypes.UUID, allowNull: true },
  sellTariffLineId: { type: DataTypes.UUID, allowNull: true },
  invoiceId: { type: DataTypes.UUID, allowNull: true },
  invoiceItemId: { type: DataTypes.UUID, allowNull: true },
  masterChargeLineId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Master shipment charge this house charge rolls up to',
  },
  partBlId: { type: DataTypes.UUID, allowNull: true },

  // --- per-charge routing (a multimodal quote prices each leg separately) ---
  transportMode: {
    type: DataTypes.ENUM('AIR', 'SEA', 'ROAD', 'RAIL', 'COURIER'),
    allowNull: true,
  },
  modeTypeSequence: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Leg order within a multimodal quote (1-4)',
  },
  originCountry: { type: DataTypes.STRING(100), allowNull: true },
  destinationCountry: { type: DataTypes.STRING(100), allowNull: true },
  originPortId: { type: DataTypes.UUID, allowNull: true },
  destinationPortId: { type: DataTypes.UUID, allowNull: true },
  pickupLocation: { type: DataTypes.STRING(200), allowNull: true },
  deliveryLocation: { type: DataTypes.STRING(200), allowNull: true },

  // --- multi-carrier comparison --------------------------------------------
  carrierId: { type: DataTypes.UUID, allowNull: true },
  incotermId: { type: DataTypes.UUID, allowNull: true },
  carrierServiceType: { type: DataTypes.STRING(80), allowNull: true },
  transitTime: { type: DataTypes.INTEGER, allowNull: true },
  multiCarrierQuote: { type: DataTypes.BOOLEAN, defaultValue: false },
  multiCarrierComboName: { type: DataTypes.STRING(150), allowNull: true },
  selected: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Chosen option when several carriers were quoted',
  },

  // --- grouping ------------------------------------------------------------
  groupSimilarCharge: { type: DataTypes.BOOLEAN, defaultValue: false },
  isGrouped: { type: DataTypes.BOOLEAN, defaultValue: false },
  shipmentGroupName: { type: DataTypes.STRING(150), allowNull: true },
  shipmentGroupSequence: { type: DataTypes.INTEGER, allowNull: true },
  includeCharges: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Fold into the all-inclusive rate instead of printing separately',
  },

  // --- provenance ----------------------------------------------------------
  chargeSource: {
    type: DataTypes.ENUM('erp', 'vendor_portal', 'tariff', 'ocr'),
    allowNull: false,
    defaultValue: 'erp',
  },
  fromVendorInvoice: { type: DataTypes.BOOLEAN, defaultValue: false },

  companyId: { type: DataTypes.UUID, allowNull: true },
  currency: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'AED' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'charge_lines',
  indexes: [
    { fields: ['parentType', 'parentId'] },
    { fields: ['side'] },
    { fields: ['quoteLineId'] },
    { fields: ['multimodalLineId'] },
    { fields: ['billingStatus'] },
  ],
});

module.exports = ChargeLine;
