const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A trade enquiry against a prospect (upstream: crm.prospect.lead).
//
// This is the first record in the whole chain - everything the QA plan calls
// "Enquiry" starts here. A lead carries the lane, the commodity and the
// expected annual volume, which is what the sales target reports measure
// against. Once its stage allows it, `convertToOpportunity` promotes it.
const Lead = sequelize.define('Lead', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  leadNumber: {
    type: DataTypes.STRING(40),
    allowNull: true,
    unique: true,
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: { notEmpty: true },
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  prospectId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  stageId: { type: DataTypes.UUID, allowNull: true },

  // --- contact snapshot (a lead can name a different contact) --------------
  contactName: { type: DataTypes.STRING(150), allowNull: true },
  designation: { type: DataTypes.STRING(120), allowNull: true },
  department: { type: DataTypes.STRING(120), allowNull: true },
  email: { type: DataTypes.STRING(150), allowNull: true },
  phone: { type: DataTypes.STRING(40), allowNull: true },
  mobile: { type: DataTypes.STRING(40), allowNull: true },
  street: { type: DataTypes.STRING(200), allowNull: true },
  street2: { type: DataTypes.STRING(200), allowNull: true },
  city: { type: DataTypes.STRING(120), allowNull: true },
  state: { type: DataTypes.STRING(120), allowNull: true },
  country: { type: DataTypes.STRING(100), allowNull: true },
  zip: { type: DataTypes.STRING(20), allowNull: true },

  // --- where it came from --------------------------------------------------
  leadSource: {
    type: DataTypes.ENUM('db', 'social', 'customer_ref', 'trade_show', 'inbound', 'other'),
    allowNull: true,
  },
  leadSourceId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'MasterDataItem row, category lead-source',
  },
  leadCategory: {
    type: DataTypes.ENUM('hot', 'warm', 'cold'),
    allowNull: true,
  },

  // --- the lane being enquired about ---------------------------------------
  transportMode: {
    type: DataTypes.ENUM('AIR', 'SEA', 'ROAD', 'RAIL', 'COURIER', 'MULTIMODAL'),
    allowNull: true,
  },
  shipmentType: { type: DataTypes.STRING(30), allowNull: true },
  direction: { type: DataTypes.ENUM('EXPORT', 'IMPORT', 'LOCAL', 'CROSS_TRADE'), allowNull: true },
  originCountry: { type: DataTypes.STRING(100), allowNull: true },
  destinationCountry: { type: DataTypes.STRING(100), allowNull: true },
  portOfLoadingId: { type: DataTypes.UUID, allowNull: true },
  portOfDischargeId: { type: DataTypes.UUID, allowNull: true },
  pickupCountry: { type: DataTypes.STRING(100), allowNull: true },
  pickupLocationType: { type: DataTypes.STRING(60), allowNull: true },
  pickupLocation: { type: DataTypes.STRING(200), allowNull: true },
  deliveryCountry: { type: DataTypes.STRING(100), allowNull: true },
  deliveryLocationType: { type: DataTypes.STRING(60), allowNull: true },
  deliveryLocation: { type: DataTypes.STRING(200), allowNull: true },
  commodity: { type: DataTypes.STRING(200), allowNull: true },
  businessService: { type: DataTypes.STRING(150), allowNull: true },

  // --- the prize -----------------------------------------------------------
  expectedAnnualRevenue: { type: DataTypes.DECIMAL(16, 2), allowNull: true, defaultValue: 0 },
  annualRevenueCurrency: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'AED' },
  expectedAnnualVolume: { type: DataTypes.DECIMAL(16, 3), allowNull: true, defaultValue: 0 },
  volumeUom: { type: DataTypes.STRING(20), allowNull: true },
  targetDate: { type: DataTypes.DATEONLY, allowNull: true },
  natureOfBusiness: { type: DataTypes.STRING(200), allowNull: true },
  companyTurnover: { type: DataTypes.DECIMAL(16, 2), allowNull: true },
  turnoverCurrency: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'AED' },

  // --- ownership -----------------------------------------------------------
  assignedTo: { type: DataTypes.UUID, allowNull: true },
  salesTeamId: { type: DataTypes.UUID, allowNull: true },
  salesTargetId: { type: DataTypes.UUID, allowNull: true },
  createdBy: { type: DataTypes.UUID, allowNull: true },
  companyId: { type: DataTypes.UUID, allowNull: true },

  // --- outcome -------------------------------------------------------------
  status: {
    type: DataTypes.ENUM('open', 'converted', 'lost'),
    allowNull: false,
    defaultValue: 'open',
  },
  opportunityId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Opportunity this lead was converted into',
  },
  convertedAt: { type: DataTypes.DATE, allowNull: true },
  lostReason: { type: DataTypes.STRING(250), allowNull: true },

  remarks: { type: DataTypes.TEXT, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'leads',
  indexes: [
    { fields: ['prospectId'] },
    { fields: ['stageId'] },
    { fields: ['status'] },
    { fields: ['assignedTo'] },
  ],
  hooks: {
    beforeValidate: (rec) => {
      if (rec.email) rec.email = String(rec.email).trim().toLowerCase();
    },
  },
});

module.exports = Lead;
