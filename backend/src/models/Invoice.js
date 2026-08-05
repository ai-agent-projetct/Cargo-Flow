const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Invoice = sequelize.define('Invoice', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  invoiceNumber: {
    type: DataTypes.STRING(30),
    allowNull: false,
    unique: true,
  },
  type: {
    type: DataTypes.ENUM('invoice', 'credit_note', 'proforma'),
    defaultValue: 'invoice',
  },
  customerId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  shipmentId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  quotationId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled', 'credit_note'),
    defaultValue: 'draft',
  },
  issueDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  dueDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'USD',
  },
  subtotal: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
  },
  taxRate: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0,
  },
  taxAmount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
  },
  discountAmount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
  },
  totalAmount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
  },
  paidAmount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
  },
  balanceAmount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
  },
  paymentTerms: {
    type: DataTypes.INTEGER,
    defaultValue: 30,
  },
  paymentMethod: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  paymentDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  paymentReference: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  bankDetails: {
    type: DataTypes.JSON,
    defaultValue: {},
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  termsAndConditions: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  linkedCreditNoteId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'invoices',
  hooks: {
    beforeValidate: async (invoice) => {
      if (!invoice.invoiceNumber) {
        const year = new Date().getFullYear();
        const random = Math.floor(Math.random() * 90000) + 10000;
        const prefix = invoice.type === 'credit_note' ? 'CN' : invoice.type === 'proforma' ? 'PI' : 'INV';
        invoice.invoiceNumber = `${prefix}-${year}-${random}`;
      }
    },
  },
});

module.exports = Invoice;
