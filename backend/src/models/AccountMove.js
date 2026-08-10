const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Mirrors account.move — the single model behind Invoices, Credit Notes,
// Debit Notes, Bills, Refunds, Vendor Debit Notes and Journal Entries.
// `moveType` is the discriminator that decides which menu a record appears
// under, what its sequence prefix is, and which buttons the form offers.
const AccountMove = sequelize.define('AccountMove', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },

  // '/' until posted, then the journal sequence assigns INV/2026/00030 etc.
  name: { type: DataTypes.STRING(60), allowNull: false, defaultValue: '/' },
  moveType: {
    type: DataTypes.ENUM(
      'entry', 'out_invoice', 'out_refund', 'out_debit',
      'in_invoice', 'in_refund', 'in_debit',
    ),
    allowNull: false,
    defaultValue: 'out_invoice',
  },
  state: { type: DataTypes.ENUM('draft', 'posted', 'cancel'), defaultValue: 'draft' },
  paymentState: {
    type: DataTypes.ENUM('not_paid', 'in_payment', 'partial', 'paid', 'reversed'),
    defaultValue: 'not_paid',
  },

  partner: { type: DataTypes.STRING(250), allowNull: true, comment: 'Customer / Vendor label' },
  partnerId: { type: DataTypes.UUID, allowNull: true },
  partnerAddress: { type: DataTypes.TEXT, allowNull: true },
  paymentReference: { type: DataTypes.STRING(120), allowNull: true },

  invoiceDate: { type: DataTypes.DATEONLY, allowNull: true },
  invoiceDateDue: { type: DataTypes.DATEONLY, allowNull: true },
  // The demo shows either a date or a term label ("7 Days", "12 Days").
  paymentTermLabel: { type: DataTypes.STRING(40), allowNull: true },

  journal: { type: DataTypes.STRING(120), allowNull: true },
  journalId: { type: DataTypes.UUID, allowNull: true },
  label: { type: DataTypes.STRING(120), allowNull: true },
  ref: { type: DataTypes.STRING(250), allowNull: true, comment: 'e.g. Reversal of: INV/2025/00063' },

  currency: { type: DataTypes.STRING(10), defaultValue: 'AED' },
  companyCurrency: { type: DataTypes.STRING(10), defaultValue: 'AED' },
  amountUntaxed: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  amountTax: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  amountTotal: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  amountTotalCurrency: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  amountResidual: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },

  // "Add Charges From" — the field that wires Accounting back into Operations.
  addChargesFrom: { type: DataTypes.ENUM('house', 'master', 'service_job'), allowNull: true },
  chargeHouseShipments: { type: DataTypes.JSON, defaultValue: [] },
  chargeMasterShipments: { type: DataTypes.JSON, defaultValue: [] },
  chargeServiceJobs: { type: DataTypes.JSON, defaultValue: [] },
  // Denormalised chips shown in the list's House/Master Shipment columns.
  houseShipmentRefs: { type: DataTypes.JSON, defaultValue: [] },
  masterShipmentRefs: { type: DataTypes.JSON, defaultValue: [] },
  serviceJobRefs: { type: DataTypes.JSON, defaultValue: [] },

  // Invoice Lines: [{ houseShipment, product, label, account, exRate, amountQty,
  //   chargeCurrency, analyticAccount, analyticTags, quantity, price, discount,
  //   taxes, taxRate, vatAmount, subtotal, kind: 'line'|'section'|'note' }]
  lines: { type: DataTypes.JSON, defaultValue: [] },
  // Derived double-entry rows shown on the Journal Items tab once posted.
  journalItems: { type: DataTypes.JSON, defaultValue: [] },

  // Credit/debit notes point back at what they reverse.
  // Set when this move mirrors a Procurement VendorBill, so the Bills list and
  // the purchase order point at the same document.
  sourceBillId: { type: DataTypes.UUID, allowNull: true },

  reversedEntryId: { type: DataTypes.UUID, allowNull: true },
  reversedEntryName: { type: DataTypes.STRING(60), allowNull: true },

  narration: { type: DataTypes.TEXT, allowNull: true, comment: 'Terms & Conditions tab' },
  toCheck: { type: DataTypes.BOOLEAN, defaultValue: false },
  company: { type: DataTypes.STRING(120), allowNull: true },
  companyId: { type: DataTypes.UUID, allowNull: true },

  activityLog: { type: DataTypes.JSON, defaultValue: [] },
  followerCount: { type: DataTypes.INTEGER, defaultValue: 1 },
  createdBy: { type: DataTypes.UUID, allowNull: true },
}, {
  tableName: 'account_moves',
  indexes: [{ fields: ['moveType'] }, { fields: ['state'] }, { fields: ['partnerId'] }],
  hooks: {
    beforeValidate: (rec) => {
      // Totals always follow the lines.
      const lines = Array.isArray(rec.lines) ? rec.lines.filter((l) => (l.kind || 'line') === 'line') : [];
      if (lines.length) {
        const untaxed = lines.reduce((s, l) => s + Number(l.subtotal || 0), 0);
        const tax = lines.reduce((s, l) => s + Number(l.vatAmount || 0), 0);
        rec.amountUntaxed = Math.round(untaxed * 100) / 100;
        rec.amountTax = Math.round(tax * 100) / 100;
        rec.amountTotal = Math.round((untaxed + tax) * 100) / 100;
        if (!rec.amountTotalCurrency || rec.currency === rec.companyCurrency) {
          rec.amountTotalCurrency = rec.amountTotal;
        }
      }
      if (rec.state !== 'posted') rec.amountResidual = rec.amountTotal;
    },
  },
});

// Which menu a record belongs to, and the sequence prefix it takes on posting.
const TYPE_META = {
  out_invoice: { menu: 'Invoices', prefix: 'INV', sign: 1, side: 'customer', title: 'Customer Invoice' },
  out_refund: { menu: 'Credit Notes', prefix: 'RINV', sign: -1, side: 'customer', title: 'Customer Credit Note' },
  out_debit: { menu: 'Debit Notes', prefix: 'BDN', sign: 1, side: 'customer', title: 'Customer Debit Note' },
  in_invoice: { menu: 'Bills', prefix: 'BILL', sign: 1, side: 'vendor', title: 'Vendor Bill' },
  in_refund: { menu: 'Refunds', prefix: 'RBILL', sign: -1, side: 'vendor', title: 'Vendor Credit Note' },
  in_debit: { menu: 'Vendor Debit Notes', prefix: 'VDN', sign: 1, side: 'vendor', title: 'Vendor Debit Note' },
  entry: { menu: 'Journal Entries', prefix: 'MISC', sign: 1, side: 'misc', title: 'Journal Entry' },
};

AccountMove.TYPE_META = TYPE_META;
AccountMove.prototype.meta = function meta() { return TYPE_META[this.moveType] || TYPE_META.out_invoice; };

// Header buttons, mirroring the demo's attrs.
AccountMove.prototype.availableActions = function availableActions() {
  const draft = this.state === 'draft';
  const posted = this.state === 'posted';
  const cancelled = this.state === 'cancel';
  return {
    edit: draft,
    confirm: draft,
    preview: true,
    cancel: draft || posted,
    resetToDraft: cancelled || posted,
    registerPayment: posted && this.paymentState !== 'paid',
    addCreditNote: posted && this.moveType === 'out_invoice',
    addDebitNote: posted && ['out_invoice', 'in_invoice'].includes(this.moveType),
  };
};

module.exports = AccountMove;
