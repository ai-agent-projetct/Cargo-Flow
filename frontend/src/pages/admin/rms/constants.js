// Shared labels for the RMS module, matching how the demo renders them.

export const SERVICE_LABELS = {
  SEA: '[SEA] Sea Freight',
  AIR: '[AIR] Air Freight',
  ROA: '[ROA] Road Freight',
  RAIL: '[RAIL] Rail Freight',
};

export const TRADE_LABELS = {
  EXP: '[EXP] Export',
  IMP: '[IMP] Import',
};

export const CARGO_LABELS = {
  FCL: '[FCL] Full Container Load',
  LCL: '[LCL] Less Container Load',
  LSE: '[LSE] Loose',
  FTL: '[FTL] Full Truck Load',
  LTL: '[LTL] Less Truck Load',
  PLT: '[PLT] Pallets',
  CR: '[CR] Courier',
  BLK: '[BLK] Bulk',
};

export const SERVICES = Object.keys(SERVICE_LABELS);
export const TRADES = Object.keys(TRADE_LABELS);
export const CARGO_TYPES = Object.keys(CARGO_LABELS);

// The three charge grids share one column set.
export const CHARGE_COLUMNS = [
  ['charge', 'Charge'],
  ['unit', 'Unit'],
  ['currency', 'Currency'],
  ['ssp', 'SSP'],
  ['msp', 'MSP'],
  ['cost', 'Cost'],
  ['minimum', 'Minimum'],
  ['tos', 'TOS'],
  ['carrier', 'Carrier'],
  ['agent', 'Agent'],
];

export const NUMERIC_CHARGE_FIELDS = new Set(['ssp', 'msp', 'cost', 'minimum']);

export const CHARGE_TABS = [
  { key: 'originCharges', label: 'Origin Charges' },
  { key: 'freightCharges', label: 'Freight Charges' },
  { key: 'destinationCharges', label: 'Destination Charges' },
];

// Demo renders dates as MM/DD/YYYY.
export const fmtDate = (d) => {
  if (!d) return '-';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
};

export const fmtAmount = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtRate = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
