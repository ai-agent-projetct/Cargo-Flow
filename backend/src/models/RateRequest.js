const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A request to a vendor or agent to quote buy rates (upstream: rate.request).
//
// This is the buy-side half of pricing. Sales raises a rate request from an
// opportunity or a quote, it is sent to one or more vendors, each vendor fills
// in their rates through the vendor portal, and the winning lines are pulled
// back onto the quote's charge lines with `chargeSource = 'vendor_portal'`.
//
// `accessToken` is what lets a vendor open their own request without an ERP
// login. It is generated per request, so revoking one vendor's link does not
// affect another's.
const RateRequest = sequelize.define('RateRequest', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  requestNumber: {
    type: DataTypes.STRING(40),
    allowNull: false,
    unique: true,
  },
  quoteOptionName: {
    type: DataTypes.STRING(120),
    allowNull: true,
    comment: 'Label when several vendors are compared side by side',
  },

  // --- who is being asked --------------------------------------------------
  agentId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Vendor / agent organization the request went to',
  },
  email: { type: DataTypes.STRING(150), allowNull: true },
  rateRequestTo: {
    type: DataTypes.ENUM('vendor', 'agent', 'carrier'),
    allowNull: false,
    defaultValue: 'vendor',
  },

  // --- what it is for ------------------------------------------------------
  opportunityId: { type: DataTypes.UUID, allowNull: true },
  quotationId: { type: DataTypes.UUID, allowNull: true },
  quoteLegId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Specific multimodal leg being priced, when the quote has legs',
  },

  requestDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  validityDate: { type: DataTypes.DATEONLY, allowNull: true },
  requestedBy: { type: DataTypes.UUID, allowNull: true },
  submittedOn: { type: DataTypes.DATE, allowNull: true },

  // --- state ---------------------------------------------------------------
  status: {
    type: DataTypes.ENUM('draft', 'sent', 'done', 'cancel', 'renegotiate'),
    allowNull: false,
    defaultValue: 'draft',
  },
  vendorRateStatus: {
    type: DataTypes.ENUM(
      'pending',
      'submitted',
      'renegotiate_pending',
      'renegotiate_submitted',
      'renegotiate_rejected',
    ),
    allowNull: false,
    defaultValue: 'pending',
  },
  isRenegotiate: { type: DataTypes.BOOLEAN, defaultValue: false },
  renegotiateStatus: {
    type: DataTypes.ENUM('pending', 'accepted', 'rejected'),
    allowNull: true,
  },
  renegotiateNote: { type: DataTypes.TEXT, allowNull: true },

  isRateSelected: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'This vendor won and their lines were copied onto the quote',
  },
  selectedAt: { type: DataTypes.DATE, allowNull: true },

  // --- totals --------------------------------------------------------------
  currency: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'AED' },
  rateTotal: { type: DataTypes.DECIMAL(16, 2), allowNull: true, defaultValue: 0 },
  rateTotalWords: { type: DataTypes.STRING(300), allowNull: true },
  transitDays: { type: DataTypes.INTEGER, allowNull: true },

  // --- portal access -------------------------------------------------------
  accessToken: {
    type: DataTypes.STRING(64),
    allowNull: true,
    unique: true,
    comment: 'Per-request token the vendor portal link carries',
  },
  tokenExpiresAt: { type: DataTypes.DATE, allowNull: true },
  emailSentAt: { type: DataTypes.DATE, allowNull: true },

  ocrResponse: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
    comment: 'Raw extraction when rates arrived as an emailed rate sheet',
  },
  remarks: { type: DataTypes.TEXT, allowNull: true },
  companyId: { type: DataTypes.UUID, allowNull: true },
  createdBy: { type: DataTypes.UUID, allowNull: true },
}, {
  tableName: 'rate_requests',
  indexes: [
    { fields: ['quotationId'] },
    { fields: ['opportunityId'] },
    { fields: ['agentId'] },
    { fields: ['vendorRateStatus'] },
  ],
});

// Which buttons the UI may show, re-checked server side so a stale form
// cannot force an illegal transition.
RateRequest.prototype.availableActions = function availableActions() {
  const s = this.status;
  const v = this.vendorRateStatus;
  return {
    send: s === 'draft',
    resend: s === 'sent' && v === 'pending',
    submitRates: s === 'sent' && (v === 'pending' || v === 'renegotiate_pending'),
    requestRenegotiation: v === 'submitted' && !this.isRateSelected,
    acceptRenegotiation: v === 'renegotiate_submitted',
    rejectRenegotiation: v === 'renegotiate_submitted',
    selectRates: v === 'submitted' || v === 'renegotiate_submitted',
    cancel: s !== 'cancel' && s !== 'done',
  };
};

module.exports = RateRequest;
