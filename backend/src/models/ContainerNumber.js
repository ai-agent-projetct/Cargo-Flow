const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// "Container Number" configuration master - Operations > Container Number.
const ContainerNumber = sequelize.define('ContainerNumber', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  containerNumber: {
    type: DataTypes.STRING(30),
    allowNull: false,
    unique: true,
  },
  status: {
    type: DataTypes.ENUM('unused', 'used'),
    defaultValue: 'unused',
  },
  linkedPackageId: { type: DataTypes.UUID, allowNull: true },
  linkedShipmentNumber: { type: DataTypes.STRING(60), allowNull: true },
}, {
  tableName: 'container_numbers',
});

module.exports = ContainerNumber;
