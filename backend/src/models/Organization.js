const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// "Organizations" - the partner master (customers, shippers, consignees,
// carriers, agents). Mirrors the SeaRates Organizations form, which switches
// between an Individual and a Company layout via `companyType`.
const Organization = sequelize.define('Organization', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  // Individual vs Company drives which fields the form shows.
  companyType: {
    type: DataTypes.ENUM('person', 'company'),
    allowNull: false,
    defaultValue: 'person',
  },
  name: { type: DataTypes.STRING(200), allowNull: false, validate: { notEmpty: true } },
  companyName: { type: DataTypes.STRING(200), allowNull: true },
  customerCode: { type: DataTypes.STRING(40), allowNull: true },
  branchCode: { type: DataTypes.STRING(40), allowNull: true },
  parentId: { type: DataTypes.UUID, allowNull: true, comment: 'Related Organization / parent partner' },
  // Child address records (Invoice Address, Delivery Address, Other Address).
  addressType: {
    type: DataTypes.ENUM('contact', 'invoice', 'delivery', 'other'),
    defaultValue: 'contact',
  },
  markAsDefault: { type: DataTypes.BOOLEAN, defaultValue: true },
  avatar: { type: DataTypes.TEXT, allowNull: true },
  // KYC progress bar across the top of the form: New › KYC Pending › KYC Done.
  kycStatus: {
    type: DataTypes.ENUM('new', 'kyc_pending', 'kyc_done'),
    defaultValue: 'new',
  },
  // Links this partner to a Customer record so the workflow ribbon can count
  // the transactional documents (quotes, bookings, invoices) that hang off it.
  customerId: { type: DataTypes.UUID, allowNull: true },
  // Chatter feed: [{ at, author, kind: 'message'|'note'|'log', body, changes: [{field, from, to}] }]
  activityLog: { type: DataTypes.JSON, defaultValue: [] },
  followerCount: { type: DataTypes.INTEGER, defaultValue: 0 },

  // Address block
  streetName: { type: DataTypes.STRING(200), allowNull: true },
  houseNumber: { type: DataTypes.STRING(30), allowNull: true },
  doorNumber: { type: DataTypes.STRING(30), allowNull: true },
  street2: { type: DataTypes.STRING(200), allowNull: true },
  state: { type: DataTypes.STRING(100), allowNull: true },
  city: { type: DataTypes.STRING(100), allowNull: true },
  zip: { type: DataTypes.STRING(20), allowNull: true },
  country: { type: DataTypes.STRING(100), allowNull: true },

  // Identification
  identificationType: { type: DataTypes.STRING(30), defaultValue: 'VAT' },
  identificationNumber: { type: DataTypes.STRING(60), allowNull: true },
  vat: { type: DataTypes.STRING(60), allowNull: true },
  pst: { type: DataTypes.STRING(60), allowNull: true },
  partyTypes: { type: DataTypes.JSON, defaultValue: [] },
  freightCarrier: { type: DataTypes.STRING(150), allowNull: true },

  // Contact block
  jobPosition: { type: DataTypes.STRING(120), allowNull: true },
  phone: { type: DataTypes.STRING(40), allowNull: true },
  mobile: { type: DataTypes.STRING(40), allowNull: true },
  fax: { type: DataTypes.STRING(40), allowNull: true },
  email: { type: DataTypes.STRING(150), allowNull: true },
  website: { type: DataTypes.STRING(200), allowNull: true },
  title: { type: DataTypes.STRING(40), allowNull: true },
  language: { type: DataTypes.STRING(40), defaultValue: 'English (US)' },
  tags: { type: DataTypes.JSON, defaultValue: [] },
  transactionType: { type: DataTypes.ENUM('b2b', 'b2c'), defaultValue: 'b2b' },
  contactPerson: { type: DataTypes.STRING(150), allowNull: true },
  govtRegNumber: { type: DataTypes.STRING(80), allowNull: true },
  internalRefNo: { type: DataTypes.STRING(80), allowNull: true },
  localizationCountryCode: { type: DataTypes.STRING(5), allowNull: true },

  // Tab: Sales & Purchase
  salesperson: { type: DataTypes.STRING(150), allowNull: true },
  salesTeam: { type: DataTypes.STRING(150), allowNull: true },
  paymentTerms: { type: DataTypes.STRING(100), allowNull: true },
  pricelist: { type: DataTypes.STRING(100), allowNull: true },
  supplierPaymentTerms: { type: DataTypes.STRING(100), allowNull: true },
  receiptReminder: { type: DataTypes.BOOLEAN, defaultValue: false },
  daysBeforeReceipt: { type: DataTypes.INTEGER, allowNull: true },
  supplierCurrency: { type: DataTypes.STRING(10), allowNull: true },
  fiscalPosition: { type: DataTypes.STRING(100), allowNull: true },
  reference: { type: DataTypes.STRING(80), allowNull: true },
  company: { type: DataTypes.STRING(150), allowNull: true },
  industry: { type: DataTypes.STRING(100), allowNull: true },

  // Tab: Invoicing
  bankAccounts: { type: DataTypes.JSON, defaultValue: [] },
  currency: { type: DataTypes.STRING(10), defaultValue: 'AED' },
  accountReceivable: { type: DataTypes.STRING(100), allowNull: true },
  accountPayable: { type: DataTypes.STRING(100), allowNull: true },
  showCreditLimit: { type: DataTypes.BOOLEAN, defaultValue: false },
  internalCreditLimit: { type: DataTypes.DECIMAL(14, 2), defaultValue: 0 },
  totalReceivable: { type: DataTypes.DECIMAL(14, 2), defaultValue: 0 },

  // Tab: Credit Limit (shipment module)
  isCredit: { type: DataTypes.BOOLEAN, defaultValue: false },
  isCreditOrCash: { type: DataTypes.BOOLEAN, defaultValue: false },
  approvedCreditDays: { type: DataTypes.INTEGER, allowNull: true },
  approvedCreditLimit: { type: DataTypes.DECIMAL(14, 2), defaultValue: 0 },
  creditLimitRules: { type: DataTypes.JSON, defaultValue: [] },

  // Tab: Internal Notes
  notes: { type: DataTypes.TEXT, allowNull: true },
  invoiceWarn: { type: DataTypes.STRING(30), defaultValue: 'no-message' },
  invoiceWarnMsg: { type: DataTypes.TEXT, allowNull: true },

  // Tab: WMS Invoice Integration
  appCode: { type: DataTypes.STRING(60), allowNull: true },
  customerType: { type: DataTypes.ENUM('billing', 'consignee'), allowNull: true },
  inwardStrategy: { type: DataTypes.ENUM('fifo', 'fifo_batch', 'batch'), allowNull: true },
  pickStrategy: { type: DataTypes.ENUM('fifo', 'fifo_batch', 'batch'), allowNull: true },
  einNo: { type: DataTypes.STRING(60), allowNull: true },
  reportName: { type: DataTypes.STRING(120), allowNull: true },
  warehouseCode: { type: DataTypes.STRING(60), allowNull: true },
  warehouseCodes: { type: DataTypes.JSON, defaultValue: [] },
  operationAutoEmail: { type: DataTypes.BOOLEAN, defaultValue: false },
  customerRefId: { type: DataTypes.STRING(80), allowNull: true },
  ccEmail: { type: DataTypes.STRING(150), allowNull: true },
  bccEmail: { type: DataTypes.STRING(150), allowNull: true },
  nifNo: { type: DataTypes.STRING(60), allowNull: true },

  // Stat-button counters shown across the top of the form
  meetingCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  totalInvoiced: { type: DataTypes.DECIMAL(14, 2), defaultValue: 0 },
  totalBilled: { type: DataTypes.DECIMAL(14, 2), defaultValue: 0 },
  vendorBillCount: { type: DataTypes.INTEGER, defaultValue: 0 },

  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  createdBy: { type: DataTypes.UUID, allowNull: true },
}, {
  tableName: 'organizations',
});

module.exports = Organization;
