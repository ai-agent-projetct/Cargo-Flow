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

  // --- shared by sailing and air schedules ---------------------------------
  // Upstream keeps freight.schedule and freight.air.schedule as two tables,
  // but they differ only in the carrier-specific columns below. `mode` already
  // separates them here, so Schedules > Sailing and Schedules > Air are two
  // filters over one table.
  serviceName: {
    type: DataTypes.STRING(120),
    allowNull: true,
    comment: 'Carrier service / loop name',
  },
  source: {
    type: DataTypes.ENUM('manual', 'inttra', 'carrier_api'),
    allowNull: false,
    defaultValue: 'manual',
  },
  originCountry: { type: DataTypes.STRING(100), allowNull: true },
  destinationCountry: { type: DataTypes.STRING(100), allowNull: true },
  actualDepartureDate: { type: DataTypes.DATE, allowNull: true },
  actualArrivalDate: { type: DataTypes.DATE, allowNull: true },
  siCutoff: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Shipping instruction cutoff',
  },
  parentScheduleId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Parent schedule when this row is one leg of a multi-leg routing',
  },
  legSequence: { type: DataTypes.INTEGER, allowNull: true },
  quoteLegId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Multimodal quote leg this schedule was attached to',
  },

  // --- sea only -------------------------------------------------------------
  scacNumber: { type: DataTypes.STRING(20), allowNull: true },
  vesselCutoff: { type: DataTypes.DATE, allowNull: true },
  vgmCutoff: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Verified Gross Mass declaration cutoff (SOLAS)',
  },

  // --- air only -------------------------------------------------------------
  iataNumber: { type: DataTypes.STRING(20), allowNull: true },
  icaoNumber: { type: DataTypes.STRING(20), allowNull: true },
  aircraftType: {
    type: DataTypes.ENUM('coa', 'pax'),
    allowNull: true,
    comment: 'Freighter (cargo-only aircraft) or passenger belly-hold',
  },
  onboardingCutoff: { type: DataTypes.DATE, allowNull: true },
  flightStatus: { type: DataTypes.STRING(40), allowNull: true },
}, {
  tableName: 'schedules',
  indexes: [
    { fields: ['mode'] },
    { fields: ['parentScheduleId'] },
    { fields: ['departureDate'] },
  ],
});

module.exports = Schedule;
