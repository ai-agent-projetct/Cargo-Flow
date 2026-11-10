const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { COSTING_FIELDS, CHARGEABLE_WEIGHT_FIELD } = require('./costingFields');

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
  // Revenue, cost and margin rolled up from this job's charge lines.
  ...COSTING_FIELDS,
  ...CHARGEABLE_WEIGHT_FIELD,
  // Customs and cargo detail the upstream Service Job form carries.
  serviceJobType: { type: DataTypes.STRING(60), allowNull: true },
  bookingNominationNo: { type: DataTypes.STRING(60), allowNull: true },
  transportMode: { type: DataTypes.STRING(20), allowNull: true },
  shipmentType: { type: DataTypes.STRING(30), allowNull: true },
  cargoType: { type: DataTypes.STRING(30), allowNull: true },
  salesAgentId: { type: DataTypes.UUID, allowNull: true },
  clientTag: { type: DataTypes.STRING(80), allowNull: true },
  etd: { type: DataTypes.DATE, allowNull: true },
  eta: { type: DataTypes.DATE, allowNull: true },
  atd: { type: DataTypes.DATE, allowNull: true },
  ata: { type: DataTypes.DATE, allowNull: true },
  grossWeight: { type: DataTypes.DECIMAL(14, 3), allowNull: true, defaultValue: 0 },
  volume: { type: DataTypes.DECIMAL(14, 3), allowNull: true, defaultValue: 0 },
  packUnit: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
  hasCustoms: { type: DataTypes.BOOLEAN, defaultValue: false },
  customsAdCode: { type: DataTypes.STRING(40), allowNull: true },
  customsLocation: { type: DataTypes.STRING(150), allowNull: true },
  customsDeclarationNumber: { type: DataTypes.STRING(60), allowNull: true },
  customsDeclarationDate: { type: DataTypes.DATEONLY, allowNull: true },
  customsClearanceDatetime: { type: DataTypes.DATE, allowNull: true },
  customsProcedureCode: { type: DataTypes.STRING(40), allowNull: true },
  customsBeType: {
    type: DataTypes.STRING(60),
    allowNull: true,
    comment: 'Bill of entry type, e.g. Home Consumption, Bond, Re-export',
  },
  tariffDeterminationNumber: { type: DataTypes.STRING(60), allowNull: true },
  valueDeterminationNumber: { type: DataTypes.STRING(60), allowNull: true },
  boeNumber: { type: DataTypes.STRING(60), allowNull: true },
  boeDate: { type: DataTypes.DATEONLY, allowNull: true },
  ownership: { type: DataTypes.ENUM('self', 'third_party'), allowNull: true },
  ownershipPartnerId: { type: DataTypes.UUID, allowNull: true },
  isHazardous: { type: DataTypes.BOOLEAN, defaultValue: false },
  hazClass: { type: DataTypes.STRING(40), allowNull: true },
  hazUnNumber: { type: DataTypes.STRING(20), allowNull: true },
  hazRemark: { type: DataTypes.TEXT, allowNull: true },
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
