const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('shipment_update', 'quotation_update', 'invoice_due', 'document_uploaded', 'system', 'job_assigned'),
    defaultValue: 'system',
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  readAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  referenceId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  referenceType: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  actionUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high'),
    defaultValue: 'medium',
  },
}, {
  tableName: 'notifications',
});

module.exports = Notification;
