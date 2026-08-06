// Procurement > Purchase — labels and helpers shared by the list and the form.

// The demo keeps the internal state names but relabels draft as "RFQ".
export const STATE_LABELS = {
  draft: 'RFQ',
  to_approve: 'To Approve',
  approved: 'Approved',
  cancel: 'Cancelled',
  reject: 'Rejected',
};

// statusbar_visible="draft,to approve,approved,reject,cancel"
export const STATUSBAR_STATES = ['draft', 'to_approve', 'approved', 'cancel', 'reject'];

export const STATE_BADGE = {
  draft: 'bg-gray-100 text-gray-700',
  to_approve: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-700',
  cancel: 'bg-gray-200 text-gray-600',
  reject: 'bg-red-100 text-red-700',
};

export const FILTERS = [
  { key: 'draft', label: 'RFQ' },
  { key: 'to_approve', label: 'To Approve' },
  { key: 'approved', label: 'Approved' },
  { key: 'reject', label: 'Rejected' },
  { key: 'cancel', label: 'Cancelled' },
];

export const GROUP_BY = [
  { key: '', label: 'None' },
  { key: 'state', label: 'Status' },
  { key: 'vendor', label: 'Vendor' },
];

// Charge Detail grid — matches purchase.order.change.detail column for column.
export const CHARGE_COLUMNS = [
  { key: 'sNo', label: 'S. No', width: 'w-16', type: 'number' },
  { key: 'product', label: 'Product', width: 'w-64', type: 'text' },
  { key: 'uom', label: 'UoM', width: 'w-28', type: 'text' },
  { key: 'noOfUnit', label: 'No of Unit', width: 'w-24', type: 'number' },
  { key: 'chargeCurrency', label: 'Currency', width: 'w-24', type: 'text' },
  { key: 'exchangeRate', label: 'Exchange Rate', width: 'w-28', type: 'number' },
  { key: 'amountPerUnit', label: 'Amount Per Unit', width: 'w-32', type: 'number' },
  { key: 'amount', label: 'Amount', width: 'w-28', type: 'number' },
  { key: 'currencyTotalAmount', label: 'Total Currency Amount', width: 'w-36', type: 'number' },
  { key: 'orderCurrencyTotalAmount', label: 'Order Currency Amount', width: 'w-36', type: 'number' },
];

export const PRODUCTS = [
  '[201T0] Ocean Freight',
  '[OCAG] On Carriage',
  '[PCAG] Pre Carriage',
  '[THCO] Terminal Handling - Origin',
  '[THCD] Terminal Handling - Destination',
  '[DOCF] Documentation Fee',
  '[CUSC] Customs Clearance',
  '[HAND] Handling Charges',
  '[INSU] Insurance',
  '[DEMU] Demurrage',
];

export const UOMS = ['Shipment', 'Container', 'CBM', 'KG', 'Unit', 'Days'];
export const CURRENCIES = ['AED', 'USD', 'EUR', 'INR', 'GBP', 'SGD'];

export const CANCEL_REASONS = [
  'Duplicate Entry',
  'Rate Revised',
  'Shipment Cancelled',
  'Vendor Changed',
  'Wrong Shipment Linked',
  'Others',
];

export const fmtDateTime = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export const fmtDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
};

export const fmtMoney = (value) =>
  Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Amount and the two totals are derived, exactly as the demo computes them.
export const recalcLine = (line) => {
  const units = Number(line.noOfUnit || 0);
  const perUnit = Number(line.amountPerUnit || 0);
  const rate = Number(line.exchangeRate || 1) || 1;
  const amount = units * perUnit;
  return {
    ...line,
    amount,
    currencyTotalAmount: amount,
    orderCurrencyTotalAmount: Number((amount * rate).toFixed(2)),
  };
};

export const linesTotal = (lines = []) =>
  lines.reduce((sum, l) => sum + Number(l.orderCurrencyTotalAmount || l.amount || 0), 0);
