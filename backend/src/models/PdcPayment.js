const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Post-dated cheque (upstream: pdc.payment).
//
// A PDC is a cheque held until its own payment date, so it must not hit the
// bank ledger when it is received. The lifecycle is
// registered -> deposited -> done, with returned and bounced as the failure
// exits. Only `done` corresponds to cleared funds, which is what keeps a
// drawer full of post-dated cheques out of the cash position.
const PdcPayment = sequelize.define('PdcPayment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(40),
    allowNull: false,
    unique: true,
    comment: 'PDC reference, e.g. PDC/2026/00001',
  },
  chequeRef: {
    type: DataTypes.STRING(60),
    allowNull: true,
    comment: 'Cheque number as printed',
  },
  paymentType: {
    type: DataTypes.ENUM('inbound', 'outbound'),
    allowNull: false,
    defaultValue: 'inbound',
    comment: 'inbound = received from a customer, outbound = issued to a vendor',
  },
  partnerId: { type: DataTypes.UUID, allowNull: true },
  journalId: { type: DataTypes.UUID, allowNull: false },
  bankName: { type: DataTypes.STRING(150), allowNull: true },

  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Date the cheque was received or issued',
  },
  paymentDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'Date written on the cheque - not bankable before this',
  },
  clearingDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Date the bank actually cleared it',
  },

  amount: {
    type: DataTypes.DECIMAL(16, 2),
    allowNull: false,
    defaultValue: 0,
    validate: { min: 0 },
  },
  currency: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'AED' },
  companyCurrency: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'AED' },
  conversionRate: { type: DataTypes.DECIMAL(16, 6), allowNull: true, defaultValue: 1 },

  state: {
    type: DataTypes.ENUM('registered', 'deposited', 'done', 'returned', 'bounced'),
    allowNull: false,
    defaultValue: 'registered',
  },

  // --- links ---------------------------------------------------------------
  paymentId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'AccountPayment created when the cheque cleared',
  },
  moveIds: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Invoices / bills this cheque settles',
  },
  isReconciled: { type: DataTypes.BOOLEAN, defaultValue: false },
  bounceCharge: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: true,
    defaultValue: 0,
    comment: 'Bank charge recovered when a cheque bounces',
  },
  bounceReason: { type: DataTypes.STRING(250), allowNull: true },

  memo: { type: DataTypes.STRING(250), allowNull: true },
  companyId: { type: DataTypes.UUID, allowNull: true },
  createdBy: { type: DataTypes.UUID, allowNull: true },
}, {
  tableName: 'pdc_payments',
  indexes: [
    { fields: ['state'] },
    { fields: ['paymentDate'] },
    { fields: ['partnerId'] },
  ],
  validate: {
    chequeDateNotBeforeReceipt() {
      if (this.date && this.paymentDate && this.paymentDate < this.date) {
        throw new Error('Cheque date cannot be before the date it was received');
      }
    },
  },
});

// Encoded once here and re-checked in the controller, so a stale screen cannot
// deposit a cheque twice or clear one that bounced.
PdcPayment.prototype.availableActions = function availableActions() {
  const s = this.state;
  return {
    deposit: s === 'registered',
    markCleared: s === 'deposited',
    markBounced: s === 'deposited',
    markReturned: s === 'registered' || s === 'deposited',
    reopen: s === 'returned' || s === 'bounced',
    cancel: s === 'registered',
  };
};

module.exports = PdcPayment;
