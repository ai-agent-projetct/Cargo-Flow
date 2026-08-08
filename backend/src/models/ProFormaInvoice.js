const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Accounting > Customers > Pro Forma Invoice — mirrors pro.forma.invoice.
// A pro forma is raised against a shipment, approved, then turned into a real
// invoice; `state` drives which of those buttons the form offers.
const ProFormaInvoice = sequelize.define('ProFormaInvoice', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING(40), allowNull: false, comment: 'PRO/2026/00253' },

  customer: { type: DataTypes.STRING(250), allowNull: true },
  customerId: { type: DataTypes.UUID, allowNull: true },

  serviceJobRefs: { type: DataTypes.JSON, defaultValue: [] },
  houseShipmentRefs: { type: DataTypes.JSON, defaultValue: [] },

  companyCurrency: { type: DataTypes.STRING(10), defaultValue: 'AED' },
  currency: { type: DataTypes.STRING(10), defaultValue: 'AED' },
  taxes: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  total: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },

  state: {
    type: DataTypes.ENUM('to_approve', 'approved', 'invoiced', 'cancel'),
    defaultValue: 'to_approve',
  },
  // Set once "Create Invoice" has produced the real account.move.
  invoiceId: { type: DataTypes.UUID, allowNull: true },
  invoiceName: { type: DataTypes.STRING(60), allowNull: true },

  lines: { type: DataTypes.JSON, defaultValue: [] },
  company: { type: DataTypes.STRING(120), allowNull: true },
  activityLog: { type: DataTypes.JSON, defaultValue: [] },
  followerCount: { type: DataTypes.INTEGER, defaultValue: 1 },
  createdBy: { type: DataTypes.UUID, allowNull: true },
}, {
  tableName: 'pro_forma_invoices',
  indexes: [{ fields: ['state'] }],
});

ProFormaInvoice.prototype.availableActions = function availableActions() {
  return {
    edit: this.state === 'to_approve',
    approve: this.state === 'to_approve',
    // Only an approved pro forma can become an invoice, and only once.
    createInvoice: this.state === 'approved' && !this.invoiceId,
    cancel: ['to_approve', 'approved'].includes(this.state),
    resetToDraft: this.state === 'cancel',
    openInvoice: !!this.invoiceId,
  };
};

module.exports = ProFormaInvoice;
