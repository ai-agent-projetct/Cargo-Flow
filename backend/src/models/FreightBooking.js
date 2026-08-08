const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// "Freight Booking > Bookings" — mirrors freight.booking.request.
//
// The whole module hinges on `transportCode`: SEA and AIR are two independent
// lifecycles with their own status field, their own buttons and their own tabs.
const FreightBooking = sequelize.define('FreightBooking', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  bookingReference: {
    // Not unique: the demo's per-company sequences legitimately reuse a
    // reference across operating companies (BR202500001 exists twice).
    type: DataTypes.STRING(60), allowNull: false,
    comment: 'name — BR2024000022, MY-BR202500013, C000136-BR202500011',
  },
  bookingNumber: { type: DataTypes.STRING(80), allowNull: true, comment: 'Carrier-side UUID' },

  transportCode: { type: DataTypes.ENUM('SEA', 'AIR'), allowNull: false, defaultValue: 'AIR' },
  modeType: { type: DataTypes.ENUM('sea', 'land', 'air'), defaultValue: 'air' },

  // SEA lifecycle.
  status: {
    type: DataTypes.ENUM('init', 'pending', 'success', 'fail', 'cancel'),
    defaultValue: 'init',
  },
  // AIR lifecycle.
  airStatus: {
    type: DataTypes.ENUM(
      'created', 'booking_created', 'booking_confirmed', 'booking_rejected',
      'booking_failed', 'booking_cancel_req', 'booking_cancelled',
    ),
    defaultValue: 'created',
  },
  // Free-text pill shown top-right of the form.
  providerStatus: { type: DataTypes.STRING(250), allowNull: true },
  buycoTransportStatus: { type: DataTypes.STRING(120), allowNull: true },
  carrierIdentifier: { type: DataTypes.STRING(20), allowNull: true, comment: 'BYCO gates extra SEA buttons' },
  subscriptionStatus: { type: DataTypes.STRING(20), defaultValue: 'active' },

  // Basic Details
  paymentTerms: { type: DataTypes.ENUM('ppx', 'ccx'), allowNull: true },
  incoterm: { type: DataTypes.STRING(80), allowNull: true },
  company: { type: DataTypes.STRING(120), allowNull: true },

  // Transport Details
  transportMode: { type: DataTypes.STRING(60), allowNull: true },
  carrier: { type: DataTypes.STRING(120), allowNull: true, comment: 'Service Provider' },
  cargoType: { type: DataTypes.STRING(60), allowNull: true, comment: 'Shipping Mode, e.g. [LSE] Loose' },
  assignedTo: { type: DataTypes.STRING(150), allowNull: true },
  assignedToVerified: { type: DataTypes.BOOLEAN, defaultValue: true },

  // Air Details
  trackingNumber: { type: DataTypes.STRING(60), allowNull: true, comment: 'AWB Number' },
  airline: { type: DataTypes.STRING(120), allowNull: true },
  flightNo: { type: DataTypes.STRING(40), allowNull: true },
  serviceMode: { type: DataTypes.STRING(60), allowNull: true },
  shipmentType: { type: DataTypes.STRING(60), allowNull: true },
  commodityType: { type: DataTypes.STRING(60), allowNull: true, comment: 'Cargo Type on the Air Details block' },

  // Origin / Destination
  origin: { type: DataTypes.STRING(150), allowNull: true },
  originPort: { type: DataTypes.STRING(150), allowNull: true },
  originCountry: { type: DataTypes.STRING(80), allowNull: true },
  originFacilityType: { type: DataTypes.ENUM('CLOC', 'POTE', 'INTE'), allowNull: true },
  destination: { type: DataTypes.STRING(150), allowNull: true },
  destinationPort: { type: DataTypes.STRING(150), allowNull: true },
  destinationCountry: { type: DataTypes.STRING(80), allowNull: true },
  destinationFacilityType: { type: DataTypes.ENUM('CLOC', 'POTE', 'INTE'), allowNull: true },
  departureDate: { type: DataTypes.DATEONLY, allowNull: true },

  // Schedule
  etdTime: { type: DataTypes.DATE, allowNull: true },
  etaTime: { type: DataTypes.DATE, allowNull: true },
  atdTime: { type: DataTypes.DATE, allowNull: true },
  ataTime: { type: DataTypes.DATE, allowNull: true },

  // Vessel (SEA)
  vessel: { type: DataTypes.STRING(120), allowNull: true },
  imoNumber: { type: DataTypes.STRING(40), allowNull: true },
  voyageNumber: { type: DataTypes.STRING(40), allowNull: true },

  // Parties
  client: { type: DataTypes.STRING(250), allowNull: true },
  clientAddress: { type: DataTypes.TEXT, allowNull: true },
  shipper: { type: DataTypes.STRING(250), allowNull: true },
  shipperAddress: { type: DataTypes.TEXT, allowNull: true },
  shipperAccountNumbers: { type: DataTypes.STRING(120), allowNull: true },
  consignee: { type: DataTypes.STRING(250), allowNull: true },
  consigneeAddress: { type: DataTypes.TEXT, allowNull: true },
  consigneeAccountNumbers: { type: DataTypes.STRING(120), allowNull: true },

  // Cargo Details grid: [{ commodity, quantity, weight, volume, chargeableWeight,
  // height, length, width, stackable, tillable, topLoadable, weightType }]
  cargoLines: { type: DataTypes.JSON, defaultValue: [] },
  // Cargo Charge Detail grid — flight/rate options returned by Search Freight.
  flightLines: { type: DataTypes.JSON, defaultValue: [] },

  isDirectBooking: { type: DataTypes.BOOLEAN, defaultValue: false },
  freightShipmentCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  freightDirectShipmentCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  cancelReason: { type: DataTypes.STRING(200), allowNull: true },
  failBookingReason: { type: DataTypes.STRING(200), allowNull: true },
  failBookingError: { type: DataTypes.TEXT, allowNull: true },
  remarks: { type: DataTypes.TEXT, allowNull: true },

  // Relational links — Create House/Master Shipment fills ffJobId, and the
  // party fields resolve to these when a matching record exists.
  ffJobId: { type: DataTypes.UUID, allowNull: true },
  masterShipmentId: { type: DataTypes.UUID, allowNull: true },
  customerId: { type: DataTypes.UUID, allowNull: true },
  carrierId: { type: DataTypes.UUID, allowNull: true },
  companyId: { type: DataTypes.UUID, allowNull: true },

  activityLog: { type: DataTypes.JSON, defaultValue: [] },
  followerCount: { type: DataTypes.INTEGER, defaultValue: 1 },
  createdBy: { type: DataTypes.UUID, allowNull: true },
}, {
  tableName: 'freight_bookings',
  hooks: {
    beforeValidate: async (rec) => {
      if (!rec.bookingReference) {
        const year = new Date().getFullYear();
        const last = await FreightBooking.findOne({
          where: { bookingReference: { [require('sequelize').Op.like]: `BR${year}%` } },
          order: [['bookingReference', 'DESC']], attributes: ['bookingReference'], raw: true,
        });
        const seq = last ? Number(String(last.bookingReference).slice(-6)) + 1 : 1;
        rec.bookingReference = `BR${year}${String(seq).padStart(6, '0')}`;
      }
      // modeType tracks transportCode unless it was set explicitly to 'land'.
      if (rec.transportCode && rec.modeType !== 'land') {
        rec.modeType = rec.transportCode === 'SEA' ? 'sea' : 'air';
      }
    },
  },
});

// Which header buttons the form offers — the demo's attrs, encoded once.
FreightBooking.prototype.availableActions = function availableActions() {
  const air = this.transportCode === 'AIR';
  const sea = this.transportCode === 'SEA';
  const hasFlights = Array.isArray(this.flightLines) && this.flightLines.length > 0;
  const noShipments = (this.freightShipmentCount || 0) === 0;
  const subscribed = this.subscriptionStatus === 'active';
  const byco = this.carrierIdentifier === 'BYCO';

  return {
    // AIR
    directBook: air && this.airStatus === 'created' && !hasFlights,
    bookNow: air && this.airStatus === 'created' && hasFlights,
    checkStatusAir: air && !!this.bookingNumber
      && ['booking_created', 'booking_confirmed', 'booking_cancel_req'].includes(this.airStatus),
    cancelBookingAir: air && ['booking_created', 'booking_confirmed'].includes(this.airStatus),
    createHouseShipment: air && this.airStatus === 'booking_confirmed' && noShipments,
    createMasterShipment: air && this.airStatus === 'booking_confirmed' && noShipments,
    // SEA
    book: sea && ['init', 'fail'].includes(this.status) && subscribed,
    checkStatusSea: sea && this.status === 'pending' && subscribed,
    updateBooking: sea && this.status === 'success' && subscribed,
    cancelBookingSea: sea && this.status === 'success' && subscribed,
    searchFreightSea: sea && byco && ['pending', 'success'].includes(this.status),
    amendDetails: sea && byco && this.status === 'pending',
    // The form is only editable before the carrier has the booking.
    edit: air ? this.airStatus === 'created' : ['init', 'fail'].includes(this.status),
    // Search Freight sits above the Cargo Details grid on AIR bookings.
    searchFreight: air && this.airStatus === 'created',
  };
};

module.exports = FreightBooking;
