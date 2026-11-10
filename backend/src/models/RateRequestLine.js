const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// One charge a vendor was asked to price, and the rate they came back with
// (upstream: rate.request.line).
//
// `buyRate` is the vendor's figure in their own currency; `convertedBuyRate`
// is the same figure in the request currency so options from vendors quoting
// in USD and EUR can be compared on one screen. `counterRate` holds our
// counter-offer during renegotiation, which keeps the vendor's original
// number intact for the audit trail.
const RateRequestLine = sequelize.define('RateRequestLine', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  rateRequestId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  sequence: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 },

  // --- what is being priced -------------------------------------------------
  productId: { type: DataTypes.UUID, allowNull: true },
  chargeCode: { type: DataTypes.STRING(30), allowNull: true },
  chargeDescription: { type: DataTypes.STRING(250), allowNull: true },
  measurementBasis: { type: DataTypes.STRING(40), allowNull: true },
  containerType: { type: DataTypes.STRING(40), allowNull: true },
  uom: { type: DataTypes.STRING(20), allowNull: true },
  quantity: {
    type: DataTypes.DECIMAL(14, 3),
    allowNull: false,
    defaultValue: 1,
  },

  // --- the vendor's answer --------------------------------------------------
  currency: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'AED' },
  buyRate: { type: DataTypes.DECIMAL(16, 4), allowNull: true, defaultValue: 0 },
  minAmount: {
    type: DataTypes.DECIMAL(16, 4),
    allowNull: true,
    defaultValue: 0,
    comment: 'Minimum charge; the line total never falls below this',
  },
  targetCurrency: { type: DataTypes.STRING(10), allowNull: true },
  exchangeRate: { type: DataTypes.DECIMAL(16, 6), allowNull: true, defaultValue: 1 },
  convertedBuyRate: { type: DataTypes.DECIMAL(16, 4), allowNull: true, defaultValue: 0 },
  lineTotal: { type: DataTypes.DECIMAL(16, 4), allowNull: true, defaultValue: 0 },

  transitDays: { type: DataTypes.INTEGER, allowNull: true },
  validFrom: { type: DataTypes.DATEONLY, allowNull: true },
  validTo: { type: DataTypes.DATEONLY, allowNull: true },

  // --- renegotiation --------------------------------------------------------
  counterRate: {
    type: DataTypes.DECIMAL(16, 4),
    allowNull: true,
    comment: 'Our counter-offer; leaves buyRate as the vendor submitted it',
  },
  isCounterLine: { type: DataTypes.BOOLEAN, defaultValue: false },

  // --- provenance -----------------------------------------------------------
  rateReceivedBy: {
    type: DataTypes.ENUM('email', 'manual', 'portal'),
    allowNull: false,
    defaultValue: 'portal',
  },
  source: {
    type: DataTypes.ENUM('ocr', 'edited', 'manual', 'portal'),
    allowNull: false,
    defaultValue: 'manual',
  },
  sourceFile: { type: DataTypes.STRING(250), allowNull: true },
  checkStatus: {
    type: DataTypes.ENUM('ok', 'high', 'low', 'unmapped'),
    allowNull: true,
    comment: 'Sanity flag vs the last known rate for this lane and charge',
  },
  rateAgentId: { type: DataTypes.UUID, allowNull: true },
  rateVendorGroupName: { type: DataTypes.STRING(150), allowNull: true },
  rateSubmittedOn: { type: DataTypes.DATE, allowNull: true },

  sourceQuoteLineId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Quote charge line this request line was raised from',
  },
  appliedChargeLineId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Charge line created on the quote once this rate was selected',
  },

  remarks: { type: DataTypes.STRING(250), allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'rate_request_lines',
  indexes: [
    { fields: ['rateRequestId'] },
    { fields: ['sourceQuoteLineId'] },
  ],
});

module.exports = RateRequestLine;
