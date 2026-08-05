const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Department = sequelize.define('Department', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: { notEmpty: true },
  },
  companyId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  parentDepartmentId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  managerId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active',
  },
  legacyId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  defaultUserCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  accessRights: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {},
  },
  otherPermissions: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {},
  },
}, {
  tableName: 'departments',
});

module.exports = Department;
