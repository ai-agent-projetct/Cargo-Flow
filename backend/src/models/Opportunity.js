const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Opportunity = sequelize.define('Opportunity', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  customerId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  contactName: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  contactEmail: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  contactPhone: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  companyId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  stage: {
    type: DataTypes.ENUM('new', 'qualified', 'proposition', 'negotiation', 'won', 'lost'),
    defaultValue: 'new',
  },
  transportMode: {
    type: DataTypes.ENUM('SEA', 'AIR', 'ROAD', 'RAIL', 'MULTIMODAL'),
    defaultValue: 'SEA',
  },
  direction: {
    type: DataTypes.ENUM('EXPORT', 'IMPORT', 'LOCAL'),
    defaultValue: 'EXPORT',
  },
  origin: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  destination: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  estimatedRevenue: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
  },
  probability: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
    comment: 'Probability in percent (0-100)',
  },
  expectedCloseDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  priority: {
    type: DataTypes.ENUM('low', 'normal', 'high'),
    defaultValue: 'normal',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  assignedTo: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  lostReason: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  wonDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },

  // --- CRM funnel ----------------------------------------------------------
  // `stage` above is the original fixed enum; `stageId` points at a
  // configurable CrmStage row, which is what gates quote creation. Both are
  // kept so existing screens and reports that read `stage` keep working.
  stageId: { type: DataTypes.UUID, allowNull: true },
  leadId: { type: DataTypes.UUID, allowNull: true },
  prospectId: { type: DataTypes.UUID, allowNull: true },
  salesTeamId: { type: DataTypes.UUID, allowNull: true },
  pricingTeamId: { type: DataTypes.UUID, allowNull: true },
  isCreateFromLead: { type: DataTypes.BOOLEAN, defaultValue: false },
  opportunityType: { type: DataTypes.ENUM('new', 'existing'), allowNull: true },
  opportunityFor: { type: DataTypes.ENUM('shipment', 'job'), allowNull: true },
  opportunitySource: { type: DataTypes.ENUM('online', 'offline'), allowNull: true },
  customerType: { type: DataTypes.ENUM('consignor', 'consignee', 'agent'), allowNull: true },
  roadCustomerType: {
    type: DataTypes.ENUM('sending_forwarder', 'receiving_forwarder'),
    allowNull: true,
  },
  clientTag: { type: DataTypes.STRING(80), allowNull: true },
  contactDesignation: { type: DataTypes.STRING(120), allowNull: true },
  contactDepartment: { type: DataTypes.STRING(120), allowNull: true },

  // --- the enquiry detail --------------------------------------------------
  shipmentType: { type: DataTypes.STRING(30), allowNull: true },
  cargoType: { type: DataTypes.STRING(30), allowNull: true },
  cargoDescription: { type: DataTypes.TEXT, allowNull: true },
  cargoStatus: {
    type: DataTypes.ENUM('ready', 'later'),
    allowNull: true,
    comment: 'Is the cargo ready now or expected later',
  },
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
  packageLines: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
  containerLines: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
  customerVisits: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Array of { date, visitedBy, purpose, outcome, nextAction }',
  },
  additionalServices: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
  transitDays: { type: DataTypes.INTEGER, allowNull: true },

  // --- buy-side pricing ----------------------------------------------------
  agentId: { type: DataTypes.UUID, allowNull: true },
  agentIds: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Vendors a rate request went out to',
  },
  rateApproverId: { type: DataTypes.UUID, allowNull: true },
  rateRequestEmailSent: { type: DataTypes.BOOLEAN, defaultValue: false },
  rateRequestApproved: { type: DataTypes.BOOLEAN, defaultValue: false },
  pricingApproval: { type: DataTypes.BOOLEAN, defaultValue: false },
  currentRateRequestId: { type: DataTypes.UUID, allowNull: true },
  accessToken: { type: DataTypes.STRING(64), allowNull: true },
}, {
  tableName: 'opportunities',
  timestamps: true,
  indexes: [
    { fields: ['stageId'] },
    { fields: ['leadId'] },
    { fields: ['prospectId'] },
    { fields: ['salesTeamId'] },
  ],
});

// Which buttons the UI may show. Re-checked server side, so a stale form
// cannot raise a quote from a stage that does not allow it.
Opportunity.prototype.availableActions = function availableActions(stage) {
  const closed = this.stage === 'won' || this.stage === 'lost';
  return {
    edit: !closed,
    setStage: !closed,
    createQuote: !closed && !!(stage && stage.allowQuoteCreation),
    requestVendorRates: !closed,
    recordVisit: !closed,
    markWon: !closed,
    markLost: !closed,
    reopen: closed,
  };
};

module.exports = Opportunity;
