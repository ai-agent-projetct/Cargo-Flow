const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// "Export Console Generation" - Operations > Export Console Generation.
// Groups multiple House Shipments into a single Master/Consolidation.
const Consolidation = sequelize.define('Consolidation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  consolidationNumber: {
    type: DataTypes.STRING(60),
    allowNull: false,
    unique: true,
    comment: 'Format: CONS-SEA-E-2026-00001',
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
  cargoType: { type: DataTypes.STRING(20), defaultValue: 'FCL' },
  shipmentType: { type: DataTypes.STRING(10), defaultValue: 'EXP' },
  serviceMode: { type: DataTypes.STRING(50), allowNull: true },
  consolidationDate: { type: DataTypes.DATEONLY, allowNull: true },
  consolidationType: { type: DataTypes.STRING(60), allowNull: true },
  tags: { type: DataTypes.STRING(200), allowNull: true },
  sailingSchedule: { type: DataTypes.STRING(150), allowNull: true },
  company: { type: DataTypes.STRING(150), allowNull: true },
  // Party
  agent: { type: DataTypes.STRING(200), allowNull: true },
  coLoader: { type: DataTypes.STRING(200), allowNull: true },
  // Locations: Origin/Destination plus the four port legs (Place of Receipt,
  // Port of Discharge, Port of Loading, Final Place of Delivery).
  origin: { type: DataTypes.STRING(200), allowNull: true },
  destination: { type: DataTypes.STRING(200), allowNull: true },
  por: { type: DataTypes.STRING(200), allowNull: true },
  pod: { type: DataTypes.STRING(200), allowNull: true },
  pol: { type: DataTypes.STRING(200), allowNull: true },
  fpd: { type: DataTypes.STRING(200), allowNull: true },
  // Vessel info
  carrier: { type: DataTypes.STRING(100), allowNull: true },
  shippingLine: { type: DataTypes.STRING(150), allowNull: true },
  vesselName: { type: DataTypes.STRING(100), allowNull: true },
  voyageNumber: { type: DataTypes.STRING(50), allowNull: true },
  carrierRefNumber: { type: DataTypes.STRING(100), allowNull: true },
  incoterm: { type: DataTypes.STRING(20), allowNull: true },
  mblNumber: { type: DataTypes.STRING(50), allowNull: true },
  etd: { type: DataTypes.DATE, allowNull: true },
  eta: { type: DataTypes.DATE, allowNull: true },
  atd: { type: DataTypes.DATE, allowNull: true },
  // Totals shown in the form's summary strip
  packs: { type: DataTypes.INTEGER, defaultValue: 0 },
  totalVolume: { type: DataTypes.DECIMAL(12, 3), defaultValue: 0 },
  totalWeight: { type: DataTypes.DECIMAL(12, 3), defaultValue: 0 },
  estimatedRevenue: { type: DataTypes.DECIMAL(14, 2), defaultValue: 0 },
  estimatedCost: { type: DataTypes.DECIMAL(14, 2), defaultValue: 0 },
  packageLines: { type: DataTypes.JSON, defaultValue: [] },
  commodityLines: { type: DataTypes.JSON, defaultValue: [] },
  containerNumbers: { type: DataTypes.JSON, defaultValue: [] },
  houseShipmentIds: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array of FFJob ids consolidated into this master',
  },
  status: {
    type: DataTypes.ENUM('draft', 'confirmed', 'in_transit', 'arrived', 'completed', 'cancelled'),
    defaultValue: 'draft',
  },
  remarks: { type: DataTypes.TEXT, allowNull: true },
  createdBy: { type: DataTypes.UUID, allowNull: true },
}, {
  tableName: 'consolidations',
  hooks: {
    beforeValidate: async (rec) => {
      if (!rec.consolidationNumber) {
        const { Op } = require('sequelize');
        const year = new Date().getFullYear();
        const modeCode = { AIR: 'AIR', SEA: 'SEA', ROAD: 'ROA', RAIL: 'RAIL' }[rec.transportMode] || 'SEA';
        const dirCode = { EXPORT: 'E', IMPORT: 'I', LOCAL: 'L' }[rec.direction] || 'E';
        const count = await Consolidation.count({
          where: { createdAt: { [Op.gte]: new Date(`${year}-01-01`) } },
        });
        const seq = String(count + 1).padStart(5, '0');
        rec.consolidationNumber = `CONS-${modeCode}-${dirCode}-${year}-${seq}`;
      }
    },
  },
});

module.exports = Consolidation;
