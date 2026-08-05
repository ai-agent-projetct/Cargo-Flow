const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Quotation = sequelize.define('Quotation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  quoteNumber: {
    type: DataTypes.STRING(30),
    allowNull: false,
    unique: true,
    comment: 'Legacy format: QT-YEAR-XXXXX',
  },
  quotationNumber: {
    type: DataTypes.STRING(50),
    allowNull: true,
    unique: true,
    comment: 'New format: QT-SEA/AIR/ROA/RAIL-EXP/IMP/LOC-FCL/LCL/etc/YEAR/00001',
  },
  customerId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('draft', 'sent', 'pending', 'accepted', 'un_accepted', 'approved', 'rejected', 'expired', 'converted', 'cancelled'),
    defaultValue: 'draft',
  },
  mode: {
    type: DataTypes.ENUM('sea', 'air', 'land', 'rail', 'multimodal'),
    allowNull: false,
  },
  // New transport mode field (uppercase, aligned with FF Job)
  transportMode: {
    type: DataTypes.ENUM('SEA', 'AIR', 'ROAD', 'RAIL'),
    allowNull: true,
  },
  direction: {
    type: DataTypes.ENUM('EXPORT', 'IMPORT', 'LOCAL'),
    allowNull: true,
  },
  cargoType: {
    type: DataTypes.ENUM('FCL', 'LCL', 'FTL', 'LTL', 'LSE', 'BULK', 'RORO', 'BREAKBULK'),
    allowNull: true,
  },
  shipmentType: {
    type: DataTypes.ENUM('FCL', 'LCL', 'Air Freight', 'Land Freight', 'Rail Freight'),
    allowNull: true,
  },
  originPortId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  destinationPortId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  originCity: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  destinationCity: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  originCountry: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  destinationCountry: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  carrierId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  incoterms: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: 'EXW, FOB, CIF, DDP, etc.',
  },
  incoterm: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: 'Alias for incoterms (new field)',
  },
  commodity: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  hsCode: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  cargoWeight: {
    type: DataTypes.DECIMAL(12, 3),
    allowNull: true,
  },
  cargoVolume: {
    type: DataTypes.DECIMAL(12, 3),
    allowNull: true,
  },
  cargoWeightUnit: {
    type: DataTypes.ENUM('kg', 'lbs', 'ton', 'mt'),
    defaultValue: 'kg',
  },
  containerCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  containerType: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  freightCharges: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
  },
  originCharges: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
  },
  destinationCharges: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
  },
  customsCharges: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
  },
  insuranceCharges: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
  },
  otherCharges: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
  },
  totalAmount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
  },
  // Rate comparison fields
  totalBuyRate: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    comment: 'Total buy/cost rate',
  },
  totalSellRate: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    comment: 'Total sell rate (= totalAmount)',
  },
  profit: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    comment: 'totalSellRate - totalBuyRate',
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'USD',
  },
  validUntil: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  estimatedTransitDays: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  termsAndConditions: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  approvedBy: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  rejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  surcharges: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  specialRequirements: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  isDangerous: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  isTemperatureControlled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  // House number once job is created
  houseNumber: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'House B/L or AWB number once FF job is created',
  },
  // Links to jobs created from this quotation
  ffJobId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'FF Job created from this quotation',
  },
  serviceJobId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Service Job created from this quotation',
  },
}, {
  tableName: 'quotations',
  hooks: {
    beforeValidate: async (quotation) => {
      const { Op } = require('sequelize');
      const year = new Date().getFullYear();

      // Always set legacy quoteNumber
      if (!quotation.quoteNumber) {
        const random = Math.floor(Math.random() * 90000) + 10000;
        quotation.quoteNumber = `QT-${year}-${random}`;
      }

      // Generate structured quotationNumber if transport fields available
      if (!quotation.quotationNumber && quotation.transportMode && quotation.direction && quotation.cargoType) {
        const modeMap = { SEA: 'SEA', AIR: 'AIR', ROAD: 'ROA', RAIL: 'RAIL' };
        const dirMap = { EXPORT: 'EXP', IMPORT: 'IMP', LOCAL: 'LOC' };
        const modeCode = modeMap[quotation.transportMode] || 'SEA';
        const dirCode = dirMap[quotation.direction] || 'EXP';
        const cargoCode = quotation.cargoType || 'FCL';

        const count = await Quotation.count({
          where: {
            transportMode: quotation.transportMode,
            createdAt: { [Op.gte]: new Date(`${year}-01-01`) },
          },
        });
        const seq = String(count + 1).padStart(5, '0');
        quotation.quotationNumber = `QT-${modeCode}-${dirCode}-${cargoCode}/${year}/${seq}`;
      }
    },
  },
});

module.exports = Quotation;
