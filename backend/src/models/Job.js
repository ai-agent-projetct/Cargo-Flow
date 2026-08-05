const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Job = sequelize.define('Job', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  jobNumber: {
    type: DataTypes.STRING(30),
    allowNull: false,
    unique: true,
  },
  shipmentId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  customerId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  type: {
    type: DataTypes.ENUM('customs_clearance', 'delivery', 'pickup', 'documentation', 'inspection', 'survey', 'other'),
    defaultValue: 'other',
  },
  status: {
    type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'cancelled', 'on_hold'),
    defaultValue: 'pending',
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
    defaultValue: 'medium',
  },
  assignedTo: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  dueDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  estimatedCost: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
  },
  actualCost: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'USD',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  tags: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
}, {
  tableName: 'jobs',
  hooks: {
    beforeValidate: async (job) => {
      if (!job.jobNumber) {
        const year = new Date().getFullYear();
        const random = Math.floor(Math.random() * 90000) + 10000;
        job.jobNumber = `JOB-${year}-${random}`;
      }
    },
  },
});

module.exports = Job;
