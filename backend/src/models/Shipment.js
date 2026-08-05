const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Shipment = sequelize.define('Shipment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  shipmentNumber: {
    type: DataTypes.STRING(30),
    allowNull: false,
    unique: true,
  },
  quotationId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  customerId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  shipperId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  consigneeId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  assignedTo: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('booking_confirmed', 'cargo_received', 'customs_clearance', 'loaded', 'departed', 'in_transit', 'arrived', 'delivered', 'completed', 'cancelled'),
    defaultValue: 'booking_confirmed',
  },
  mode: {
    type: DataTypes.ENUM('sea', 'air', 'land', 'rail', 'multimodal'),
    allowNull: false,
  },
  shipmentType: {
    type: DataTypes.ENUM('FCL', 'LCL', 'Air Freight', 'Land Freight', 'Rail Freight'),
    allowNull: true,
  },
  carrierId: {
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
  flightNumber: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  masterBL: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Master Bill of Lading / Airway Bill',
  },
  houseBL: {
    type: DataTypes.STRING(50),
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
  originAddress: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  destinationAddress: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  incoterms: {
    type: DataTypes.STRING(10),
    allowNull: true,
  },
  commodity: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  hsCode: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  cargoDescription: {
    type: DataTypes.TEXT,
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
  numberOfPackages: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  packageType: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  containerCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  containerType: {
    type: DataTypes.STRING(30),
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
  temperatureRange: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  estimatedDeparture: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  estimatedArrival: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  actualDeparture: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  actualArrival: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  deliveredAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  customsStatus: {
    type: DataTypes.ENUM('pending', 'in_progress', 'cleared', 'held', 'not_required'),
    defaultValue: 'pending',
  },
  insuranceValue: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
  },
  insuranceCurrency: {
    type: DataTypes.STRING(10),
    defaultValue: 'USD',
  },
  declaredValue: {
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
  internalNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  currentLocation: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  scheduleId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'shipments',
  hooks: {
    beforeValidate: async (shipment) => {
      if (!shipment.shipmentNumber) {
        const year = new Date().getFullYear();
        const random = Math.floor(Math.random() * 900000) + 100000;
        shipment.shipmentNumber = `CF-${year}-${random}`;
      }
    },
  },
});

module.exports = Shipment;
