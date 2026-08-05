const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CreditNote = sequelize.define('CreditNote', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  creditNoteNumber: {
    type: DataTypes.STRING(30),
    allowNull: false,
    unique: true,
  },
  invoiceId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  customerId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  companyId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  items: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array of {description, quantity, unitPrice, amount, category}',
  },
  subtotal: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
  },
  taxAmount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
  },
  totalAmount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'USD',
  },
  status: {
    type: DataTypes.ENUM('draft', 'issued', 'applied', 'cancelled'),
    defaultValue: 'draft',
  },
  issuedDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  appliedToInvoiceId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Invoice to which this credit note was applied',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false,
  },
}, {
  tableName: 'credit_notes',
  hooks: {
    beforeValidate: async (creditNote) => {
      if (!creditNote.creditNoteNumber) {
        const year = new Date().getFullYear();
        const { Op } = require('sequelize');
        const count = await CreditNote.count({
          where: {
            createdAt: {
              [Op.gte]: new Date(`${year}-01-01`),
            },
          },
        });
        const seq = String(count + 1).padStart(5, '0');
        creditNote.creditNoteNumber = `CN-${year}-${seq}`;
      }
    },
  },
});

module.exports = CreditNote;
