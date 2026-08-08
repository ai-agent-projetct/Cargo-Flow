const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Mirrors res.groups: a named role inside a category, e.g. Operations / Associate.
// Users hold many groups; a permission is granted if ANY of them grants it.
const PermissionGroup = sequelize.define('PermissionGroup', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  category: { type: DataTypes.STRING(60), allowNull: false, comment: 'Operations, Sales & CRM, …' },
  name: { type: DataTypes.STRING(80), allowNull: false },
  // "Operations / Associate" — what the demo shows in the ACL table.
  fullName: { type: DataTypes.STRING(160), allowNull: false },
  description: { type: DataTypes.STRING(250), allowNull: true },
  // "User: Own Documents Only" restricts to rows the user created. This is the
  // record-level rule that sits alongside the model-level ACL.
  ownDocumentsOnly: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  tableName: 'permission_groups',
  indexes: [{ unique: true, fields: ['category', 'name'] }],
});

module.exports = PermissionGroup;
