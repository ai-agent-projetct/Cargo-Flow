const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Terms-and-conditions boilerplate selected on a quote
// (upstream: shipment.quote.template).
//
// Templates are filtered on the quote form by transport mode, shipment type
// and cargo type, so an air export quote only offers air export wording.
// `templateFor` separates shipment quotes from service-job quotes.
const QuoteTemplate = sequelize.define('QuoteTemplate', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(150),
    allowNull: false,
    validate: { notEmpty: true },
  },
  bodyHtml: {
    type: DataTypes.TEXT('long'),
    allowNull: false,
    comment: 'Rendered into the quote PDF and the quote notes field',
  },
  templateFor: {
    type: DataTypes.ENUM('shipment', 'job'),
    allowNull: false,
    defaultValue: 'shipment',
  },
  transportMode: {
    type: DataTypes.ENUM('AIR', 'SEA', 'ROAD', 'RAIL', 'COURIER'),
    allowNull: true,
    comment: 'Null = offered for every mode',
  },
  shipmentType: { type: DataTypes.STRING(30), allowNull: true },
  cargoTypes: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Cargo types this template applies to; empty = all',
  },
  serviceJobType: { type: DataTypes.STRING(60), allowNull: true },
  isDefault: { type: DataTypes.BOOLEAN, defaultValue: false },
  sequence: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 },
  companyId: { type: DataTypes.UUID, allowNull: true },
  createdBy: { type: DataTypes.UUID, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'quote_templates',
  indexes: [{ fields: ['templateFor', 'transportMode'] }],
});

module.exports = QuoteTemplate;
