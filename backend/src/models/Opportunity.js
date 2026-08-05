const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Opportunity = sequelize.define('Opportunity', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  customerId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  contactName: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  contactEmail: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  contactPhone: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  companyId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  stage: {
    type: DataTypes.ENUM('new', 'qualified', 'proposition', 'negotiation', 'won', 'lost'),
    defaultValue: 'new',
  },
  transportMode: {
    type: DataTypes.ENUM('SEA', 'AIR', 'ROAD', 'RAIL', 'MULTIMODAL'),
    defaultValue: 'SEA',
  },
  direction: {
    type: DataTypes.ENUM('EXPORT', 'IMPORT', 'LOCAL'),
    defaultValue: 'EXPORT',
  },
  origin: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  destination: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  estimatedRevenue: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
  },
  probability: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
    comment: 'Probability in percent (0-100)',
  },
  expectedCloseDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  priority: {
    type: DataTypes.ENUM('low', 'normal', 'high'),
    defaultValue: 'normal',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  assignedTo: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  lostReason: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  wonDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
}, {
  tableName: 'opportunities',
  timestamps: true,
});

module.exports = Opportunity;
