const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// "Accounting > Dashboard" — mirrors account.journal.
//
// The journal `type` decides which card the dashboard renders and which actions
// it offers, so it is the single most important field here:
//   sale     → New Invoice / Upload, invoice counters + 6-bucket ageing bar
//   purchase → Upload / Create Manually, bill counters + ageing bar
//   bank     → Reconcile N Items *or* Connect, GL/outstanding/statement balances
//   cash     → New Transaction, GL + outstanding balances
//   general  → New Entry only
const AccountJournal = sequelize.define('AccountJournal', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING(120), allowNull: false },
  code: { type: DataTypes.STRING(20), allowNull: true },
  type: {
    type: DataTypes.ENUM('sale', 'purchase', 'bank', 'cash', 'general'),
    allowNull: false,
  },
  currency: { type: DataTypes.STRING(10), defaultValue: 'AED' },
  bankAccNumber: { type: DataTypes.STRING(60), allowNull: true },
  // Left border colour on the dashboard card.
  colour: { type: DataTypes.STRING(20), allowNull: true },
  sequence: { type: DataTypes.INTEGER, defaultValue: 10 },

  // Balances shown on bank/cash cards.
  balanceGl: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  outstandingAmount: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
  latestStatement: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
  // Bank cards show "Reconcile N Items" when there is anything to reconcile,
  // and "Connect" when the journal has never been linked to a feed.
  toReconcile: { type: DataTypes.INTEGER, defaultValue: 0 },
  isConnected: { type: DataTypes.BOOLEAN, defaultValue: false },

  // Sale/purchase counters. Stored so the dashboard matches the demo's figures
  // even before the invoice tables are populated; recomputed once moves exist.
  toValidateCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  toValidateAmount: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  unpaidCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  unpaidAmount: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  lateCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  lateAmount: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  toCheckCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  toCheckAmount: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },

  // Six ageing buckets under sale/purchase cards, and the bank sparkline.
  ageingBuckets: { type: DataTypes.JSON, defaultValue: [] },
  sparkline: { type: DataTypes.JSON, defaultValue: [] },

  companyId: { type: DataTypes.UUID, allowNull: true },
  company: { type: DataTypes.STRING(120), allowNull: true },
  active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'account_journals',
  indexes: [{ fields: ['type'] }, { fields: ['companyId'] }],
});

// Which actions the dashboard card offers, mirroring the demo's kanban.
AccountJournal.prototype.cardActions = function cardActions() {
  const t = this.type;
  return {
    newInvoice: t === 'sale',
    upload: t === 'sale' || t === 'purchase',
    createManually: t === 'sale' || t === 'purchase',
    newEntry: t === 'general',
    // A cash journal with items to reconcile puts Reconcile in the primary
    // slot and drops New Transaction to a secondary link, as the demo does.
    newTransaction: t === 'cash' && (this.toReconcile || 0) === 0,
    newTransactionLink: t === 'cash' && (this.toReconcile || 0) > 0,
    reconcile: (t === 'bank' || t === 'cash') && (this.toReconcile || 0) > 0,
    connect: t === 'bank' && !this.isConnected && (this.toReconcile || 0) === 0,
    // Only bank journals offer statement import.
    importStatements: t === 'bank',
    // Only sale/purchase cards carry the counter links + ageing bar.
    showCounters: t === 'sale' || t === 'purchase',
    showBalances: t === 'bank' || t === 'cash',
  };
};

module.exports = AccountJournal;
