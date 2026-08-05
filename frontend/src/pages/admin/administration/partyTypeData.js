// "Administration > Freight Masters > Party Type" - dedicated list + detail
// records, mirroring SeaRates ERP's "Party Type" screen (Name / Code / Is
// Vendor / Color columns, and a detail view with a "Partner Type Field Line"
// table).

// Odoo-style tag color palette (index -> hex).
export const PARTY_TYPE_COLORS = [
  '#FFFFFF', // 0 - No color
  '#F06050', // 1 - Red
  '#F4A460', // 2 - Orange
  '#F7CD1F', // 3 - Yellow
  '#6CC1ED', // 4 - Cyan
  '#9365B8', // 5 - Purple
  '#E0AB4D', // 6 - Almond
  '#2C8397', // 7 - Teal
  '#3498DB', // 8 - Blue
  '#D6145F', // 9 - Raspberry
  '#5EB590', // 10 - Green
  '#8569D5', // 11 - Violet
];

export const PARTY_TYPES = [
  { name: 'Shipper', code: 'SHIPPER', isVendor: false, color: 8, fieldLines: [] },
  { name: 'Consignee', code: 'CONSIGNEE', isVendor: false, color: 10, fieldLines: [] },
  { name: 'Notify Party', code: 'NOTIFY', isVendor: false, color: 3, fieldLines: [] },
  { name: 'Agent', code: 'AGENT', isVendor: true, color: 5, fieldLines: [] },
  { name: 'Carrier', code: 'CARRIER', isVendor: true, color: 4, fieldLines: [] },
  { name: 'Customs Clearance Point', code: '', isVendor: false, color: 2, fieldLines: [] },
  { name: 'Forwarder', code: 'FORWARDER', isVendor: true, color: 8, fieldLines: [] },
  { name: 'Co-Loader', code: 'COLOADER', isVendor: true, color: 7, fieldLines: [] },
  { name: 'Trucker', code: 'TRUCKER', isVendor: true, color: 1, fieldLines: [] },
  { name: 'Warehouse', code: 'WAREHOUSE', isVendor: false, color: 6, fieldLines: [] },
  { name: 'Bank', code: 'BANK', isVendor: false, color: 9, fieldLines: [] },
  { name: 'Insurance Company', code: 'INSURANCE', isVendor: false, color: 11, fieldLines: [] },
  { name: 'Buyer', code: 'BUYER', isVendor: false, color: 10, fieldLines: [] },
  { name: 'Seller', code: 'SELLER', isVendor: false, color: 3, fieldLines: [] },
  { name: 'Manufacturer', code: 'MANUFACTURER', isVendor: false, color: 4, fieldLines: [] },
  { name: 'Supplier', code: 'SUPPLIER', isVendor: true, color: 5, fieldLines: [] },
  { name: 'Customs Broker', code: 'BROKER', isVendor: true, color: 2, fieldLines: [] },
  { name: 'Surveyor', code: 'SURVEYOR', isVendor: true, color: 7, fieldLines: [] },
  { name: 'Port Authority', code: 'PORT', isVendor: false, color: 8, fieldLines: [] },
  { name: 'Terminal Operator', code: 'TERMINAL', isVendor: true, color: 1, fieldLines: [] },
  { name: 'Overseas Agent', code: 'OVERSEAS_AGENT', isVendor: true, color: 6, fieldLines: [] },
  { name: 'Local Agent', code: 'LOCAL_AGENT', isVendor: true, color: 9, fieldLines: [] },
  { name: 'Customs House Agent', code: 'CHA', isVendor: true, color: 11, fieldLines: [] },
  { name: 'Empty Yard', code: 'EMPTY_YARD', isVendor: false, color: 10, fieldLines: [] },
  { name: 'Container Freight Station', code: 'CFS', isVendor: false, color: 3, fieldLines: [] },
  { name: 'NVOCC', code: 'NVOCC', isVendor: true, color: 4, fieldLines: [] },
  { name: 'Importer', code: 'IMPORTER', isVendor: false, color: 5, fieldLines: [] },
  { name: 'Exporter', code: 'EXPORTER', isVendor: false, color: 2, fieldLines: [] },
  { name: 'Freight Forwarder', code: 'FREIGHT_FORWARDER', isVendor: true, color: 7, fieldLines: [] },
  { name: 'Transport Company', code: 'TRANSPORT', isVendor: true, color: 8, fieldLines: [] },
];
