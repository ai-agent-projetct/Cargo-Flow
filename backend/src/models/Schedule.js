const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Schedule = sequelize.define('Schedule', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  carrierId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  originPortId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  destinationPortId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  mode: {
    type: DataTypes.ENUM('sea', 'air', 'land', 'rail'),
    defaultValue: 'sea',
  },
  vesselName: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  voyageNumber: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  flightNumber: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  departureDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  arrivalDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  cutoffDate: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Cargo cutoff date',
  },
  transitDays: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  frequency: {
    type: DataTypes.ENUM('once', 'weekly', 'biweekly', 'monthly'),
    defaultValue: 'once',
  },
  status: {
    type: DataTypes.ENUM('scheduled', 'departed', 'arrived', 'cancelled', 'delayed'),
    defaultValue: 'scheduled',
  },
  availableCapacity: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
  },
  capacityUnit: {
    type: DataTypes.STRING(20),
    defaultValue: 'TEU',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  via: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Transshipment ports',
  },
}, {
  tableName: 'schedules',
});

module.exports = Schedule;
