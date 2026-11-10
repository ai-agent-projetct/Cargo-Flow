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
  // New transport mode field (uppercase, aligned with FF Job).
  // COURIER and MULTIMODAL were added with the multimodal quote work: a
  // door-to-door quote covering several legs has no single carriage mode, and
  // its per-leg modes live on `quote_legs`.
  transportMode: {
    type: DataTypes.ENUM('SEA', 'AIR', 'ROAD', 'RAIL', 'COURIER', 'MULTIMODAL'),
    allowNull: true,
  },
  direction: {
    type: DataTypes.ENUM('EXPORT', 'IMPORT', 'LOCAL', 'CROSS_TRADE'),
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

  // --- CRM funnel link ------------------------------------------------------
  // A quote normally comes from an opportunity; a quote raised straight from
  // the customer portal has none, which is what `source` records.
  opportunityId: { type: DataTypes.UUID, allowNull: true },
  salesTeamId: { type: DataTypes.UUID, allowNull: true },
  pricingTeamId: { type: DataTypes.UUID, allowNull: true },
  quoteTemplateId: { type: DataTypes.UUID, allowNull: true },
  source: {
    type: DataTypes.ENUM('system', 'customer', 'portal'),
    allowNull: false,
    defaultValue: 'system',
  },
  generatedFromPortal: { type: DataTypes.BOOLEAN, defaultValue: false },
  quoteFor: {
    type: DataTypes.ENUM('shipment', 'job'),
    allowNull: false,
    defaultValue: 'shipment',
  },
  shipmentCount: {
    type: DataTypes.ENUM('single', 'multiple'),
    allowNull: false,
    defaultValue: 'single',
  },
  serviceJobType: { type: DataTypes.STRING(60), allowNull: true },

  // --- multimodal -----------------------------------------------------------
  // A multimodal quote carries its carriage in `quote_legs` rather than in the
  // header route fields, and prices each leg with its own charge lines. The
  // header fields stay populated with the first and last leg so existing
  // screens and reports keep working.
  isMultimodal: { type: DataTypes.BOOLEAN, defaultValue: false },
  selectedMultimodalMode: {
    type: DataTypes.ENUM('SEA', 'AIR', 'ROAD', 'RAIL', 'COURIER'),
    allowNull: true,
    comment: 'Leg the customer accepted when alternatives were offered',
  },
  legCount: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },

  // --- vendor rate request state -------------------------------------------
  quoteRateRequestState: {
    type: DataTypes.ENUM(
      'draft',
      'vendor_rate_requested',
      'vendor_rate_submitted',
      'vendor_rate_renegotiate_requested',
      'vendor_rate_renegotiate_submitted',
      'pricing_approval',
      'to_approve',
      'approved',
    ),
    allowNull: false,
    defaultValue: 'draft',
  },
  currentRateRequestId: { type: DataTypes.UUID, allowNull: true },

  // --- parties beyond the customer -----------------------------------------
  shipperId: { type: DataTypes.UUID, allowNull: true },
  consigneeId: { type: DataTypes.UUID, allowNull: true },
  agentId: { type: DataTypes.UUID, allowNull: true },
  coLoaderId: { type: DataTypes.UUID, allowNull: true },
  clientTag: { type: DataTypes.STRING(80), allowNull: true },

  // --- routing detail -------------------------------------------------------
  consolidationType: { type: DataTypes.STRING(40), allowNull: true },
  serviceMode: { type: DataTypes.STRING(40), allowNull: true },
  carrierServiceType: { type: DataTypes.STRING(80), allowNull: true },
  referenceNumber: { type: DataTypes.STRING(80), allowNull: true },
  pickupLocationType: { type: DataTypes.STRING(60), allowNull: true },
  deliveryLocationType: { type: DataTypes.STRING(60), allowNull: true },
  pickupAddress: { type: DataTypes.TEXT, allowNull: true },
  deliveryAddress: { type: DataTypes.TEXT, allowNull: true },
  pickupZipcode: { type: DataTypes.STRING(20), allowNull: true },
  deliveryZipcode: { type: DataTypes.STRING(20), allowNull: true },
  estimatedPickup: { type: DataTypes.DATE, allowNull: true },
  expectedDelivery: { type: DataTypes.DATE, allowNull: true },
  freeDays: { type: DataTypes.STRING(40), allowNull: true },
  enableQuoteRouting: { type: DataTypes.BOOLEAN, defaultValue: false },
  routes: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Ordered routing legs shown on the quote PDF',
  },

  // --- cargo figures --------------------------------------------------------
  packUnit: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
  packUnitUom: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'PKG' },
  netWeight: { type: DataTypes.DECIMAL(14, 3), allowNull: true, defaultValue: 0 },
  weightVolume: { type: DataTypes.DECIMAL(14, 3), allowNull: true, defaultValue: 0 },
  chargeableWeight: { type: DataTypes.DECIMAL(14, 3), allowNull: true, defaultValue: 0 },
  chargeableVolume: { type: DataTypes.DECIMAL(14, 3), allowNull: true, defaultValue: 0 },
  chargeableBasis: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: 'weight | volumetric | measurement | per_container | per_truck',
  },
  volumetricDivisor: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    comment: 'cm3 per kg override; air defaults to 6000, courier to 5000',
  },
  totalTeu: { type: DataTypes.DECIMAL(10, 2), allowNull: true, defaultValue: 0 },
  truckCount: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
  containerLines: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
  cargoLines: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
  isPackageGroup: { type: DataTypes.BOOLEAN, defaultValue: false },
  packagingMode: { type: DataTypes.ENUM('container', 'package'), allowNull: true },
  goodsValue: { type: DataTypes.DECIMAL(16, 2), allowNull: true, defaultValue: 0 },
  goodsValueCurrency: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'AED' },
  insuranceValue: { type: DataTypes.DECIMAL(16, 2), allowNull: true, defaultValue: 0 },
  insuranceValueCurrency: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'AED' },

  // --- special cargo --------------------------------------------------------
  hazClass: { type: DataTypes.STRING(40), allowNull: true },
  hazUnNumber: { type: DataTypes.STRING(20), allowNull: true },
  dangerousGoodNote: { type: DataTypes.TEXT, allowNull: true },
  isStackable: { type: DataTypes.BOOLEAN, defaultValue: true },
  temperatureDetails: { type: DataTypes.STRING(120), allowNull: true },
  isOutOfGauge: { type: DataTypes.BOOLEAN, defaultValue: false },
  outOfGaugeDetails: { type: DataTypes.STRING(200), allowNull: true },
  isCourierShipment: { type: DataTypes.BOOLEAN, defaultValue: false },
  serviceType: { type: DataTypes.ENUM('Standard', 'Priority'), allowNull: true },

  // --- air / sea carriage details ------------------------------------------
  flightNumber: { type: DataTypes.STRING(30), allowNull: true },
  aircraftType: { type: DataTypes.ENUM('coa', 'pax'), allowNull: true },
  addFlightDetails: { type: DataTypes.BOOLEAN, defaultValue: false },
  addVesselDetails: { type: DataTypes.BOOLEAN, defaultValue: false },
  addTransportationDetails: { type: DataTypes.BOOLEAN, defaultValue: false },
  scheduleId: { type: DataTypes.UUID, allowNull: true },

  // --- charge-line roll-up (kept in step with ChargeLine by chargeRollup) ---
  estimatedRevenue: { type: DataTypes.DECIMAL(16, 2), allowNull: true, defaultValue: 0 },
  estimatedCost: { type: DataTypes.DECIMAL(16, 2), allowNull: true, defaultValue: 0 },
  estimatedMargin: { type: DataTypes.DECIMAL(16, 2), allowNull: true, defaultValue: 0 },
  estimatedMarginPercentage: { type: DataTypes.DECIMAL(9, 4), allowNull: true, defaultValue: 0 },
  allInclusiveSellRate: { type: DataTypes.DECIMAL(16, 2), allowNull: true, defaultValue: 0 },
  isGroupSimilarCharge: { type: DataTypes.BOOLEAN, defaultValue: false },
  divideValue: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
  hideTotalInWords: { type: DataTypes.BOOLEAN, defaultValue: false },
  showInclSingleLine: { type: DataTypes.BOOLEAN, defaultValue: false },
  multiCarrierQuote: { type: DataTypes.BOOLEAN, defaultValue: false },
  selectedCarrierId: { type: DataTypes.UUID, allowNull: true },
  selectedTransitTime: { type: DataTypes.INTEGER, allowNull: true },

  // --- approval + revision --------------------------------------------------
  allowApproval: { type: DataTypes.BOOLEAN, defaultValue: false },
  approvingUserId: { type: DataTypes.UUID, allowNull: true },
  approverRejectReason: { type: DataTypes.STRING(250), allowNull: true },
  signedBy: { type: DataTypes.STRING(150), allowNull: true },
  signedOn: { type: DataTypes.DATE, allowNull: true },
  declineMessage: { type: DataTypes.TEXT, allowNull: true },
  changeReason: { type: DataTypes.STRING(150), allowNull: true },
  isRenegotiated: { type: DataTypes.BOOLEAN, defaultValue: false },
  portalCancelReason: { type: DataTypes.STRING(250), allowNull: true },
  originalQuoteId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Quote this one supplements or revises',
  },
  cancelledQuoteId: { type: DataTypes.UUID, allowNull: true },
  isSupplementary: { type: DataTypes.BOOLEAN, defaultValue: false },
  supplementaryLastNo: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
  isDuplicated: { type: DataTypes.BOOLEAN, defaultValue: false },
  tags: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
  accessToken: { type: DataTypes.STRING(64), allowNull: true },
  companyId: { type: DataTypes.UUID, allowNull: true },
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
