const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Customer = sequelize.define('Customer', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  companyName: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  contactName: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  type: {
    type: DataTypes.ENUM('shipper', 'consignee', 'agent', 'broker', 'other'),
    defaultValue: 'shipper',
  },
  email: {
    type: DataTypes.STRING(150),
    allowNull: true,
    validate: { isEmail: true },
  },
  phone: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  mobile: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  state: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  country: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  postalCode: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  taxId: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  creditLimit: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
  },
  paymentTerms: {
    type: DataTypes.INTEGER,
    defaultValue: 30,
    comment: 'Days',
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'USD',
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'lead', 'prospect'),
    defaultValue: 'active',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  website: {
    type: DataTypes.STRING(300),
    allowNull: true,
  },
  industry: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  referredBy: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  assignedTo: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'customers',
});

module.exports = Customer;
