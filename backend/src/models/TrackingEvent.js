const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TrackingEvent = sequelize.define('TrackingEvent', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  shipmentId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  eventType: {
    type: DataTypes.ENUM(
      'booking_confirmed', 'cargo_received', 'customs_export', 'customs_import',
      'loaded_on_vessel', 'departed', 'arrived_at_port', 'transshipment',
      'customs_clearance', 'out_for_delivery', 'delivered', 'exception', 'other'
    ),
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  location: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  portId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  eventDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  vesselName: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  voyageNumber: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
}, {
  tableName: 'tracking_events',
});

module.exports = TrackingEvent;
