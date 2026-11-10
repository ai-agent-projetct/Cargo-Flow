const { DataTypes } = require('sequelize');

// The costing roll-up every shipment-like record carries: house shipment
// (FFJob), master shipment, the older Shipment, and service job.
//
// These are written by `chargeRollup.rollup()` from the record's charge lines.
// They are stored rather than computed on read so a list screen can sort by
// margin and a report can aggregate without joining charge_lines every time.
//
// Declared once and spread into each model, because a column that exists in
// the database but not in the model is silently dropped on write - which is
// exactly the kind of bug that makes a P&L read zero with no error anywhere.
const COSTING_FIELDS = {
  estimatedRevenue: { type: DataTypes.DECIMAL(16, 2), allowNull: true, defaultValue: 0 },
  estimatedCost: { type: DataTypes.DECIMAL(16, 2), allowNull: true, defaultValue: 0 },
  estimatedMargin: { type: DataTypes.DECIMAL(16, 2), allowNull: true, defaultValue: 0 },
  estimatedMarginPercentage: { type: DataTypes.DECIMAL(9, 4), allowNull: true, defaultValue: 0 },
  receivedRevenue: {
    type: DataTypes.DECIMAL(16, 2),
    allowNull: true,
    defaultValue: 0,
    comment: 'Actually invoiced and received, as opposed to estimated',
  },
  paidCost: { type: DataTypes.DECIMAL(16, 2), allowNull: true, defaultValue: 0 },
  receivedMargin: { type: DataTypes.DECIMAL(16, 2), allowNull: true, defaultValue: 0 },
  dueRevenue: { type: DataTypes.DECIMAL(16, 2), allowNull: true, defaultValue: 0 },
  dueCost: { type: DataTypes.DECIMAL(16, 2), allowNull: true, defaultValue: 0 },
  revenueChargeStatus: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: 'no',
    comment: 'no | partial | fully_invoiced, aggregated over the revenue charges',
  },
  costChargeStatus: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: 'no',
    comment: 'no | partial | fully_billed, aggregated over the cost charges',
  },
  chargeableBasis: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: 'weight | volumetric | measurement | per_container | per_truck',
  },
  weightVolume: {
    type: DataTypes.DECIMAL(14, 3),
    allowNull: true,
    defaultValue: 0,
    comment: 'Revenue tons for sea LCL, chargeable kg otherwise',
  },
  volumetricDivisor: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    comment: 'cm3 per kg actually used; air 6000, courier 5000 unless overridden',
  },
  quoteLegId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Multimodal quote leg this record was created from',
  },
};

// `chargeableWeight` is kept separate because FFJob already declares it and
// re-declaring would shadow the existing column definition.
const CHARGEABLE_WEIGHT_FIELD = {
  chargeableWeight: { type: DataTypes.DECIMAL(14, 3), allowNull: true, defaultValue: 0 },
};

module.exports = { COSTING_FIELDS, CHARGEABLE_WEIGHT_FIELD };
