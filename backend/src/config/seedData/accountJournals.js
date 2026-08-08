// The 29 journal cards from the demo's Accounting Dashboard, in display order,
// with their real figures.
//
// [name, type, code, bankAccNumber, balanceGl, outstanding, latestStatement,
//  toReconcile, isConnected, counters]
//
// counters (sale/purchase only):
//   [toValidateCount, toValidateAmount, unpaidCount, unpaidAmount,
//    lateCount, lateAmount, toCheckCount, toCheckAmount]

const JOURNALS = [
  ['Customer Invoices', 'sale', 'INV', null, 0, null, null, 0, false,
    [258, 658044.67, 349, 775949.58, 348, 776131.23, 4, 46232.00], '#f59e0b'],
  ['Vendor Bills', 'purchase', 'BILL', null, 0, null, null, 0, false,
    [138, 478334.80, 179, 1555000.20, 179, 1555000.20, 0, 0], '#3b82f6'],
  ['Miscellaneous Operations', 'general', 'MISC', null, 0, null, null, 0, false, null, '#ef4444'],

  ['204405050505033', 'bank', 'BNK1', '204405050505033', 285367.06, 4960980.06, 235367.06, 66, true, null, null],
  ['12333444444', 'bank', 'BNK2', '12333444444', 476138.78, 25787433.17, 200701.76, 10, true, null, null],
  ['Bank', 'bank', 'BNK3', null, 780871.74, null, null, 0, false, null, null],
  ['Bank', 'bank', 'BNK4', null, 780871.74, 186342.46, 1047380.34, 245, true, null, null],
  ['BOA', 'bank', 'BOA', null, -9247390.37, 9242.50, -9249169.37, 18, true, null, null],
  ['87254165032165', 'bank', 'BNK5', '87254165032165', 0, 2100.00, null, 0, false, null, null],
  ['423042602910025', 'bank', 'BNK6', '423042602910025', 0, null, null, 0, true, null, null],
  ['Bank of America', 'bank', 'BOFA', null, 14995.00, 186299.14, null, 0, false, null, null],
  ['Credit Card', 'bank', 'CCRD', null, 30.32, null, null, 5, true, null, null],
  ['56789', 'bank', 'BNK7', '56789', 54355.00, -322.48, 105505.00, 0, true, null, null],
  ['UAE Bank', 'bank', 'UAEB', null, 780871.74, -38610.00, null, 0, false, null, null],

  ['Bipin Petty Cash', 'cash', 'PCSH1', null, 4850.00, -150.00, 0.00, 1, true, null, null],
  ['Kunal Cash', 'cash', 'CSH1', null, 25000.00, 650.00, null, 0, true, null, null],
  ['Cash', 'cash', 'CSH2', null, -588910.00, null, null, 0, true, null, null],
  ['Kunal Cash', 'cash', 'CSH3', null, 0, null, null, 0, true, null, null],
  ['Manual Petty Cash', 'cash', 'PCSH2', null, 3250.00, null, null, 0, true, null, null],

  ['Depreciation Journal', 'general', 'DEPR', null, 0, null, null, 0, false, null, null],
  ['IFRS 16', 'general', 'IFRS', null, 0, null, null, 0, false, null, null],
  ['KPA port Charges', 'general', 'KPA', null, 0, null, null, 0, false, null, null],

  ['Local Sales', 'sale', 'LSAL', null, 0, null, null, 0, false,
    [0, 0, 0, 0, 0, 0, 0, 0], null],
  ['Bill of Supply - Debit Note', 'sale', 'BOSDN', null, 0, null, null, 0, false,
    [2, 1942.50, 1, 1101.00, 1, 1101.00, 0, 0], '#8b5cf6'],
  ['Bill of Supply', 'sale', 'BOS', null, 0, null, null, 0, false,
    [0, 0, 0, 0, 0, 0, 0, 0], '#6366f1'],
  ['Customer Debit Note', 'sale', 'CDN', null, 0, null, null, 0, false,
    [0, 0, 1, 200.00, 1, 200.00, 0, 0], '#8b5cf6'],
  ['Esh Journal', 'sale', 'ESH', null, 0, null, null, 0, false,
    [0, 0, 1, 1.05, 1, 1.05, 0, 0], null],
  ['Export Sales', 'sale', 'EXSAL', null, 0, null, null, 0, false,
    [2, 0.00, 0, 0, 0, 0, 0, 0], null],
  ['Vendor Debit Note', 'purchase', 'VDN', null, 0, null, null, 0, false,
    [0, 0, 4, 5443.50, 4, 5443.50, 0, 0], '#a855f7'],
];

// The six ageing columns beneath every sale/purchase card. Labels are relative
// to today, matching how the demo renders them.
const ageingLabels = () => {
  const d = new Date();
  const plus = (n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const mon = (x) => x.toLocaleDateString('en-US', { month: 'short' });
  // The demo drops the repeated month: "26 Jul-1 Aug" but "9-15 Aug".
  const span = (a, b) => (mon(a) === mon(b)
    ? `${a.getDate()}-${b.getDate()} ${mon(b)}`
    : `${a.getDate()} ${mon(a)}-${b.getDate()} ${mon(b)}`);
  return [
    'Due',
    span(plus(-12), plus(-6)),
    'This Week',
    span(plus(2), plus(8)),
    span(plus(9), plus(15)),
    'Not Due',
  ];
};

// A deterministic bar/sparkline shape so cards look alive without inventing
// figures that contradict the stored balances.
const shape = (seed, n, amplitude) => {
  let s = seed;
  return Array.from({ length: n }, () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return Math.round(((s / 2147483648) * amplitude) * 100) / 100;
  });
};

module.exports = { JOURNALS, ageingLabels, shape };
