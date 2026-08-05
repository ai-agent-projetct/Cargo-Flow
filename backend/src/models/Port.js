const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Port = sequelize.define('Port', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  code: {
    type: DataTypes.STRING(10),
    allowNull: false,
    unique: true,
  },
  type: {
    type: DataTypes.ENUM('sea', 'air', 'inland', 'rail'),
    defaultValue: 'sea',
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  country: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  countryCode: {
    type: DataTypes.STRING(5),
    allowNull: true,
  },
  timezone: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true,
  },
  longitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active',
  },
}, {
  tableName: 'ports',
});

module.exports = Port;
