const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Join table: which groups a user holds. Assigned from Administration > Users.
const UserGroup = sequelize.define('UserGroup', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  groupId: { type: DataTypes.UUID, allowNull: false },
}, {
  tableName: 'user_groups',
  indexes: [{ unique: true, fields: ['userId', 'groupId'] }],
});

module.exports = UserGroup;
