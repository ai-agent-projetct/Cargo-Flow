const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FFJob = sequelize.define('FFJob', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  jobNumber: {
    type: DataTypes.STRING(40),
    allowNull: false,
    unique: true,
    comment: 'Format: AIR/SEA/ROA/RAIL-E/I/L-CARGO_TYPE-H/N/M-YEAR-SEQ',
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
  transportMode: {
    type: DataTypes.ENUM('AIR', 'SEA', 'ROAD', 'RAIL'),
    allowNull: false,
  },
  direction: {
    type: DataTypes.ENUM('EXPORT', 'IMPORT', 'LOCAL'),
    allowNull: false,
  },
  cargoType: {
    type: DataTypes.ENUM('FCL', 'LCL', 'FTL', 'LTL', 'LSE', 'BULK', 'RORO', 'BREAKBULK', 'CR', 'PLT'),
    allowNull: false,
  },
  serviceType: {
    type: DataTypes.ENUM('H', 'N', 'M'),
    defaultValue: 'H',
    comment: 'H=House, N=NVOCC, M=Master',
  },
  jobType: {
    type: DataTypes.ENUM('AIR_FREIGHT', 'SEA_FREIGHT', 'ROAD_FREIGHT', 'RAIL_FREIGHT'),
    allowNull: false,
  },
  origin: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  originCode: {
    type: DataTypes.STRING(10),
    allowNull: true,
  },
  destination: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  destinationCode: {
    type: DataTypes.STRING(10),
    allowNull: true,
  },
  etd: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Estimated Time of Departure',
  },
  eta: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Estimated Time of Arrival',
  },
  atd: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Actual Time of Departure',
  },
  ata: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Actual Time of Arrival',
  },
  carrier: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  vesselName: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  voyageNumber: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  flightNumber: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  mblNumber: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Master Bill of Lading',
  },
  hblNumber: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'House Bill of Lading',
  },
  awbNumber: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Master Air Waybill',
  },
  hawbNumber: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'House Air Waybill',
  },
  containerNumbers: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array of container numbers',
  },
  packages: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  grossWeight: {
    type: DataTypes.DECIMAL(12, 3),
    allowNull: true,
  },
  chargeableWeight: {
    type: DataTypes.DECIMAL(12, 3),
    allowNull: true,
  },
  volume: {
    type: DataTypes.DECIMAL(12, 3),
    allowNull: true,
  },
  commodity: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  incoterm: {
    type: DataTypes.STRING(10),
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('created', 'booked', 'received', 'confirmed', 'nomination_generated', 'hbl_generated', 'hawb_generated', 'in_transit', 'arrived', 'completed', 'accounting_closure', 'cancelled'),
    defaultValue: 'created',
  },
  revenue: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: '{estReceivable, actReceivable, estPayable, actPayable, estMargin, actMargin}',
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
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false,
  },

  // ── New fields for full House Shipment form ──────────────────────────
  bookingRef: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Nomination No / Booking Reference',
  },
  directShipment: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  courierShipment: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  shipmentDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  salesAgentId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  tags: {
    type: DataTypes.JSON,
    defaultValue: [],
  },

  // Declared weight & volume
  autoUpdateWeight: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  packCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  packUnit: {
    type: DataTypes.STRING(10),
    defaultValue: 'PKG',
  },
  weightUnit: {
    type: DataTypes.STRING(5),
    defaultValue: 'kg',
  },
  netWeight: {
    type: DataTypes.DECIMAL(12, 3),
    allowNull: true,
  },
  volumetricWeight: {
    type: DataTypes.DECIMAL(12, 3),
    allowNull: true,
  },
  volumeUnit: {
    type: DataTypes.STRING(5),
    defaultValue: 'm3',
  },
  cargoReceivedDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  // Customer / Shipper / Consignee
  shipperId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  shipperAccountNumbers: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  consigneeId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  consigneeAccountNumbers: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },

  // Carriage tab
  originCountry: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  destinationCountry: {
    type: DataTypes.STRING(100),
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
  masterShipmentId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Linked Master Shipment (Console) record, if attached',
  },

  // Tab JSON fields
  cutOffDates: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array of {label, datetime}',
  },
  insurance: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: '{insured, insuranceProvider, policyNumber, insuredValue, insuranceCurrency, premium, coverageType}',
  },
  customs: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: '{customsClearanceRequired, hsCode, customsBrokerName, declarationNumber, dutyAmount, customsStatus, remarks}',
  },
  extCarrierBookings: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array of {carrierName, bookingNumber, bookingDate, status}',
  },
  parties: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array of {role, name, contactPerson, email, phone}',
  },
  packageLines: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array of package line items',
  },
  routingLegs: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array of {legNumber, mode, from, to, carrier, vesselFlightNumber, etd, eta}',
  },
  termsAndConditions: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  activityLog: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array of {user, message, timestamp}',
  },
  purchaseOrders: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array of {poNumber, vendorName, amount, status, createdAt}',
  },
}, {
  tableName: 'ff_jobs',
  hooks: {
    beforeValidate: async (job) => {
      if (!job.jobNumber) {
        const { Op } = require('sequelize');
        const year = new Date().getFullYear();

        const modeCode = { AIR: 'AIR', SEA: 'SEA', ROAD: 'ROA', RAIL: 'RAIL' }[job.transportMode] || 'SEA';
        const dirCode = { EXPORT: 'E', IMPORT: 'I', LOCAL: 'L' }[job.direction] || 'E';
        const cargoCode = job.cargoType || 'FCL';
        const svcCode = job.serviceType || 'H';

        const count = await FFJob.count({
          where: {
            transportMode: job.transportMode,
            createdAt: { [Op.gte]: new Date(`${year}-01-01`) },
          },
        });
        const seq = String(count + 1).padStart(5, '0');
        job.jobNumber = `${modeCode}-${dirCode}-${cargoCode}-${svcCode}-${year}-${seq}`;
      }
    },
  },
});

module.exports = FFJob;
