const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Configuration > Settings — a flat key/value store behind the settings panes.
// Values are held as text and cast on the way out by `kind`, which keeps the
// schema stable as panes gain fields.
const AppSetting = sequelize.define('AppSetting', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  category: {
    type: DataTypes.STRING(40), allowNull: false,
    comment: 'general | crm | freight | freight_schedule | freight_booking | tms | website | customs | invoicing',
  },
  key: { type: DataTypes.STRING(80), allowNull: false },
  value: { type: DataTypes.TEXT, allowNull: true },
  kind: { type: DataTypes.ENUM('bool', 'text', 'number', 'select'), defaultValue: 'text' },
  // Secrets are returned masked unless explicitly revealed.
  isSecret: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  tableName: 'app_settings',
  indexes: [{ unique: true, fields: ['category', 'key'] }],
});

AppSetting.prototype.typed = function typed() {
  if (this.kind === 'bool') return this.value === 'true';
  if (this.kind === 'number') return this.value === null || this.value === '' ? null : Number(this.value);
  return this.value;
};

module.exports = AppSetting;
