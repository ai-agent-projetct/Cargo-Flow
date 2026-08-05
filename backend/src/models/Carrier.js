const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Carrier = sequelize.define('Carrier', {
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
    type: DataTypes.STRING(20),
    allowNull: true,
    unique: true,
  },
  type: {
    type: DataTypes.ENUM('shipping_line', 'airline', 'trucking', 'rail'),
    allowNull: false,
  },
  scac: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: 'Standard Carrier Alpha Code',
  },
  iataCode: {
    type: DataTypes.STRING(5),
    allowNull: true,
    comment: 'For airlines',
  },
  country: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  website: {
    type: DataTypes.STRING(300),
    allowNull: true,
  },
  trackingUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  phone: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  contactPerson: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  logo: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'carriers',
});

module.exports = Carrier;
