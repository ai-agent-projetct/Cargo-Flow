const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Rate = sequelize.define('Rate', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  carrierId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  originPortId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  destinationPortId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  originCountry: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  destinationCountry: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  mode: {
    type: DataTypes.ENUM('sea', 'air', 'land', 'rail'),
    allowNull: false,
  },
  shipmentType: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  containerType: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  freightRate: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'USD',
  },
  rateUnit: {
    type: DataTypes.ENUM('per_container', 'per_kg', 'per_cbm', 'per_ton', 'per_shipment', 'per_truck'),
    defaultValue: 'per_container',
  },
  surcharges: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  transitDays: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  validFrom: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  validTo: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'expired'),
    defaultValue: 'active',
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
  tableName: 'rates',
});

module.exports = Rate;
