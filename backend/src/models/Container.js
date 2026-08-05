const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Container = sequelize.define('Container', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  shipmentId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  containerNumber: {
    type: DataTypes.STRING(20),
    allowNull: true,
    unique: true,
  },
  sealNumber: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  type: {
    type: DataTypes.ENUM('20GP', '40GP', '40HC', '20RF', '40RF', '20OT', '40OT', '20FR', '40FR', '45HC', 'LCL'),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('empty', 'loaded', 'in_transit', 'at_port', 'delivered', 'returned'),
    defaultValue: 'empty',
  },
  grossWeight: {
    type: DataTypes.DECIMAL(12, 3),
    allowNull: true,
  },
  netWeight: {
    type: DataTypes.DECIMAL(12, 3),
    allowNull: true,
  },
  tare: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: true,
  },
  weightUnit: {
    type: DataTypes.ENUM('kg', 'lbs', 'mt'),
    defaultValue: 'kg',
  },
  volume: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: true,
  },
  numberOfPackages: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  packageType: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  isReefer: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  temperature: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
  },
  humidity: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
  },
  isDangerous: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  imoClass: {
    type: DataTypes.STRING(10),
    allowNull: true,
  },
  currentLocation: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'containers',
});

module.exports = Container;
