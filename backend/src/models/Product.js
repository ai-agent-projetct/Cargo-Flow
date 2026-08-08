const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Accounting > Customers/Vendors > Products — mirrors product.template.
// These are the charge codes that appear on invoice lines, so the same list
// backs both the Customers and Vendors menus, filtered by canBeSold /
// canBePurchased the way the demo's "Can be Sold" chip does.
const Product = sequelize.define('Product', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  internalReference: { type: DataTypes.STRING(60), allowNull: true, comment: 'default_code' },
  name: { type: DataTypes.STRING(200), allowNull: false },
  salesPrice: { type: DataTypes.DECIMAL(14, 2), defaultValue: 1 },
  cost: { type: DataTypes.DECIMAL(14, 2), defaultValue: 0 },

  // Tax chips shown in the list.
  customerTaxes: { type: DataTypes.JSON, defaultValue: [] },
  vendorTaxes: { type: DataTypes.JSON, defaultValue: [] },

  canBeSold: { type: DataTypes.BOOLEAN, defaultValue: true },
  canBePurchased: { type: DataTypes.BOOLEAN, defaultValue: true },
  category: { type: DataTypes.STRING(120), allowNull: true },
  uom: { type: DataTypes.STRING(40), defaultValue: 'Units' },
  incomeAccount: { type: DataTypes.STRING(120), allowNull: true },
  expenseAccount: { type: DataTypes.STRING(120), allowNull: true },
  active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'products',
  indexes: [{ fields: ['name'] }],
});

module.exports = Product;
