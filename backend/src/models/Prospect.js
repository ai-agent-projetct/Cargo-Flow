const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A company that is not yet a customer (upstream: crm.prospect).
//
// The funnel is Prospect -> Lead -> Opportunity -> Quote -> Shipment. A
// prospect holds the company and its contact; the leads hanging off it hold
// the trade enquiries. `relatedPartnerId` is set once the prospect is
// converted, which is what stops the same company being both a prospect and
// an organization with no link between them.
const Prospect = sequelize.define('Prospect', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  prospectNumber: {
    type: DataTypes.STRING(40),
    allowNull: true,
    unique: true,
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: { notEmpty: true },
  },

  // --- address -------------------------------------------------------------
  street1: { type: DataTypes.STRING(200), allowNull: true },
  street2: { type: DataTypes.STRING(200), allowNull: true },
  city: { type: DataTypes.STRING(120), allowNull: true },
  state: { type: DataTypes.STRING(120), allowNull: true },
  country: { type: DataTypes.STRING(100), allowNull: true },
  zip: { type: DataTypes.STRING(20), allowNull: true },

  // --- contact -------------------------------------------------------------
  contactName: { type: DataTypes.STRING(150), allowNull: true },
  designation: { type: DataTypes.STRING(120), allowNull: true },
  department: { type: DataTypes.STRING(120), allowNull: true },
  email: {
    type: DataTypes.STRING(150),
    allowNull: true,
    validate: { isEmailOrBlank(v) { if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new Error('Invalid email'); } },
  },
  phone: { type: DataTypes.STRING(40), allowNull: true },
  mobile: { type: DataTypes.STRING(40), allowNull: true },
  website: { type: DataTypes.STRING(200), allowNull: true },

  // --- classification ------------------------------------------------------
  partyTypes: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Party types this prospect would be: Customer, Shipper, Consignee, Agent, ...',
  },
  industry: { type: DataTypes.STRING(120), allowNull: true },
  natureOfBusiness: { type: DataTypes.STRING(200), allowNull: true },
  companyTurnover: { type: DataTypes.DECIMAL(16, 2), allowNull: true },
  turnoverCurrency: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'AED' },
  clientTag: { type: DataTypes.STRING(80), allowNull: true },

  relatedPartnerId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'The Organization this prospect became once converted',
  },
  convertedAt: { type: DataTypes.DATE, allowNull: true },

  assignedTo: { type: DataTypes.UUID, allowNull: true },
  salesTeamId: { type: DataTypes.UUID, allowNull: true },
  createdBy: { type: DataTypes.UUID, allowNull: true },
  companyId: { type: DataTypes.UUID, allowNull: true },
  remarks: { type: DataTypes.TEXT, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'prospects',
  indexes: [{ fields: ['name'] }, { fields: ['relatedPartnerId'] }],
  hooks: {
    beforeValidate: (rec) => {
      if (rec.email) rec.email = String(rec.email).trim().toLowerCase();
    },
  },
});

module.exports = Prospect;
