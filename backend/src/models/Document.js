const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Document = sequelize.define('Document', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  shipmentId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  jobId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  quotationId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  customerId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  documentType: {
    type: DataTypes.ENUM('bill_of_lading', 'air_waybill', 'commercial_invoice', 'packing_list', 'certificate_of_origin', 'customs_declaration', 'insurance', 'delivery_order', 'arrival_notice', 'other'),
    defaultValue: 'other',
  },
  name: {
    type: DataTypes.STRING(300),
    allowNull: false,
  },
  originalName: {
    type: DataTypes.STRING(300),
    allowNull: false,
  },
  filePath: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  fileSize: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  mimeType: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  isConfidential: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  uploadedBy: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  expiryDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  referenceNumber: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
}, {
  tableName: 'documents',
});

module.exports = Document;
