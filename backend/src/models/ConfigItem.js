const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Generic backing store for the Configuration lookup lists that have no model
// of their own. `category` is the config registry id, so one table serves the
// many small screens without inventing a table per list.
const ConfigItem = sequelize.define('ConfigItem', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  category: { type: DataTypes.STRING(60), allowNull: false },

  name: { type: DataTypes.STRING(200), allowNull: true },
  code: { type: DataTypes.STRING(60), allowNull: true },
  value: { type: DataTypes.STRING(200), allowNull: true },
  note: { type: DataTypes.TEXT, allowNull: true },
  country: { type: DataTypes.STRING(120), allowNull: true },
  days: { type: DataTypes.DECIMAL(14, 4), allowNull: true },
  dateFrom: { type: DataTypes.DATEONLY, allowNull: true },
  dateTo: { type: DataTypes.DATEONLY, allowNull: true },

  sequence: { type: DataTypes.INTEGER, defaultValue: 10 },
  active: { type: DataTypes.BOOLEAN, defaultValue: true },
  company: { type: DataTypes.STRING(120), allowNull: true },
}, {
  tableName: 'config_items',
  indexes: [{ fields: ['category'] }],
});

module.exports = ConfigItem;
