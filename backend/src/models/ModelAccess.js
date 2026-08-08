const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Mirrors ir.model.access: one row per (model, group) granting read/write/
// create/delete. Permissions are additive across a user's groups.
const ModelAccess = sequelize.define('ModelAccess', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  // Internal model key, e.g. 'house.shipment'. `label` is what the denial
  // message shows the user: "'House Shipment' (house.shipment)".
  model: { type: DataTypes.STRING(80), allowNull: false },
  label: { type: DataTypes.STRING(120), allowNull: false },
  groupId: { type: DataTypes.UUID, allowNull: true, comment: 'null = applies to every user' },

  permRead: { type: DataTypes.BOOLEAN, defaultValue: false },
  permWrite: { type: DataTypes.BOOLEAN, defaultValue: false },
  permCreate: { type: DataTypes.BOOLEAN, defaultValue: false },
  permDelete: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  tableName: 'model_access',
  indexes: [{ fields: ['model'] }, { fields: ['groupId'] }],
});

module.exports = ModelAccess;
