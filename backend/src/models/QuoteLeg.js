const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// One leg of a multimodal quote (upstream: shipment.quote.multimodal.line).
//
// A multimodal quote is one quote number covering several carriage legs -
// "truck to Jebel Ali, ocean to Nhava Sheva, truck to Gandhinagar" is three
// legs under one quote. Each leg carries its own transport mode, route,
// carrier, cargo figures, schedule and charge lines, so costs and documents
// are attributable per leg while revenue and profit roll up to the quote.
//
// `legSequence` is the order of carriage (1..n). `ChargeLine.multimodalLineId`
// points here, and `ChargeLine.modeTypeSequence` mirrors `legSequence` so a
// charge can be read without joining.
const QuoteLeg = sequelize.define('QuoteLeg', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  quotationId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  legSequence: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    comment: 'Order of carriage: 1 = first leg',
  },
  transportMode: {
    type: DataTypes.ENUM('AIR', 'SEA', 'ROAD', 'RAIL', 'COURIER'),
    allowNull: false,
  },
  isRailTransportMode: { type: DataTypes.BOOLEAN, defaultValue: false },
  isCourierLeg: { type: DataTypes.BOOLEAN, defaultValue: false },
  shipmentType: { type: DataTypes.STRING(30), allowNull: true },
  cargoType: { type: DataTypes.STRING(30), allowNull: true },
  consolidationType: { type: DataTypes.STRING(40), allowNull: true },
  serviceMode: { type: DataTypes.STRING(40), allowNull: true },
  serviceJobType: { type: DataTypes.STRING(60), allowNull: true },
  packagingMode: { type: DataTypes.ENUM('container', 'package'), allowNull: true },

  // --- parties on this leg (an agent or co-loader can differ per leg) ------
  shipperId: { type: DataTypes.UUID, allowNull: true },
  shipperAddressId: { type: DataTypes.UUID, allowNull: true },
  consigneeId: { type: DataTypes.UUID, allowNull: true },
  consigneeAddressId: { type: DataTypes.UUID, allowNull: true },
  agentId: { type: DataTypes.UUID, allowNull: true },
  agentAddressId: { type: DataTypes.UUID, allowNull: true },
  coLoaderId: { type: DataTypes.UUID, allowNull: true },
  coLoaderAddressId: { type: DataTypes.UUID, allowNull: true },

  // --- route ---------------------------------------------------------------
  originCountry: { type: DataTypes.STRING(100), allowNull: true },
  originLocation: { type: DataTypes.STRING(200), allowNull: true },
  originPortId: { type: DataTypes.UUID, allowNull: true },
  destinationCountry: { type: DataTypes.STRING(100), allowNull: true },
  destinationLocation: { type: DataTypes.STRING(200), allowNull: true },
  destinationPortId: { type: DataTypes.UUID, allowNull: true },
  pickupLocationType: { type: DataTypes.STRING(60), allowNull: true },
  deliveryLocationType: { type: DataTypes.STRING(60), allowNull: true },
  pickupAddress: { type: DataTypes.TEXT, allowNull: true },
  deliveryAddress: { type: DataTypes.TEXT, allowNull: true },
  pickupZipcode: { type: DataTypes.STRING(20), allowNull: true },
  deliveryZipcode: { type: DataTypes.STRING(20), allowNull: true },
  pickupContact: { type: DataTypes.STRING(150), allowNull: true },
  deliveryContact: { type: DataTypes.STRING(150), allowNull: true },
  pickupDatetime: { type: DataTypes.DATE, allowNull: true },
  deliveryDatetime: { type: DataTypes.DATE, allowNull: true },

  // --- carriage ------------------------------------------------------------
  carrierId: { type: DataTypes.UUID, allowNull: true },
  carrierServiceType: { type: DataTypes.STRING(80), allowNull: true },
  incotermId: { type: DataTypes.UUID, allowNull: true },
  referenceNumber: { type: DataTypes.STRING(80), allowNull: true },
  transitTime: { type: DataTypes.STRING(40), allowNull: true },
  transitDays: { type: DataTypes.INTEGER, allowNull: true },
  freeDays: { type: DataTypes.STRING(40), allowNull: true },
  estimatedPickup: { type: DataTypes.DATE, allowNull: true },
  expectedDelivery: { type: DataTypes.DATE, allowNull: true },
  scheduleId: { type: DataTypes.UUID, allowNull: true },
  airScheduleId: { type: DataTypes.UUID, allowNull: true },
  vesselName: { type: DataTypes.STRING(120), allowNull: true },
  voyageNumber: { type: DataTypes.STRING(50), allowNull: true },
  flightNumber: { type: DataTypes.STRING(30), allowNull: true },
  aircraftType: { type: DataTypes.ENUM('coa', 'pax'), allowNull: true },
  truckNumber: { type: DataTypes.STRING(40), allowNull: true },
  addVesselDetails: { type: DataTypes.BOOLEAN, defaultValue: false },
  addFlightDetails: { type: DataTypes.BOOLEAN, defaultValue: false },
  addTransportationDetails: { type: DataTypes.BOOLEAN, defaultValue: false },

  // --- cargo on this leg ---------------------------------------------------
  packUnit: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
  packUnitUom: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'PKG' },
  grossWeight: { type: DataTypes.DECIMAL(14, 3), allowNull: true, defaultValue: 0 },
  netWeight: { type: DataTypes.DECIMAL(14, 3), allowNull: true, defaultValue: 0 },
  weightUom: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'kg' },
  volume: { type: DataTypes.DECIMAL(14, 3), allowNull: true, defaultValue: 0 },
  volumeUom: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'm3' },
  weightVolume: { type: DataTypes.DECIMAL(14, 3), allowNull: true, defaultValue: 0 },
  chargeableWeight: { type: DataTypes.DECIMAL(14, 3), allowNull: true, defaultValue: 0 },
  chargeableVolume: { type: DataTypes.DECIMAL(14, 3), allowNull: true, defaultValue: 0 },
  chargeableBasis: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: 'How chargeableWeight was arrived at: weight | volumetric | measurement | per_container | per_truck',
  },
  volumetricDivisor: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    comment: 'cm3 per kg; overrides the mode default (air 6000, courier 5000)',
  },
  containerCount: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
  truckCount: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
  totalTeu: { type: DataTypes.DECIMAL(10, 2), allowNull: true, defaultValue: 0 },
  containerLines: { type: DataTypes.JSON, allowNull: true },
  cargoLines: { type: DataTypes.JSON, allowNull: true },
  autoUpdateWeightVolume: { type: DataTypes.BOOLEAN, defaultValue: true },
  isPackageGroup: { type: DataTypes.BOOLEAN, defaultValue: false },
  cargoSpec: { type: DataTypes.STRING(200), allowNull: true },

  // --- special cargo -------------------------------------------------------
  isDangerousGood: { type: DataTypes.BOOLEAN, defaultValue: false },
  dangerousGoodNote: { type: DataTypes.TEXT, allowNull: true },
  hazClass: { type: DataTypes.STRING(40), allowNull: true },
  hazUnNumber: { type: DataTypes.STRING(20), allowNull: true },
  isStackable: { type: DataTypes.BOOLEAN, defaultValue: true },
  isTemperatureControl: { type: DataTypes.BOOLEAN, defaultValue: false },
  temperatureDetails: { type: DataTypes.STRING(120), allowNull: true },
  isOutOfGauge: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Out-of-gauge / oversized cargo on this leg',
  },
  outOfGaugeDetails: { type: DataTypes.STRING(200), allowNull: true },

  goodsValue: { type: DataTypes.DECIMAL(16, 2), allowNull: true, defaultValue: 0 },
  goodsValueCurrency: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'AED' },
  insuranceValue: { type: DataTypes.DECIMAL(16, 2), allowNull: true, defaultValue: 0 },
  insuranceValueCurrency: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'AED' },

  // --- rolled up from this leg's charge lines -------------------------------
  totalCostAmount: { type: DataTypes.DECIMAL(16, 4), allowNull: true, defaultValue: 0 },
  totalSellAmount: { type: DataTypes.DECIMAL(16, 4), allowNull: true, defaultValue: 0 },
  estimatedMargin: { type: DataTypes.DECIMAL(16, 4), allowNull: true, defaultValue: 0 },
  allInclusiveSellRate: { type: DataTypes.DECIMAL(16, 4), allowNull: true, defaultValue: 0 },

  // --- selection + conversion ----------------------------------------------
  selectedCarrierId: { type: DataTypes.UUID, allowNull: true },
  selectedIncotermId: { type: DataTypes.UUID, allowNull: true },
  selectedCarrierServiceType: { type: DataTypes.STRING(80), allowNull: true },
  selectedTransitTime: { type: DataTypes.INTEGER, allowNull: true },
  multiCarrierQuote: { type: DataTypes.BOOLEAN, defaultValue: false },
  activeTab: { type: DataTypes.BOOLEAN, defaultValue: false },

  state: {
    type: DataTypes.ENUM('draft', 'to_approve', 'approved', 'sent', 'accept', 'reject', 'cancel', 'expire'),
    allowNull: false,
    defaultValue: 'draft',
  },
  convertedShipmentId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'House shipment this leg became',
  },
  isConverted: { type: DataTypes.BOOLEAN, defaultValue: false },

  transshipment: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Leg involves a transshipment / change of carrier mid-route',
  },
  transshipmentPort: { type: DataTypes.STRING(200), allowNull: true },

  remarks: { type: DataTypes.TEXT, allowNull: true },
  note: { type: DataTypes.TEXT, allowNull: true },
  declineMessage: { type: DataTypes.TEXT, allowNull: true },
  companyId: { type: DataTypes.UUID, allowNull: true },
  currency: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'AED' },
}, {
  tableName: 'quote_legs',
  indexes: [
    { fields: ['quotationId', 'legSequence'] },
    { fields: ['transportMode'] },
    { fields: ['convertedShipmentId'] },
  ],
});

module.exports = QuoteLeg;
