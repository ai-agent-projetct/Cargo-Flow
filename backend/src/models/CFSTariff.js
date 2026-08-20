const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// "Administration > CFS Tariff > Charges Tariff" in CargoFlo ERP. Each record
// can be a Buy Tariff or Sell Tariff and carries an editable Charges grid
// (Charges, Tariff Base, Measurement Type, Unit Price, Currency, Valid From/To).
const CFSTariff = sequelize.define('CFSTariff', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tariffType: {
    type: DataTypes.ENUM('sell', 'buy'),
    allowNull: false,
    defaultValue: 'sell',
  },
  status: {
    type: DataTypes.ENUM('draft', 'approved', 'unapproved'),
    allowNull: false,
    defaultValue: 'draft',
  },
  tariffName: {
    type: DataTypes.STRING(200),
    allowNull: false,
    defaultValue: '',
  },
  operation: {
    type: DataTypes.ENUM('import', 'export'),
    allowNull: true,
  },
  transportMode: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: 'SEA',
  },
  shippingLineId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  cargoType: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: 'LCL',
  },
  companyId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  validFrom: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  validTo: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  partyId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Customer for the CFS Tariff',
  },
  currency: {
    type: DataTypes.STRING(10),
    allowNull: true,
    defaultValue: 'AED',
  },
  originCountry: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  origin: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  originPortId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  destinationCountry: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  destination: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  destinationPortId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  charges: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'cfs_tariffs',
});

module.exports = CFSTariff;
