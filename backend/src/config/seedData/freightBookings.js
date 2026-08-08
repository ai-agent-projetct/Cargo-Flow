// The 148 demo bookings, dictionary-encoded so the payload stays reviewable.
// `d` is the string table, `r` holds one index-per-field row, `k` names the fields.
const packed = require('./freightBookings.json');

const decode = () => packed.r.map((row) => {
  const o = {};
  packed.k.forEach((key, i) => { o[key] = packed.d[row[i]]; });
  return o;
});

// Cargo Details rows captured from the demo, keyed by booking reference.
// [commodity, quantity, weight, volume, chargeableWeight, height, length, width,
//  stackable, tillable, topLoadable, weightType]
const CARGO_LINES = {
  BR2024000004: [['[GCR] General Cargo', 1, 1, 1, 0, 10, 10, 10, 0, 0, 0, 'per_item']],
  BR2024000007: [['[GCR] General Cargo', 1, 1, 1, 0, 2, 3, 3, 0, 0, 0, 'per_item']],
  BR2024000017: [['[GCR] General Cargo', 1, 500, 1, 0, 10, 10, 10, 0, 0, 0, 'per_item']],
  BR2024000022: [['[GCR] General Cargo', 15, 100, 3, 0, 50, 50, 50, 0, 0, 0, 'total']],
  BR2024000024: [['[GCR] General Cargo', 10, 10, 3, 0, 5, 50, 50, 0, 0, 0, 'total']],
  BR2024000026: [['[GCR] General Cargo', 100, 100, 12, 0, 50, 50, 50, 0, 0, 0, 'total']],
  BR2024000028: [['[GCR] General Cargo', 10, 10, 10, 0, 50, 50, 50, 0, 0, 0, 'total']],
  BR2024000030: [['[GCR] General Cargo', 1, 1, 1, 0, 5, 5, 5, 0, 0, 0, 'per_item']],
  BR2024000032: [['[GCR] General Cargo', 10, 100, 12, 0, 50, 50, 50, 0, 0, 0, 'total']],
  BR2024000036: [['[FRZ] Frozen fruits', 60, 180, 12, 200, 120, 60, 150, 1, 0, 0, 'total']],
  BR2024000106: [['[CBLS] CABLES', 1, 1, 1, 0, 10, 10, 10, 0, 0, 0, 'per_item']],
};

const CARGO_KEYS = ['commodity', 'quantity', 'weight', 'volume', 'chargeableWeight',
  'height', 'length', 'width', 'stackable', 'tillable', 'topLoadable', 'weightType'];

const cargoFor = (ref) => (CARGO_LINES[ref] || []).map((row) =>
  Object.fromEntries(CARGO_KEYS.map((k, i) => [
    k, ['stackable', 'tillable', 'topLoadable'].includes(k) ? !!row[i] : row[i],
  ])));

// A confirmed AIR booking carries the flight/rate option it was booked on.
const flightFor = (ref, airline, flightNo, origin, destination) => ([{
  airlineCode: (airline || '').slice(0, 2).toUpperCase(),
  airline: airline || '',
  flightNumber: flightNo || '',
  departureAirport: (origin.match(/- ([A-Z]{3})\]$/) || [])[1] || '',
  arrivalAirport: (destination.match(/- ([A-Z]{3})\]$/) || [])[1] || '',
  stops: '0',
  rateName: 'GENERAL CARGO',
  rateType: 'MARKET',
  rateCurrency: 'AED',
  rateNetRate: '4.20',
  rateAllInRate: '5.10',
  rateTotal: '765.00',
  rateMinimumRate: '250.00',
  available: 'true',
  availableReason: '',
  ghaName: 'dnata Cargo',
  shipmentStatus: 'booked',
  ref,
}]);

module.exports = { decode, cargoFor, flightFor };
