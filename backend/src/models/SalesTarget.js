const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// A salesperson's target for a period (upstream: crm.sale.target).
//
// `targetParameter` picks what is being measured, and the achieved figure is
// computed from real records in that window - weight and TEU from shipments,
// revenue and margin from charge lines, quotation count from quotes. Storing
// the achieved figure here as well keeps the Sales Strategy dashboard a single
// read instead of re-aggregating on every page load.
const SalesTarget = sequelize.define('SalesTarget', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(150),
    allowNull: false,
    validate: { notEmpty: true },
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'Salesperson the target belongs to',
  },
  managerId: { type: DataTypes.UUID, allowNull: true },
  salesTeamId: { type: DataTypes.UUID, allowNull: true },
  dateFrom: { type: DataTypes.DATEONLY, allowNull: false },
  dateTo: { type: DataTypes.DATEONLY, allowNull: false },

  // --- scope ---------------------------------------------------------------
  transportMode: {
    type: DataTypes.ENUM('AIR', 'SEA', 'ROAD', 'RAIL', 'COURIER'),
    allowNull: true,
    comment: 'Null = all modes',
  },
  shipmentType: { type: DataTypes.STRING(30), allowNull: true },
  cargoType: { type: DataTypes.STRING(30), allowNull: true },
  isPackageGroup: { type: DataTypes.BOOLEAN, defaultValue: false },

  // --- the target ----------------------------------------------------------
  targetParameter: {
    type: DataTypes.ENUM('weight', 'volume', 'gross_revenue', 'gross_margin', 'quotation', 'teu'),
    allowNull: false,
  },
  targetValue: {
    type: DataTypes.DECIMAL(16, 3),
    allowNull: false,
    defaultValue: 0,
  },
  targetWeightUom: { type: DataTypes.STRING(20), allowNull: true, defaultValue: 'kg' },
  targetVolumeUom: { type: DataTypes.STRING(20), allowNull: true, defaultValue: 'm3' },
  targetCurrency: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'AED' },

  // --- achieved (recomputed from live records) -----------------------------
  achievedValue: { type: DataTypes.DECIMAL(16, 3), allowNull: true, defaultValue: 0 },
  achievedPercentage: { type: DataTypes.DECIMAL(9, 4), allowNull: true, defaultValue: 0 },
  lastComputedAt: { type: DataTypes.DATE, allowNull: true },

  // --- incentive -----------------------------------------------------------
  incentiveType: { type: DataTypes.ENUM('amount', 'percentage'), allowNull: true },
  incentiveCurrency: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'AED' },
  incentiveUnit: { type: DataTypes.DECIMAL(14, 4), allowNull: true, defaultValue: 0 },
  incentiveUnitType: { type: DataTypes.ENUM('net', 'gross', 'freight'), allowNull: true },
  incentiveEarned: { type: DataTypes.DECIMAL(16, 2), allowNull: true, defaultValue: 0 },

  // --- optional per-month / per-lane breakdown -----------------------------
  targetLines: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Array of { label, periodFrom, periodTo, targetValue, achievedValue }',
  },

  remarks: { type: DataTypes.TEXT, allowNull: true },
  createdBy: { type: DataTypes.UUID, allowNull: true },
  companyId: { type: DataTypes.UUID, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'sales_targets',
  indexes: [
    { fields: ['userId'] },
    { fields: ['dateFrom', 'dateTo'] },
    { fields: ['targetParameter'] },
  ],
  validate: {
    periodOrdered() {
      if (this.dateFrom && this.dateTo && this.dateTo < this.dateFrom) {
        throw new Error('Target end date cannot be before the start date');
      }
    },
  },
});

module.exports = SalesTarget;
