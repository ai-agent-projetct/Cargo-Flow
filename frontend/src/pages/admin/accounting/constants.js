// Accounting — shared labels, pill styles and formatters.

export const STATE = { draft: 'Draft', posted: 'Posted', cancel: 'Cancelled' };
export const STATE_PILL = {
  draft: 'bg-gray-100 text-gray-700',
  posted: 'bg-green-100 text-green-700',
  cancel: 'bg-gray-200 text-gray-500',
};

export const PAYMENT = {
  not_paid: 'Not Paid',
  in_payment: 'In Payment',
  partial: 'Partially Paid',
  paid: 'Paid',
  reversed: 'Reversed',
};
export const PAYMENT_PILL = {
  not_paid: 'bg-rose-100 text-rose-700',
  in_payment: 'bg-blue-100 text-blue-700',
  partial: 'bg-amber-100 text-amber-800',
  paid: 'bg-green-100 text-green-700',
  reversed: 'bg-violet-100 text-violet-700',
};

// The statusbar on the invoice form. Cancelled replaces Posted when reached.
export const STATUSBAR = ['draft', 'posted'];

export const CHARGE_SOURCES = [
  { key: 'house', label: 'House' },
  { key: 'master', label: 'Master' },
  { key: 'service_job', label: 'Service Job' },
];

export const FORM_TABS = [
  'Invoice Lines', 'Journal Items', 'Other Info', 'Terms & Conditions', 'WMS Invoice Integration',
];

// Invoice Lines grid. The shipment columns only appear once charges were
// pulled from a shipment, matching the demo.
export const LINE_COLUMNS = [
  { key: 'houseShipment', label: 'House Shipment', shipmentOnly: true, width: 'w-32' },
  { key: 'product', label: 'Product', type: 'select', width: 'w-40' },
  { key: 'label', label: 'Label', type: 'text', width: 'w-36' },
  { key: 'account', label: 'Account', type: 'select', width: 'w-40' },
  { key: 'exRate', label: 'Ex.Rate', type: 'number', shipmentOnly: true, dp: 3, width: 'w-20' },
  { key: 'amountQty', label: 'Amount/Qty', type: 'number', shipmentOnly: true, dp: 2, width: 'w-24' },
  { key: 'chargeCurrency', label: 'Charge Currency', shipmentOnly: true, width: 'w-24' },
  { key: 'analyticAccount', label: 'Analytic Account', type: 'text', width: 'w-32' },
  { key: 'analyticTags', label: 'Analytic Tags', type: 'tags', width: 'w-28' },
  { key: 'quantity', label: 'Quantity', type: 'number', dp: 2, width: 'w-20' },
  { key: 'price', label: 'Price', type: 'number', dp: 2, width: 'w-24' },
  { key: 'discount', label: 'Discount', type: 'number', dp: 2, width: 'w-20' },
  { key: 'taxes', label: 'Taxes', type: 'tax', width: 'w-24' },
  { key: 'vatAmount', label: 'VAT Amount', derived: true, dp: 2, width: 'w-24' },
  { key: 'subtotal', label: 'Subtotal', derived: true, dp: 2, width: 'w-28' },
];

export const PRODUCTS = [
  '[201T0] Ocean Freight', '[OCAG] On Carriage', '[MCAG] Main Carriage',
  '[PCAG] Pre Carriage', '[THCO] Terminal Handling - Origin',
  '[THCD] Terminal Handling - Destination', '[DOCF] Documentation Fee',
  '[CUSC] Customs Clearance', '[Freight Charge1] Border charges',
];

export const ACCOUNTS = [
  '106012 WIP Asset', '500001 Sales', '400053 Loss on Difference',
  '101001 Accounts Receivable', '201005 VAT Payable',
];

export const TAXES = ['VAT 0%', 'VAT 5% (Dubai)', 'VAT 5%', 'Exempt'];
export const TAX_RATE = { 'VAT 0%': 0, 'VAT 5% (Dubai)': 5, 'VAT 5%': 5, Exempt: 0 };

export const CURRENCIES = ['AED', 'USD', 'EUR', 'INR', 'GBP', 'AFN'];

const pad = (n) => String(n).padStart(2, '0');

export const fmtDate = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
};

export const isOverdue = (due, paymentState) =>
  !!due && new Date(due) < new Date() && ['not_paid', 'partial'].includes(paymentState);

export const money = (v, cur = 'AED') => {
  const n = Number(v || 0);
  const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (cur === 'USD') return `${n < 0 ? '-' : ''}$ ${s}`;
  return `${n < 0 ? '-' : ''}${s} ${cur}`;
};

export const num = (v, dp = 2) =>
  (v === null || v === undefined || v === '') ? '' : Number(v).toFixed(dp);

// A line's VAT and subtotal always follow quantity/price/discount/tax.
export const recalcLine = (l) => {
  const qty = Number(l.quantity || 0);
  const price = Number(l.price || 0);
  const disc = Number(l.discount || 0);
  const gross = qty * price;
  const subtotal = Math.round((gross - (gross * disc) / 100) * 100) / 100;
  const rate = TAX_RATE[l.taxes] ?? Number(l.taxRate || 0);
  return {
    ...l,
    subtotal,
    taxRate: rate,
    vatAmount: Math.round(subtotal * (rate / 100) * 100) / 100,
  };
};

export const totalsFor = (lines = []) => {
  const real = lines.filter((l) => (l.kind || 'line') === 'line');
  const untaxed = real.reduce((s, l) => s + Number(l.subtotal || 0), 0);
  const tax = real.reduce((s, l) => s + Number(l.vatAmount || 0), 0);
  return {
    untaxed: Math.round(untaxed * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    total: Math.round((untaxed + tax) * 100) / 100,
  };
};
