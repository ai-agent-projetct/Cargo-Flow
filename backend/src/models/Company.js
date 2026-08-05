const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Company = sequelize.define('Company', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: { notEmpty: true },
  },
  code: {
    type: DataTypes.STRING(20),
    allowNull: true,
    unique: true,
  },
  type: {
    type: DataTypes.ENUM('freight_forwarder', 'shipper', 'consignee', 'agent', 'carrier', 'other'),
    defaultValue: 'freight_forwarder',
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
  phone: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING(150),
    allowNull: true,
    validate: { isEmail: true },
  },
  website: {
    type: DataTypes.STRING(300),
    allowNull: true,
  },
  logo: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  taxId: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'USD',
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active',
  },
  settings: {
    type: DataTypes.JSON,
    defaultValue: {},
  },
  unlocode: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  timezone: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  addressLine2: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  houseNumber: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  doorNumber: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  customerType: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  parentCompanyId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  favicon: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  agentId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  tourismTaxRegNo: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  miscCode: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  taxRegistrationNumber: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  vatNumber: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  restrictedDocuments: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
}, {
  tableName: 'companies',
});

module.exports = Company;
