const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Generic master-data record used by Administration > Manage (Languages,
// Container Category, Truck Number, Vessels, Countries, etc.) - one shared
// table keyed by `category` so each of the ~20 simple master lists doesn't
// need its own model/table.
const MasterDataItem = sequelize.define('MasterDataItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  category: {
    type: DataTypes.STRING(60),
    allowNull: false,
  },
  code: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  name: {
    type: DataTypes.STRING(150),
    allowNull: false,
    validate: { notEmpty: true },
  },
  extra: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  extra2: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  extra3: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  tableName: 'master_data_items',
});

module.exports = MasterDataItem;
