const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InvoiceItem = sequelize.define('InvoiceItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  invoiceId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  category: {
    type: DataTypes.ENUM('freight', 'origin_charges', 'destination_charges', 'customs', 'insurance', 'handling', 'surcharge', 'other'),
    defaultValue: 'freight',
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 3),
    defaultValue: 1,
  },
  unit: {
    type: DataTypes.STRING(20),
    defaultValue: 'lot',
  },
  unitPrice: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
  },
  taxable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  tableName: 'invoice_items',
});

module.exports = InvoiceItem;
