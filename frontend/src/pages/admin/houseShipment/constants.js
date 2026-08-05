export const STATUSES = [
  'created', 'booked', 'received', 'confirmed', 'nomination_generated',
  'hbl_generated', 'hawb_generated', 'in_transit', 'arrived', 'completed',
  'accounting_closure', 'cancelled',
];

export const STATUS_LABELS = {
  created: 'Created',
  booked: 'Booked',
  received: 'Received',
  confirmed: 'Confirmed',
  nomination_generated: 'Nomination Generated',
  hbl_generated: 'HBL Generated',
  hawb_generated: 'HAWB Generated',
  in_transit: 'In Transit',
  arrived: 'Arrived',
  completed: 'Completed',
  accounting_closure: 'Accounting Closure',
  cancelled: 'Cancelled',
};

export const STATUS_FLOW = [
  'created', 'booked', 'received', 'confirmed', 'nomination_generated',
  'hbl_generated', 'hawb_generated', 'in_transit', 'arrived', 'completed',
  'accounting_closure',
];

export const SHIPMENT_TYPES = [
  { value: 'EXPORT', label: 'Export' },
  { value: 'IMPORT', label: 'Import' },
  { value: 'LOCAL', label: 'Local' },
];

export const CARGO_TYPES = ['FCL', 'LCL', 'FTL', 'LTL', 'LSE', 'BULK', 'RORO', 'BREAKBULK'];

export const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'DAT', 'EXQ'];

export const TRANSPORT_MODES = ['AIR', 'SEA', 'ROAD', 'RAIL'];

export const SERVICE_MODES = [
  { value: 'H', label: 'House' },
  { value: 'N', label: 'Neutral' },
  { value: 'M', label: 'Master' },
];

export const PACK_UNITS = ['PKG', 'BAG', 'CTN', 'PLT', 'DRM', 'ROL', 'BOX'];

export const WEIGHT_UNITS = ['kg', 'lb'];

export const VOLUME_UNITS = ['m3', 'ft3'];

export const DIMENSION_UNITS = ['cm', 'in'];

export const CURRENCIES = ['AED', 'USD', 'EUR', 'MYR'];

export const PACKAGE_TYPES = ['Pallet', 'Carton', 'Drum', 'Roll', 'Box', 'Bag', 'Crate', 'Other'];

export const PARTY_ROLES = ['Notify Party', 'Agent', 'Broker', 'Trucker', 'Warehouse', 'Other'];

export const BOOKING_STATUSES = ['requested', 'confirmed', 'cancelled'];

export const CUSTOMS_STATUSES = ['pending', 'in_progress', 'cleared', 'held'];

export const ROUTING_MODES = ['SEA', 'AIR', 'ROAD', 'RAIL'];

export const CUTOFF_PRESETS = ['SI Cut-off', 'VGM Cut-off', 'CY Cut-off', 'Document Cut-off'];

export const TABS = [
  'Carriage',
  'Additional',
  'Cut-Off Dates',
  'Insurance',
  'Customs',
  'Ext. Carrier Bookings',
  'Parties',
  'Packages',
  'Routing',
  'Milestones Tracking',
  'T&C',
  'Remarks',
];

export const inputClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

export const labelClass = 'block text-xs font-medium text-gray-500 mb-1';
