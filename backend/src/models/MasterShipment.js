const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// "Master Shipment (Console)" - Operations > Master shipment(Console).
// Mirrors a slimmed-down version of FFJob with the 7-tab structure:
// Carriage, Ext. Carrier Bookings, Parties, Packages, Routing,
// Milestones Tracking, T&C.
const MasterShipment = sequelize.define('MasterShipment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  masterShipmentNumber: {
    type: DataTypes.STRING(60),
    allowNull: false,
    unique: true,
    comment: 'Format: MSC-SEA-E-2026-00001',
  },
  transportMode: {
    type: DataTypes.ENUM('AIR', 'SEA', 'ROAD', 'RAIL'),
    allowNull: false,
    defaultValue: 'SEA',
  },
  direction: {
    type: DataTypes.ENUM('EXPORT', 'IMPORT', 'LOCAL'),
    allowNull: false,
    defaultValue: 'EXPORT',
  },
  cargoType: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: 'FCL',
  },
  serviceType: {
    type: DataTypes.STRING(5),
    allowNull: true,
    defaultValue: 'M',
  },
  customerId: { type: DataTypes.UUID, allowNull: true },
  origin: { type: DataTypes.STRING(200), allowNull: true },
  originCode: { type: DataTypes.STRING(10), allowNull: true },
  originCountry: { type: DataTypes.STRING(100), allowNull: true },
  originPortId: { type: DataTypes.UUID, allowNull: true },
  destination: { type: DataTypes.STRING(200), allowNull: true },
  destinationCode: { type: DataTypes.STRING(10), allowNull: true },
  destinationCountry: { type: DataTypes.STRING(100), allowNull: true },
  destinationPortId: { type: DataTypes.UUID, allowNull: true },
  etd: { type: DataTypes.DATE, allowNull: true },
  eta: { type: DataTypes.DATE, allowNull: true },
  atd: { type: DataTypes.DATE, allowNull: true },
  ata: { type: DataTypes.DATE, allowNull: true },
  carrier: { type: DataTypes.STRING(100), allowNull: true },
  vesselName: { type: DataTypes.STRING(100), allowNull: true },
  voyageNumber: { type: DataTypes.STRING(50), allowNull: true },
  flightNumber: { type: DataTypes.STRING(20), allowNull: true },
  mblNumber: { type: DataTypes.STRING(50), allowNull: true, comment: 'Master Bill of Lading' },
  containerNumbers: { type: DataTypes.JSON, defaultValue: [] },
  packages: { type: DataTypes.INTEGER, allowNull: true },
  packUnit: { type: DataTypes.STRING(10), defaultValue: 'PKG' },
  grossWeight: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
  weightUnit: { type: DataTypes.STRING(5), defaultValue: 'kg' },
  volume: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
  volumeUnit: { type: DataTypes.STRING(5), defaultValue: 'm3' },
  commodity: { type: DataTypes.STRING(200), allowNull: true },
  incoterm: { type: DataTypes.STRING(10), allowNull: true },
  currency: { type: DataTypes.STRING(10), defaultValue: 'AED' },
  status: {
    type: DataTypes.ENUM('created', 'ext_booked', 'cancelled', 'completed'),
    defaultValue: 'created',
  },
  extCarrierBookings: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array of {carrierName, bookingNumber, bookingDate, status}',
  },
  parties: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array of {role, name, contactPerson, email, phone}',
  },
  packageLines: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  routingLegs: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  milestones: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array of {event, location, datetime}',
  },
  termsAndConditions: { type: DataTypes.TEXT, allowNull: true },
  remarks: { type: DataTypes.TEXT, allowNull: true },
  activityLog: { type: DataTypes.JSON, defaultValue: [] },
  createdBy: { type: DataTypes.UUID, allowNull: true },
}, {
  tableName: 'master_shipments',
  hooks: {
    beforeValidate: async (rec) => {
      if (!rec.masterShipmentNumber) {
        const { Op } = require('sequelize');
        const year = new Date().getFullYear();
        const modeCode = { AIR: 'AIR', SEA: 'SEA', ROAD: 'ROA', RAIL: 'RAIL' }[rec.transportMode] || 'SEA';
        const dirCode = { EXPORT: 'E', IMPORT: 'I', LOCAL: 'L' }[rec.direction] || 'E';
        const count = await MasterShipment.count({
          where: { createdAt: { [Op.gte]: new Date(`${year}-01-01`) } },
        });
        const seq = String(count + 1).padStart(5, '0');
        rec.masterShipmentNumber = `MSC-${modeCode}-${dirCode}-${year}-${seq}`;
      }
    },
  },
});

module.exports = MasterShipment;
