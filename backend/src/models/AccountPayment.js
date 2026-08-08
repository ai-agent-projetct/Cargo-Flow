const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Accounting > Customers/Vendors > Payments — mirrors account.payment.
// `paymentType` splits the same table between the customer and vendor menus.
const AccountPayment = sequelize.define('AccountPayment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  // '/' while draft, then ADCB/2026/01/0018, BNK1/2026/0001, CSH1/2025/11/0006…
  name: { type: DataTypes.STRING(60), allowNull: false, defaultValue: '/' },
  paymentType: { type: DataTypes.ENUM('inbound', 'outbound'), defaultValue: 'inbound' },
  paymentDate: { type: DataTypes.DATEONLY, allowNull: true },

  journal: { type: DataTypes.STRING(120), allowNull: true },
  journalId: { type: DataTypes.UUID, allowNull: true },
  paymentMethod: { type: DataTypes.STRING(40), defaultValue: 'Manual' },

  partner: { type: DataTypes.STRING(250), allowNull: true },
  partnerId: { type: DataTypes.UUID, allowNull: true },
  // A payment can settle several invoices; the list shows them comma-joined.
  invoiceNumbers: { type: DataTypes.JSON, defaultValue: [] },

  amount: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  currency: { type: DataTypes.STRING(10), defaultValue: 'AED' },
  state: { type: DataTypes.ENUM('draft', 'posted', 'sent', 'reconciled', 'cancel'), defaultValue: 'draft' },
  memo: { type: DataTypes.STRING(250), allowNull: true },

  company: { type: DataTypes.STRING(120), allowNull: true },
  activityLog: { type: DataTypes.JSON, defaultValue: [] },
  followerCount: { type: DataTypes.INTEGER, defaultValue: 1 },
  createdBy: { type: DataTypes.UUID, allowNull: true },
}, {
  tableName: 'account_payments',
  indexes: [{ fields: ['paymentType'] }, { fields: ['state'] }],
});

AccountPayment.prototype.availableActions = function availableActions() {
  return {
    edit: this.state === 'draft',
    confirm: this.state === 'draft',
    cancel: ['draft', 'posted'].includes(this.state),
    resetToDraft: ['cancel', 'posted'].includes(this.state),
  };
};

module.exports = AccountPayment;
