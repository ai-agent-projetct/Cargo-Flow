const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Represents both "Sell Tariff" and "Buy Tariff" records from
// Administration > Tariff in SeaRates ERP. `tariffType` distinguishes the two
// lists. `charges` stores the editable charges grid (Charge Name, Unit Price,
// Currency, Measurement Basis, Valid From, Valid To) as JSON.
const Tariff = sequelize.define('Tariff', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tariffType: {
    type: DataTypes.ENUM('sell', 'buy'),
    allowNull: false,
  },
  tariffName: {
    type: DataTypes.STRING(200),
    allowNull: false,
    defaultValue: '-',
  },
  jobType: {
    type: DataTypes.ENUM('shipment', 'service_job'),
    allowNull: false,
    defaultValue: 'shipment',
  },
  shipmentType: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  serviceJobType: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  transportMode: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  cargoType: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  companyId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  incotermId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  partyId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Customer (for sell tariff) or Vendor/Agent (for buy tariff)',
  },
  currency: {
    type: DataTypes.STRING(10),
    allowNull: true,
    defaultValue: 'USD',
  },
  originCountry: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  origin: {
    type: DataTypes.STRING(150),
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
  charges: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'tariffs',
});

module.exports = Tariff;
