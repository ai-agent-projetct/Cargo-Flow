const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ServiceJob = sequelize.define('ServiceJob', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  jobNumber: {
    type: DataTypes.STRING(30),
    allowNull: false,
    unique: true,
    comment: 'Format: SVC-YEAR-SEQ',
  },
  quotationId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  customerId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  companyId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  serviceType: {
    type: DataTypes.ENUM(
      'CUSTOMS_CLEARANCE',
      'TRUCKING',
      'WAREHOUSING',
      'INSURANCE',
      'INSPECTION',
      'FUMIGATION',
      'SURVEYING',
      'DOCUMENTATION'
    ),
    allowNull: false,
  },
  direction: {
    type: DataTypes.ENUM('EXPORT', 'IMPORT', 'LOCAL'),
    defaultValue: 'LOCAL',
  },
  origin: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  destination: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  requestDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  completionDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'cancelled'),
    defaultValue: 'pending',
  },
  charges: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array of {service, description, amount, currency}',
  },
  totalAmount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'USD',
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  assignedTo: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  documents: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array of {type, name, url, uploadedAt}',
  },
  parties: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array of {role, name, address, contact}',
  },
  routingLegs: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  activityLog: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  termsAndConditions: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false,
  },
}, {
  tableName: 'service_jobs',
  hooks: {
    beforeValidate: async (job) => {
      if (!job.jobNumber) {
        const { Op } = require('sequelize');
        const year = new Date().getFullYear();
        const count = await ServiceJob.count({
          where: {
            createdAt: { [Op.gte]: new Date(`${year}-01-01`) },
          },
        });
        const seq = String(count + 1).padStart(5, '0');
        job.jobNumber = `SVC-${year}-${seq}`;
      }
    },
  },
});

module.exports = ServiceJob;
