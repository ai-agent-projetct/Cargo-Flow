const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// "RMS > Tariff" — a rate card for one origin/destination lane, carrying three
// grids of charges (origin, freight, destination) that roll up into the
// Lump sum Amount totals shown under the form.
const RMSTariff = sequelize.define('RMSTariff', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tariffNumber: {
    type: DataTypes.STRING(40),
    allowNull: false,
    unique: true,
    comment: 'Format: TF/00001',
  },
  tariffDate: { type: DataTypes.DATEONLY, allowNull: true },
  expiryDate: { type: DataTypes.DATEONLY, allowNull: true },

  service: { type: DataTypes.STRING(10), defaultValue: 'SEA', comment: 'SEA | AIR | ROA | RAIL' },
  trade: { type: DataTypes.STRING(10), defaultValue: 'EXP', comment: 'EXP | IMP' },
  cargoType: { type: DataTypes.STRING(20), defaultValue: 'FCL' },

  originCountry: { type: DataTypes.STRING(100), allowNull: true },
  originPort: { type: DataTypes.STRING(200), allowNull: true },
  destinationCountry: { type: DataTypes.STRING(100), allowNull: true },
  destinationPort: { type: DataTypes.STRING(200), allowNull: true },

  isHazardous: { type: DataTypes.BOOLEAN, defaultValue: false },

  // Charge grids. Each line: {charge, unit, currency, ssp, msp, cost, minimum,
  // tos, carrier, agent, containerType}
  originCharges: { type: DataTypes.JSON, defaultValue: [] },
  freightCharges: { type: DataTypes.JSON, defaultValue: [] },
  destinationCharges: { type: DataTypes.JSON, defaultValue: [] },

  grossWeight: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
  chargeableWeight: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
  volume: { type: DataTypes.DECIMAL(12, 3), allowNull: true },

  company: { type: DataTypes.STRING(150), allowNull: true },
  documentCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  activityLog: { type: DataTypes.JSON, defaultValue: [] },
  followerCount: { type: DataTypes.INTEGER, defaultValue: 1 },

  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  createdBy: { type: DataTypes.UUID, allowNull: true },
}, {
  tableName: 'rms_tariffs',
  hooks: {
    beforeValidate: async (rec) => {
      if (!rec.tariffNumber) {
        const count = await RMSTariff.count();
        rec.tariffNumber = `TF/${String(count + 1).padStart(5, '0')}`;
      }
    },
  },
});

// Lump sum Amount: per-section SSP/Cost subtotals plus the grand total.
RMSTariff.prototype.totals = function totals() {
  const sum = (lines, key) => (lines || []).reduce((acc, l) => acc + Number(l[key] || 0), 0);
  const sections = [
    { label: 'Origin Charges', lines: this.originCharges },
    { label: 'Freight Charges', lines: this.freightCharges },
    { label: 'Destination Charges', lines: this.destinationCharges },
  ].map((s) => ({ label: s.label, totalSsp: sum(s.lines, 'ssp'), totalCost: sum(s.lines, 'cost') }));

  return {
    sections,
    total: {
      label: 'Total',
      totalSsp: sections.reduce((a, s) => a + s.totalSsp, 0),
      totalCost: sections.reduce((a, s) => a + s.totalCost, 0),
    },
  };
};

module.exports = RMSTariff;
