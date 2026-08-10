// Accounting > Vendors: Bills, Refunds and Vendor Debit Notes.
//
// The vendors here are the same partners the purchase orders and shipment
// charges already reference, so the Vendors menu lines up with Procurement
// rather than inventing a second population.

// [vendor, billRef, billDate, dueDate, untaxed, total, paymentState, state]
const BILLS = [
  ['AILSSL-1: A I L SHIPPING SERVICES LLC', 'BILL/2026/0041', '2026-07-28', '2026-08-27', 2000, 2100, 'not_paid', 'posted'],
  ['GM-8: Goodrich Maritme', 'BILL/2026/0040', '2026-07-14', '2026-08-13', 1400, 1470, 'paid', 'posted'],
  ['TL-3: Trident Logistics', 'BILL/2026/0039', '2026-06-30', '2026-07-30', 850, 892.5, 'not_paid', 'posted'],
  ['ASSL-1: Aitken Spence Shipping Ltd', 'BILL/2026/0038', '2026-06-22', '2026-07-22', 3200, 3360, 'partial', 'posted'],
  ['PSFW-1: Progressive Samson Freight WLL', 'BILL/2026/0037', '2026-06-11', '2026-07-11', 640, 672, 'paid', 'posted'],
  ['ALPL-1: Anix Logistics PVT LTD', 'BILL/2026/0036', '2026-05-29', '2026-06-28', 1150, 1207.5, 'not_paid', 'posted'],
  ['AV-2: Ankit Vijay', 'BILL/2026/0035', '2026-05-18', '2026-06-17', 500, 525, 'paid', 'posted'],
  ['GM-8: Goodrich Maritme', 'BILL/2026/0034', '2026-05-04', '2026-06-03', 2750, 2887.5, 'not_paid', 'posted'],
  ['UPS-2: ULTRA POMPE SRL', 'BILL/2026/0033', '2026-04-21', '2026-05-21', 980, 1029, 'paid', 'posted'],
  ['TL-3: Trident Logistics', 'BILL/2026/0032', '2026-04-09', '2026-05-09', 1650, 1732.5, 'not_paid', 'posted'],
  ['AILSSL-1: A I L SHIPPING SERVICES LLC', 'BILL/2026/0031', '2026-03-27', '2026-04-26', 420, 441, 'paid', 'posted'],
  ['B-26: Brandom', 'BILL/2026/0030', '2026-03-15', '2026-04-14', 1300, 1365, 'not_paid', 'posted'],
  ['ASSL-1: Aitken Spence Shipping Ltd', 'BILL/2026/0029', '2026-03-02', '2026-04-01', 2400, 2520, 'paid', 'posted'],
  ['LO-1: logistics one', 'BILL/2026/0028', '2026-02-19', '2026-03-21', 760, 798, 'not_paid', 'posted'],
  ['ALPL-1: Anix Logistics PVT LTD', 'BILL/2026/0027', '2026-02-06', '2026-03-08', 1890, 1984.5, 'partial', 'posted'],
  ['GM-8: Goodrich Maritme', 'BILL/2026/0026', '2026-01-23', '2026-02-22', 3100, 3255, 'paid', 'posted'],
  ['FTL-1: Fast Trade Limited', 'BILL/2026/0025', '2026-01-12', '2026-02-11', 540, 567, 'not_paid', 'posted'],
  ['UPS-2: ULTRA POMPE SRL', '', '2026-08-04', '2026-09-03', 1100, 1155, 'not_paid', 'draft'],
  ['TL-3: Trident Logistics', '', '2026-08-01', '2026-08-31', 730, 766.5, 'not_paid', 'draft'],
  ['AV-2: Ankit Vijay', '', '2026-07-30', '2026-08-29', 260, 273, 'not_paid', 'draft'],
];

// Vendor credit notes — money the vendor owes back.
// [vendor, ref, date, dueDate, untaxed, total, paymentState, state, reversedOf]
const REFUNDS = [
  ['GM-8: Goodrich Maritme', 'RBILL/2026/0007', '2026-07-16', '2026-07-16', 400, 420, 'not_paid', 'posted', 'BILL/2026/0040'],
  ['ASSL-1: Aitken Spence Shipping Ltd', 'RBILL/2026/0006', '2026-06-25', '2026-06-25', 200, 210, 'paid', 'posted', 'BILL/2026/0038'],
  ['TL-3: Trident Logistics', 'RBILL/2026/0005', '2026-05-02', '2026-05-02', 150, 157.5, 'not_paid', 'posted', 'BILL/2026/0039'],
  ['ALPL-1: Anix Logistics PVT LTD', 'RBILL/2026/0004', '2026-04-14', '2026-04-14', 300, 315, 'paid', 'posted', 'BILL/2026/0036'],
  ['UPS-2: ULTRA POMPE SRL', 'RBILL/2026/0003', '2026-03-08', '2026-03-08', 80, 84, 'not_paid', 'posted', 'BILL/2026/0033'],
  ['AILSSL-1: A I L SHIPPING SERVICES LLC', 'RBILL/2026/0002', '2026-02-11', '2026-02-11', 120, 126, 'paid', 'posted', 'BILL/2026/0031'],
  ['B-26: Brandom', '', '2026-08-05', '2026-08-05', 90, 94.5, 'not_paid', 'draft', ''],
];

// Extra charges a vendor billed on top of an existing bill.
const VENDOR_DEBIT_NOTES = [
  ['AILSSL-1: A I L SHIPPING SERVICES LLC', 'VDN/2026/0003', '2026-07-30', '2026-08-29', 175, 183.75, 'not_paid', 'posted', 'BILL/2026/0041'],
  ['GM-8: Goodrich Maritme', 'VDN/2026/0002', '2026-05-12', '2026-06-11', 260, 273, 'paid', 'posted', 'BILL/2026/0034'],
  ['TL-3: Trident Logistics', 'VDN/2026/0001', '2026-04-17', '2026-05-17', 95, 99.75, 'not_paid', 'posted', 'BILL/2026/0032'],
];

// Money paid out. Mirrors the inbound payment shape so both sides of the
// Payments screen share one model.
// [date, number, journal, method, vendor, billNumbers, amount, state]
const VENDOR_PAYMENTS = [
  ['2026-07-20', 'PBNK/2026/07/0004', '2044050505050', 'Manual', 'GM-8: Goodrich Maritme', ['BILL/2026/0040'], 1470, 'posted'],
  ['2026-06-18', 'PBNK/2026/06/0003', '2044050505050', 'Manual', 'PSFW-1: Progressive Samson Freight WLL', ['BILL/2026/0037'], 672, 'posted'],
  ['2026-06-02', 'PBNK/2026/06/0002', '2044050505050', 'Manual', 'ASSL-1: Aitken Spence Shipping Ltd', ['BILL/2026/0038'], 1500, 'posted'],
  ['2026-05-21', 'PBNK/2026/05/0005', 'Bank', 'Manual', 'AV-2: Ankit Vijay', ['BILL/2026/0035'], 525, 'posted'],
  ['2026-04-28', 'PBNK/2026/04/0004', '2044050505050', 'Manual', 'UPS-2: ULTRA POMPE SRL', ['BILL/2026/0033'], 1029, 'posted'],
  ['2026-04-02', 'PBNK/2026/04/0001', '2044050505050', 'PDC Payment', 'AILSSL-1: A I L SHIPPING SERVICES LLC', ['BILL/2026/0031'], 441, 'posted'],
  ['2026-03-10', 'PBNK/2026/03/0002', '2044050505050', 'Manual', 'ASSL-1: Aitken Spence Shipping Ltd', ['BILL/2026/0029'], 2520, 'posted'],
  ['2026-02-01', 'PBNK/2026/02/0001', '2044050505050', 'Manual', 'GM-8: Goodrich Maritme', ['BILL/2026/0026'], 3255, 'posted'],
  ['2026-08-06', 'PBNK/2026/08/0001', '2044050505050', 'Manual', 'ALPL-1: Anix Logistics PVT LTD', ['BILL/2026/0027'], 900, 'draft'],
];

module.exports = { BILLS, REFUNDS, VENDOR_DEBIT_NOTES, VENDOR_PAYMENTS };
