// Freight Booking — labels and helpers shared by the list and the form.
// `transportCode` (SEA | AIR) decides which lifecycle, buttons and tabs apply.

export const AIR_STATUS = {
  created: 'Created',
  booking_created: 'Booking Requested',
  booking_confirmed: 'Booking Confirmed',
  booking_rejected: 'Booking Rejected',
  booking_failed: 'Booking Failed',
  booking_cancel_req: 'Booking Cancellation Requested',
  booking_cancelled: 'Booking Cancelled',
};

export const SEA_STATUS = {
  init: 'Initialized',
  pending: 'Pending',
  success: 'Success',
  fail: 'Failed',
  cancel: 'Cancel',
};

// The statusbar in the demo shows only the happy path; terminal states light up
// in place of the step they replace.
export const AIR_STATUSBAR = ['created', 'booking_created', 'booking_confirmed'];
export const SEA_STATUSBAR = ['init', 'pending', 'success'];

export const statusLabel = (b) =>
  (b?.transportCode === 'SEA' ? SEA_STATUS[b?.status] : AIR_STATUS[b?.airStatus]) || '';

export const statusKey = (b) => (b?.transportCode === 'SEA' ? b?.status : b?.airStatus);

// Row colouring mirrors the tree's decoration-* attributes.
export const rowTone = (b) => {
  const k = statusKey(b);
  if (['fail', 'booking_failed', 'booking_rejected'].includes(k)) return 'text-red-600';
  if (['success', 'booking_confirmed'].includes(k)) return 'text-green-700';
  if (['cancel', 'booking_cancelled'].includes(k)) return 'text-gray-400';
  if (['pending', 'booking_created', 'booking_cancel_req'].includes(k)) return 'text-amber-600';
  return 'text-blue-700';
};

export const PAYMENT_TERMS = [
  { key: 'ppx', label: 'Prepaid (PPX)' },
  { key: 'ccx', label: 'Collect (CCX)' },
];

export const FACILITY_TYPES = [
  { key: 'CLOC', label: 'Custom Location' },
  { key: 'POTE', label: 'Port Terminal' },
  { key: 'INTE', label: 'Inland Terminal' },
];

export const WEIGHT_TYPES = [
  { key: 'total', label: 'Total' },
  { key: 'per_item', label: 'PER ITEM' },
];

export const INCOTERMS = [
  'EX WORKS', 'FREE CARRIER', 'FREE ALONGSIDE SHIP', 'FREE ON BOARD',
  'COST AND FREIGHT', 'COST, INSURANCE AND FREIGHT', 'CARRIAGE PAID TO',
  'CARRIAGE AND INSURANCE PAID TO', 'DELIVERED AT PLACE',
  'DELIVERED AT PLACE UNLOADED', 'DELIVERED DUTY PAID',
];

export const SERVICE_MODES = ['[P2P] Port to Port', '[D2D] Door to Door', '[P2D] Port to Door', '[D2P] Door to Port'];
export const SHIPMENT_TYPES = ['[EXP] Export', '[IMP] Import', '[LOC] Local'];
export const CARGO_TYPES = [
  '[LSE] Loose', '[FCL] Full Container Load', '[LCL] Less Container Load',
  '[BLK] Bulk', '[ULD] Unit Load Device',
];
export const COMMODITIES = [
  '[GCR] General Cargo', '[FRZ] Frozen fruits', '[CBLS] CABLES',
  '[PER] Perishables', '[DGR] Dangerous Goods', '[PHA] Pharmaceuticals',
];

// Cargo Details grid — matches air.cargo.details.line column for column.
export const CARGO_COLUMNS = [
  { key: 'commodity', label: 'Commodity', type: 'select', options: COMMODITIES, width: 'w-44' },
  { key: 'quantity', label: 'Quantity', type: 'number', width: 'w-24' },
  { key: 'weight', label: 'Weight', type: 'number', width: 'w-24', decimals: 2 },
  { key: 'volume', label: 'Volume', type: 'number', width: 'w-24', decimals: 2 },
  { key: 'chargeableWeight', label: 'Chargeable Weight', type: 'number', width: 'w-32', decimals: 2 },
  { key: 'height', label: 'Height', type: 'number', width: 'w-24', decimals: 2 },
  { key: 'length', label: 'Length', type: 'number', width: 'w-24', decimals: 2 },
  { key: 'width', label: 'Width', type: 'number', width: 'w-24', decimals: 2 },
  { key: 'stackable', label: 'Stackable', type: 'check', width: 'w-24' },
  { key: 'tillable', label: 'Tillable', type: 'check', width: 'w-20' },
  { key: 'topLoadable', label: 'Top Loadable', type: 'check', width: 'w-28' },
  { key: 'weightType', label: 'Weight Type', type: 'select', options: ['total', 'per_item'], width: 'w-28' },
];

// Cargo Charge Detail grid — the rate options Search Freight returns.
export const FLIGHT_COLUMNS = [
  { key: 'airlineCode', label: 'Airline Code' },
  { key: 'airline', label: 'Airline' },
  { key: 'flightNumber', label: 'Flight Number' },
  { key: 'departureAirport', label: 'Departure' },
  { key: 'arrivalAirport', label: 'Arrival' },
  { key: 'departureTime', label: 'ATD', type: 'datetime' },
  { key: 'arrivalTime', label: 'ATA', type: 'datetime' },
  { key: 'stops', label: 'Stops' },
  { key: 'rateName', label: 'Rate name' },
  { key: 'rateType', label: 'Rate Type' },
  { key: 'rateCurrency', label: 'Currency' },
  { key: 'rateNetRate', label: 'Net Rate' },
  { key: 'rateAllInRate', label: 'All In Rate' },
  { key: 'rateTotal', label: 'Rate Total' },
  { key: 'rateMinimumRate', label: 'Minimum Rate' },
  { key: 'available', label: 'Available' },
  { key: 'ghaName', label: 'GHA Name' },
];

const pad = (n) => String(n).padStart(2, '0');

export const fmtDateTime = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export const fmtDate = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
};

export const toLocalInput = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const fmtNum = (v, dp = 2) =>
  (v === null || v === undefined || v === '') ? '' : Number(v).toFixed(dp);
