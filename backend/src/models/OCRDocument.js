const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// "OCR Document" - Operations > OCR Document.
// Stores uploaded shipment documents processed via OCR with extracted payload JSON.
const OCRDocument = sequelize.define('OCRDocument', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  fileName: { type: DataTypes.STRING(255), allowNull: false },
  shipmentRef: { type: DataTypes.STRING(60), allowNull: true },
  ffJobId: { type: DataTypes.UUID, allowNull: true },
  filePath: { type: DataTypes.STRING(500), allowNull: true },
  charge: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  errorMessage: { type: DataTypes.TEXT, allowNull: true },
  ocrPayload: { type: DataTypes.JSON, defaultValue: {} },
  createdBy: { type: DataTypes.UUID, allowNull: true },
}, {
  tableName: 'ocr_documents',
});

module.exports = OCRDocument;
