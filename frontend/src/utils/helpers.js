import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';

// ─── Date helpers ─────────────────────────────────────────────────────────────
export const formatDate = (date, pattern = 'MMM dd, yyyy') => {
  if (!date) return '—';
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return '—';
  return format(d, pattern);
};

export const formatDateTime = (date) => formatDate(date, 'MMM dd, yyyy HH:mm');

export const formatRelative = (date) => {
  if (!date) return '—';
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return '—';
  return formatDistanceToNow(d, { addSuffix: true });
};

// ─── Currency helpers ─────────────────────────────────────────────────────────
export const formatCurrency = (amount, currency = 'USD') => {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
};

export const formatNumber = (num) => {
  if (num === null || num === undefined) return '—';
  return new Intl.NumberFormat('en-US').format(num);
};

// ─── Status helpers ───────────────────────────────────────────────────────────
export const getStatusColor = (status) => {
  const map = {
    // Quotation statuses
    draft: 'bg-gray-100 text-gray-700',
    pending: 'bg-yellow-100 text-yellow-700',
    submitted: 'bg-blue-100 text-blue-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    converted: 'bg-purple-100 text-purple-700',
    expired: 'bg-orange-100 text-orange-700',

    // Shipment statuses
    booked: 'bg-blue-100 text-blue-700',
    'in-transit': 'bg-indigo-100 text-indigo-700',
    in_transit: 'bg-indigo-100 text-indigo-700',
    'at-origin': 'bg-cyan-100 text-cyan-700',
    at_origin: 'bg-cyan-100 text-cyan-700',
    'at-destination': 'bg-teal-100 text-teal-700',
    at_destination: 'bg-teal-100 text-teal-700',
    customs: 'bg-orange-100 text-orange-700',
    delivered: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
    active: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    on_hold: 'bg-yellow-100 text-yellow-700',
    'on-hold': 'bg-yellow-100 text-yellow-700',

    // Invoice statuses
    unpaid: 'bg-red-100 text-red-700',
    paid: 'bg-green-100 text-green-700',
    overdue: 'bg-red-200 text-red-800',
    partial: 'bg-orange-100 text-orange-700',
    void: 'bg-gray-100 text-gray-500',

    // Job statuses
    open: 'bg-blue-100 text-blue-700',
    'in-progress': 'bg-indigo-100 text-indigo-700',
    in_progress: 'bg-indigo-100 text-indigo-700',
    closed: 'bg-gray-100 text-gray-700',

    // User statuses
    enabled: 'bg-green-100 text-green-700',
    disabled: 'bg-red-100 text-red-700',
  };
  return map[status?.toLowerCase()] || 'bg-gray-100 text-gray-700';
};

export const getStatusDot = (status) => {
  const map = {
    pending: 'bg-yellow-400',
    approved: 'bg-green-400',
    rejected: 'bg-red-400',
    active: 'bg-blue-400',
    booked: 'bg-blue-400',
    in_transit: 'bg-indigo-400',
    delivered: 'bg-green-400',
    cancelled: 'bg-red-400',
    paid: 'bg-green-400',
    unpaid: 'bg-red-400',
    overdue: 'bg-red-600',
    completed: 'bg-green-400',
    draft: 'bg-gray-400',
  };
  return map[status?.toLowerCase()] || 'bg-gray-400';
};

// ─── Shipment mode helpers ─────────────────────────────────────────────────────
export const getModeIcon = (mode) => {
  const map = {
    sea: '🚢',
    air: '✈️',
    road: '🚛',
    rail: '🚂',
    courier: '📦',
  };
  return map[mode?.toLowerCase()] || '📦';
};

export const getModeColor = (mode) => {
  const map = {
    sea: 'bg-blue-100 text-blue-700',
    air: 'bg-sky-100 text-sky-700',
    road: 'bg-orange-100 text-orange-700',
    rail: 'bg-purple-100 text-purple-700',
    courier: 'bg-green-100 text-green-700',
  };
  return map[mode?.toLowerCase()] || 'bg-gray-100 text-gray-700';
};

// ─── Misc helpers ─────────────────────────────────────────────────────────────
export const truncate = (str, len = 30) => {
  if (!str) return '';
  return str.length > len ? str.substring(0, len) + '...' : str;
};

export const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
};

export const getInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export const classNames = (...classes) => classes.filter(Boolean).join(' ');

export const debounce = (fn, delay) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
};

export const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
};

export const buildQueryString = (params) => {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return qs ? `?${qs}` : '';
};

export const SHIPMENT_MODES = [
  { value: 'sea', label: 'Sea Freight' },
  { value: 'air', label: 'Air Freight' },
  { value: 'road', label: 'Road Freight' },
  { value: 'rail', label: 'Rail Freight' },
  { value: 'courier', label: 'Courier' },
];

export const INCOTERMS = [
  'EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP',
  'FAS', 'FOB', 'CFR', 'CIF',
];

export const CONTAINER_TYPES = [
  "20'GP", "40'GP", "40'HC", "20'RF", "40'RF", "20'OT", "40'OT", "20'FR", "40'FR",
];

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'SGD', 'CNY', 'INR', 'MYR'];

export const PAYMENT_TERMS = ['Net 30', 'Net 60', 'Net 90', 'Due on Receipt', 'Net 15'];

// ─── FF Job / Quote Number Formatters ────────────────────────────────────────
export const formatFFJobNumber = (mode, direction, cargoType, seq, year) => {
  const modeCodes = { SEA: 'SEA', AIR: 'AIR', ROAD: 'ROA', RAIL: 'RAIL' };
  const dirCodes = { EXPORT: 'E', IMPORT: 'I', LOCAL: 'L' };
  const cargoCodes = { FCL: 'FCL', LCL: 'LCL', FTL: 'FTL', LTL: 'LTL', LSE: 'LSE', BULK: 'BLK', RORO: 'ROA' };
  const m = modeCodes[mode] || mode;
  const d = dirCodes[direction] || 'E';
  const c = cargoCodes[cargoType] || cargoType;
  const y = year || new Date().getFullYear();
  const s = String(seq).padStart(5, '0');
  return `${m}-${d}-${c}-H-N-${y}-${s}`;
};

export const formatQuoteNumber = (mode, direction, cargoType, seq, year) => {
  const modeCodes = { SEA: 'SEA', AIR: 'AIR', ROAD: 'ROA', RAIL: 'RAIL' };
  const dirCodes = { EXPORT: 'EXP', IMPORT: 'IMP', LOCAL: 'LOC' };
  const y = year || new Date().getFullYear();
  const s = String(seq).padStart(5, '0');
  const m = modeCodes[mode] || mode;
  const d = dirCodes[direction] || 'EXP';
  const c = cargoType || 'FCL';
  return `QT-${m}-${d}-${c}/${y}/${s}`;
};

export const getTransportModeLabel = (mode) => {
  const labels = {
    SEA: '[SEA] Sea Freight', AIR: '[AIR] Air Freight',
    ROAD: '[ROA] Road Freight', RAIL: '[RAIL] Rail Freight',
  };
  return labels[mode] || mode;
};

export const getCargoTypeLabel = (type) => {
  const labels = {
    FCL: '[FCL] Full Container Load', LCL: '[LCL] Less Container Load',
    FTL: '[FTL] Full Truck Load', LTL: '[LTL] Less Truck Load',
    LSE: '[LSE] Loose', BULK: '[BULK] Bulk', RORO: '[RORO] RoRo',
  };
  return labels[type] || type;
};

export const getDirectionLabel = (dir) => {
  const labels = { EXPORT: '[EXP] Export', IMPORT: '[IMP] Import', LOCAL: '[LOC] Local' };
  return labels[dir] || dir;
};

export const getFFJobStatusColor = (status) => {
  const colors = {
    created: 'bg-gray-100 text-gray-700',
    booked: 'bg-blue-100 text-blue-700',
    received: 'bg-purple-100 text-purple-700',
    confirmed: 'bg-indigo-100 text-indigo-700',
    nomination_generated: 'bg-cyan-100 text-cyan-700',
    hbl_generated: 'bg-sky-100 text-sky-700',
    hawb_generated: 'bg-sky-100 text-sky-700',
    in_transit: 'bg-yellow-100 text-yellow-700',
    arrived: 'bg-orange-100 text-orange-700',
    completed: 'bg-green-100 text-green-700',
    accounting_closure: 'bg-teal-100 text-teal-700',
    cancelled: 'bg-red-100 text-red-700',
    stuffed: 'bg-emerald-100 text-emerald-700',
    delivered: 'bg-green-100 text-green-700',
    draft: 'bg-gray-100 text-gray-700',
  };
  return colors[status] || 'bg-gray-100 text-gray-700';
};

export const getDaysOverdue = (dueDate) => {
  if (!dueDate) return 0;
  const diff = new Date() - new Date(dueDate);
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
};

export const getTransportModeColor = (mode) => {
  const colors = {
    SEA: 'bg-blue-100 text-blue-700 border-blue-200',
    AIR: 'bg-purple-100 text-purple-700 border-purple-200',
    ROAD: 'bg-orange-100 text-orange-700 border-orange-200',
    RAIL: 'bg-green-100 text-green-700 border-green-200',
  };
  return colors[mode] || 'bg-gray-100 text-gray-700 border-gray-200';
};
