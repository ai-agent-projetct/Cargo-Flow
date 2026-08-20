// Procurement raises a VendorBill; Accounting shows vendor documents as
// account.move rows with moveType 'in_invoice'. Without a bridge the two never
// meet — a bill created off a purchase order would be invisible under
// Accounting > Vendors > Bills. This module owns that mapping so the seeder and
// the live "Create Vendor Bill" action cannot drift apart.

const STATE_BY_BILL_STATUS = {
  draft: 'draft',
  pending: 'draft',
  approved: 'posted',
  posted: 'posted',
  paid: 'posted',
  cancelled: 'cancel',
  cancel: 'cancel',
};

const PAYMENT_STATE_BY_BILL_STATUS = {
  paid: 'paid',
  partial: 'partial',
};

// Bill line items and invoice lines carry different field names.
const lineFrom = (item, currency) => {
  const qty = Number(item.quantity || 1);
  const price = Number(item.unitPrice || 0);
  const subtotal = Number(item.amount != null ? item.amount : qty * price);
  return {
    kind: 'line',
    product: item.description || '',
    label: item.description || '',
    account: '501001 Cost of Services',
    quantity: qty,
    price,
    discount: 0,
    exRate: 1,
    chargeCurrency: currency,
    taxes: 'VAT 0%',
    taxRate: 0,
    vatAmount: 0,
    subtotal,
  };
};

/**
 * Build the AccountMove attributes that represent a VendorBill.
 * `bill` may be a Sequelize instance or a plain row.
 */
const moveAttributesFor = (bill, extra = {}) => {
  const currency = bill.currency || 'AED';
  const items = Array.isArray(bill.items) ? bill.items : [];
  const untaxed = Number(bill.subtotal || 0);
  const tax = Number(bill.taxAmount || 0);
  const total = Number(bill.totalAmount != null ? bill.totalAmount : untaxed + tax);
  const status = String(bill.status || 'draft').toLowerCase();
  const state = STATE_BY_BILL_STATUS[status] || 'draft';

  return {
    // A draft carries no number in the demo — it shows as "/" until posted.
    name: state === 'draft' ? '/' : bill.billNumber || '/',
    moveType: 'in_invoice',
    state,
    paymentState: PAYMENT_STATE_BY_BILL_STATUS[status] || 'not_paid',
    partner: bill.vendorName || '',
    partnerId: bill.vendorId || null,
    partnerAddress: bill.vendorName || '',
    invoiceDate: bill.billDate || null,
    invoiceDateDue: bill.dueDate || null,
    journal: 'Vendor Bills',
    currency,
    companyCurrency: 'AED',
    amountUntaxed: untaxed,
    amountTax: tax,
    amountTotal: total,
    amountTotalCurrency: total,
    // What is still owed. A fully paid bill owes nothing.
    amountResidual: status === 'paid' ? 0 : Number(bill.balance != null ? bill.balance : total),
    lines: items.map((i) => lineFrom(i, currency)),
    ref: bill.notes || null,
    sourceBillId: bill.id,
    company: 'CargoFlo (Dubai)',
    followerCount: 1,
    ...extra,
  };
};

module.exports = { moveAttributesFor };
