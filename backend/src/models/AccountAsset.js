const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Accounting > Management > Assets / Deferred Expenses / Deferred Revenue.
// Odoo backs all three menus with account.asset and separates them by
// assetType, so one model and one workflow serves the three screens.
const AccountAsset = sequelize.define('AccountAsset', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING(200), allowNull: false },

  assetType: {
    type: DataTypes.ENUM('purchase', 'sale', 'expense'),
    defaultValue: 'purchase',
    comment: 'purchase = Assets, sale = Deferred Revenue, expense = Deferred Expenses',
  },

  partner: { type: DataTypes.STRING(250), allowNull: true },
  partnerId: { type: DataTypes.UUID, allowNull: true },

  original: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0, comment: 'Original Value' },
  depreciated: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  // Original minus what has been recognised so far.
  bookValue: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  currency: { type: DataTypes.STRING(10), defaultValue: 'AED' },

  acquisitionDate: { type: DataTypes.DATEONLY, allowNull: true },
  firstDepreciationDate: { type: DataTypes.DATEONLY, allowNull: true },
  // Number of periods the value is spread over.
  duration: { type: DataTypes.INTEGER, defaultValue: 12 },
  periodicity: {
    type: DataTypes.ENUM('months', 'years'),
    defaultValue: 'months',
  },
  method: { type: DataTypes.ENUM('linear', 'degressive'), defaultValue: 'linear' },

  account: { type: DataTypes.STRING(120), allowNull: true },
  depreciationAccount: { type: DataTypes.STRING(120), allowNull: true },
  expenseAccount: { type: DataTypes.STRING(120), allowNull: true },
  journal: { type: DataTypes.STRING(120), allowNull: true },

  state: {
    type: DataTypes.ENUM('draft', 'running', 'paused', 'close', 'cancel'),
    defaultValue: 'draft',
  },

  // The generated schedule: one row per period.
  depreciationLines: { type: DataTypes.JSON, defaultValue: [] },

  company: { type: DataTypes.STRING(120), allowNull: true },
  activityLog: { type: DataTypes.JSON, defaultValue: [] },
  followerCount: { type: DataTypes.INTEGER, defaultValue: 1 },
  createdBy: { type: DataTypes.UUID, allowNull: true },
}, {
  tableName: 'account_assets',
  indexes: [{ fields: ['assetType'] }, { fields: ['state'] }],
});

// Spread the original value evenly across the duration. Linear is the only
// method the demo's seeded records use; degressive front-loads instead.
AccountAsset.prototype.buildSchedule = function buildSchedule() {
  const total = Number(this.original || 0);
  const periods = Math.max(1, Number(this.duration || 1));
  const start = this.firstDepreciationDate || this.acquisitionDate;
  if (!total || !start) return [];

  const per = Math.round((total / periods) * 100) / 100;
  const lines = [];
  let remaining = total;
  for (let i = 0; i < periods; i += 1) {
    const d = new Date(start);
    if (this.periodicity === 'years') d.setFullYear(d.getFullYear() + i);
    else d.setMonth(d.getMonth() + i);
    // The last period absorbs the rounding remainder so the schedule sums
    // exactly to the original value.
    const amount = i === periods - 1 ? Math.round(remaining * 100) / 100 : per;
    remaining = Math.round((remaining - amount) * 100) / 100;
    lines.push({
      sequence: i + 1,
      date: d.toISOString().slice(0, 10),
      depreciation: amount,
      cumulative: Math.round((total - remaining) * 100) / 100,
      remaining,
      posted: false,
    });
  }
  return lines;
};

AccountAsset.prototype.availableActions = function availableActions() {
  return {
    edit: this.state === 'draft',
    confirm: this.state === 'draft',
    pause: this.state === 'running',
    resume: this.state === 'paused',
    close: ['running', 'paused'].includes(this.state),
    cancel: this.state !== 'cancel',
    resetToDraft: ['cancel', 'close'].includes(this.state),
  };
};

module.exports = AccountAsset;
