// Static data for "Administration > Freight Masters", mirroring SeaRates ERP's
// Freight Masters dropdown (Freight Product, Unit of Measures, JSON
// specifications, transport/cargo/shipment master lists, HAZ section, etc.)

// Top-level dropdown shown when clicking the "Freight Masters" tab.
// `section` marks a non-clickable group header (e.g. "HAZ").
export const FREIGHT_MASTERS_SUBMENU = [
  { key: 'freight-masters/freight-product', label: 'Freight Product' },
  { key: 'freight-masters/unit-of-measures', label: 'Unit of Measures' },
  { key: 'freight-masters/product-json-specifications', label: 'Product JSON Specifications' },
  { key: 'freight-masters/fiata-ebl-json-specifications', label: 'FIATA eBL Json Specifications' },
  { key: 'freight-masters/carrier-booking-json-specifications', label: 'Carrier Booking JSON Specifications' },
  { key: 'freight-masters/tms-json-specifications', label: 'TMS JSON Specifications' },
  { key: 'freight-masters/transport-modes', label: 'Transport Modes' },
  { key: 'freight-masters/shipment-types', label: 'Shipment Types' },
  { key: 'freight-masters/cargo-types', label: 'Cargo Types' },
  { key: 'freight-masters/consolidation-types', label: 'Consolidation Types' },
  { key: 'freight-masters/service-modes', label: 'Service Modes' },
  { key: 'freight-masters/container-service-modes', label: 'Container Service Modes' },
  { key: 'freight-masters/event-types', label: 'Event Types' },
  { key: 'freight-masters/document-types', label: 'Document Types' },
  { key: 'freight-masters/party-type', label: 'Party Type' },
  { key: 'freight-masters/adjustment-ratio-type', label: 'Adjustment Ratio Type' },
  { key: 'freight-masters/measurement-basis', label: 'Measurement Basis' },
  { key: 'freight-masters/freight-shipment-tag', label: 'Freight Shipment Tag' },
  { key: 'freight-masters/volumetric-divided-value', label: 'Volumetric Divided Value' },
  { key: 'haz', label: 'HAZ', section: true },
  { key: 'freight-masters/haz-class', label: 'HAZ Class', indent: true },
  { key: 'freight-masters/haz-sub-class', label: 'HAZ Sub Class', indent: true },
  { key: 'freight-masters/package-info', label: 'Package Info', indent: true },
];

// "Freight Product" list + detail records, matching the SeaRates ERP screen
// (Freight Product / Model / Product Type columns, and a detail view with a
// "Shipment Matching Rule" card).
export const FREIGHT_PRODUCTS = [
  {
    id: 'house-shipment-sea-import-fcl',
    name: 'House Shipment (SEA-IMPORT-FCL).',
    model: 'House Shipment',
    modelLink: true,
    productType: 'General',
    matchAll: true,
    rules: [
      { left: 'Transport Mode > Mode Type', op: '=', right: '"sea"' },
      { left: 'Shipment Type > Code', op: '=', right: '"IMP"' },
      { left: 'Cargo Type > Is Package Group', op: 'is not set', right: '' },
    ],
    recordCount: 188,
  },
  {
    id: 'profoma-invoice',
    name: 'Profoma Invoice',
    model: 'Pro Forma Invoice',
    modelLink: true,
    productType: 'General',
    matchAll: false,
    rules: [
      { left: 'House Shipment', op: 'is set', right: '' },
    ],
    recordCount: 211,
  },
  {
    id: 'service-job-freight-product',
    name: 'Service Job Freight Product',
    model: 'Quote',
    modelLink: true,
    productType: 'General',
    matchAll: false,
    rules: [
      { left: 'Quote For', op: '=', right: '"job"' },
    ],
    recordCount: 18,
  },
  {
    id: 'customer-invoice-credit-note-for-einvoice',
    name: 'Customer Invoice/Credit Note for eInvoice',
    model: 'Journal Entry',
    modelLink: true,
    productType: 'General',
    matchAll: false,
    rules: [
      { left: 'Move Type', op: '=', right: '"out_invoice"' },
    ],
    recordCount: 96,
  },
];

// "Administration > Freight Masters > Transport Modes" - dedicated list +
// detail records, mirroring SeaRates ERP's "Transport Mode" screen (Code /
// Name / Mode Type / Active columns, and a detail view with Mode Type radio,
// Active toggle, and "Allowed For Route" tags).
export const TRANSPORT_MODES = [
  {
    code: 'SEA',
    name: 'Sea Freight',
    modeType: 'Sea',
    active: true,
    allowedForRoute: ['SEA', 'ROA'],
  },
  {
    code: 'AIR',
    name: 'Air Freight',
    modeType: 'Air',
    active: true,
    allowedForRoute: ['AIR'],
  },
  {
    code: 'ROA',
    name: 'Road Freight',
    modeType: 'Land',
    active: true,
    allowedForRoute: ['SEA', 'ROA'],
  },
];

// "Administration > Freight Masters > Shipment Type" - dedicated list +
// detail records, mirroring SeaRates ERP's "Shipment Type" screen (Code /
// Name / Active columns, and a detail view with Active and "Is Courier
// Shipment" toggles).
export const SHIPMENT_TYPES = [
  { code: 'EXP', name: 'Export', active: true, isCourierShipment: false },
  { code: 'IMP', name: 'Import', active: true, isCourierShipment: false },
  { code: 'TRS', name: 'Transshipment', active: true, isCourierShipment: false },
];

// "Administration > Freight Masters > Cargo Type" - dedicated list + detail
// records, mirroring SeaRates ERP's "Cargo Type" screen (grouped by Transport
// Mode, with Code / Name / Transport Mode / Active columns, and a detail view
// with Transport Mode link, Calculated Dimension LWH / Is Package Group /
// Active / Is Courier Shipment toggles and a "Cargo Sub Type" tab).
export const CARGO_TYPES = [
  { code: 'BLK', name: 'Bulk', transportMode: 'SEA', calculatedDimensionLWH: false, isPackageGroup: true, active: true, isCourierShipment: false },
  { code: 'CR', name: 'Courier', transportMode: 'SEA', calculatedDimensionLWH: false, isPackageGroup: false, active: true, isCourierShipment: true },
  { code: 'FCL', name: 'Full Container Load', transportMode: 'SEA', calculatedDimensionLWH: false, isPackageGroup: false, active: true, isCourierShipment: false },
  { code: 'LCL', name: 'Less Container Load', transportMode: 'SEA', calculatedDimensionLWH: true, isPackageGroup: true, active: true, isCourierShipment: false },
  { code: 'LQD', name: 'Liquid', transportMode: 'SEA', calculatedDimensionLWH: false, isPackageGroup: false, active: true, isCourierShipment: false },
  { code: 'ROR', name: 'Roll On/Roll Off', transportMode: 'SEA', calculatedDimensionLWH: false, isPackageGroup: false, active: true, isCourierShipment: false },
  { code: 'CR', name: 'Courier', transportMode: 'AIR', calculatedDimensionLWH: false, isPackageGroup: false, active: true, isCourierShipment: true },
  { code: 'LSE', name: 'Loose', transportMode: 'AIR', calculatedDimensionLWH: true, isPackageGroup: true, active: true, isCourierShipment: false },
  { code: 'PLT', name: 'Pallets', transportMode: 'AIR', calculatedDimensionLWH: false, isPackageGroup: false, active: true, isCourierShipment: false },
  { code: 'PER', name: 'Perishable', transportMode: 'AIR', calculatedDimensionLWH: false, isPackageGroup: false, active: true, isCourierShipment: false },
  { code: 'BBK', name: 'Break Bulk', transportMode: 'ROA', calculatedDimensionLWH: false, isPackageGroup: false, active: true, isCourierShipment: false },
  { code: 'CR', name: 'Courier', transportMode: 'ROA', calculatedDimensionLWH: false, isPackageGroup: false, active: true, isCourierShipment: true },
  { code: 'FTL', name: 'Full Truck Load', transportMode: 'ROA', calculatedDimensionLWH: false, isPackageGroup: false, active: true, isCourierShipment: false },
  { code: 'LTL', name: 'Less Truck Load', transportMode: 'ROA', calculatedDimensionLWH: true, isPackageGroup: true, active: true, isCourierShipment: false },
  { code: 'RORO', name: 'RORO', transportMode: 'ROA', calculatedDimensionLWH: false, isPackageGroup: false, active: true, isCourierShipment: false },
];

// "Administration > Freight Masters > Consolidation Type" - dedicated list +
// detail records, mirroring SeaRates ERP's "Consolidation Type" screen
// (Code / Name / Active columns, and a detail view with just an Active
// toggle).
export const CONSOLIDATION_TYPES = [
  { code: '3PT', name: 'Third Party Ownership House', active: true },
  { code: 'ASM', name: 'Assembly Master', active: true },
  { code: 'BCN', name: "Buyer's Consol Lead", active: true },
  { code: 'CLB', name: 'Blind Co-Load Master', active: true },
  { code: 'CLD', name: 'Co-Load Master', active: true },
  { code: 'CNF', name: 'Cost No Insurance Freight', active: true },
  { code: 'HVL', name: 'HVLV Shipper Consolidation', active: true },
  { code: 'STD', name: 'Standard House', active: true },
];

// "Administration > Freight Masters > Service Mode" - dedicated list +
// detail records, mirroring SeaRates ERP's "Service Mode" screen (Code /
// Name / Active columns, and a detail view with an Active toggle and
// "Summary" / "Configurations" tabs).
export const SERVICE_MODES = [
  { code: 'C2F', name: 'CFS to Factory', active: true },
  { code: 'C2P', name: 'CFS to Port', active: true },
  { code: 'D2D', name: 'Door to Door', active: true },
  { code: 'D2P', name: 'Door to Port', active: true },
  { code: 'F2C', name: 'Factory to CFS', active: true },
  { code: 'F2F', name: 'Factory to Factory', active: true },
  { code: 'Inland', name: 'Inland', active: true },
  { code: 'Outerland', name: 'Service outerland', active: true },
  { code: 'P2D', name: 'Port to Door', active: true },
  { code: 'SD', name: 'Store Door', active: true },
  { code: 'P2P', name: 'Port to Port', active: true },
  { code: 'WH', name: 'Warehouse', active: true },
  { code: 'CLR', name: 'Clearance', active: true },
];

// "Administration > Freight Masters > Container Service Mode" - dedicated
// list + detail records, mirroring SeaRates ERP's "Container Service Mode"
// screen (Code / Name / Active columns, and a detail view with an Active
// toggle and a Summary tab).
export const CONTAINER_SERVICE_MODES = [
  { code: 'CFS/CFS', name: 'CFS/CFS', active: true },
  { code: 'CFS/DOOR', name: 'CFS/DOOR', active: true },
  { code: 'DOOR/CFS', name: 'DOOR/CFS', active: true },
  { code: 'DOOR/DOOR', name: 'DOOR/DOOR', active: true },
  { code: 'PORT/PORT', name: 'PORT/PORT', active: true },
];

// Simple reference master-data lists for the other "Freight Masters" dropdown
// items. Keyed by the submenu route key (without the "freight-masters/" prefix).
export const SIMPLE_MASTER_LISTS = {};
