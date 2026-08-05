const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Event = sequelize.define('Event', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  eventNumber: {
    type: DataTypes.STRING(30),
    allowNull: false,
    unique: true,
  },
  entityType: {
    type: DataTypes.ENUM('SHIPMENT', 'FF_JOB', 'SERVICE_JOB', 'QUOTATION'),
    allowNull: false,
  },
  entityId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  eventType: {
    type: DataTypes.ENUM(
      'CREATED',
      'CONFIRMED',
      'DEPARTED',
      'ARRIVED',
      'CUSTOMS_CLEARED',
      'DELIVERED',
      'INVOICED',
      'PAID',
      'CANCELLED',
      'CUSTOM'
    ),
    allowNull: false,
  },
  eventDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  location: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  attachments: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array of {name, url, type}',
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Whether this event is visible to the customer',
  },
}, {
  tableName: 'events',
  hooks: {
    beforeValidate: async (event) => {
      if (!event.eventNumber) {
        const { Op } = require('sequelize');
        const year = new Date().getFullYear();
        const count = await Event.count({
          where: {
            createdAt: { [Op.gte]: new Date(`${year}-01-01`) },
          },
        });
        const seq = String(count + 1).padStart(5, '0');
        event.eventNumber = `EVT-${year}-${seq}`;
      }
    },
  },
});

module.exports = Event;
