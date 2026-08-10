// One registry behind every Accounting > Ledgers and Accounting > Reporting
// screen. Each report declares its columns and returns rows computed from the
// same account.move / account.payment data the lists show, so a figure on a
// report always reconciles with the document you can open.
//
// A builder receives a context and returns { columns, rows, totals }.
//   columns: [{ key, label, align?, type? }]  type: 'money' | 'date' | 'text'
//   rows:    [{ ...keyed by column key }]
//   totals:  { [columnKey]: number }  rendered in the footer

const { Op } = require('sequelize');

const round = (n) => Math.round((Number(n) || 0) * 100) / 100;
const sum = (rows, key) => round(rows.reduce((a, r) => a + (Number(r[key]) || 0), 0));

const CUSTOMER_TYPES = ['out_invoice', 'out_refund', 'out_debit'];
const VENDOR_TYPES = ['in_invoice', 'in_refund', 'in_debit'];

// Refunds reduce what is owed, so they carry the opposite sign of an invoice.
const SIGN = {
  out_invoice: 1, out_debit: 1, out_refund: -1,
  in_invoice: 1, in_debit: 1, in_refund: -1,
  entry: 1,
};

// Shared date-window clause. Reports default to "everything" when unfiltered.
const dateWhere = (ctx, field = 'invoiceDate') => {
  const w = {};
  if (ctx.dateFrom && ctx.dateTo) w[field] = { [Op.between]: [ctx.dateFrom, ctx.dateTo] };
  else if (ctx.dateFrom) w[field] = { [Op.gte]: ctx.dateFrom };
  else if (ctx.dateTo) w[field] = { [Op.lte]: ctx.dateTo };
  return w;
};

const postedMoves = async (ctx, types, extra = {}) => {
  const { AccountMove } = ctx.models;
  return AccountMove.findAll({
    where: {
      moveType: { [Op.in]: types },
      state: 'posted',
      ...dateWhere(ctx),
      ...(ctx.partnerId ? { partnerId: ctx.partnerId } : {}),
      ...extra,
    },
    order: [['invoiceDate', 'ASC'], ['name', 'ASC']],
    raw: true,
  });
};

// ── Ageing ──────────────────────────────────────────────────────────────────
// The demo buckets by how long a document has been overdue.
const AGE_BUCKETS = [
  { key: 'current', label: 'Current', min: -1e9, max: 0 },
  { key: 'd1', label: '1-30', min: 1, max: 30 },
  { key: 'd31', label: '31-60', min: 31, max: 60 },
  { key: 'd61', label: '61-90', min: 61, max: 90 },
  { key: 'd91', label: '91-120', min: 91, max: 120 },
  { key: 'older', label: 'Older', min: 121, max: 1e9 },
];

const daysOverdue = (due, asOf) => {
  if (!due) return 0;
  return Math.floor((new Date(asOf) - new Date(due)) / 86400000);
};

const ageingReport = (types, partnerLabel) => async (ctx) => {
  const moves = await postedMoves(ctx, types, { paymentState: { [Op.ne]: 'paid' } });
  const asOf = ctx.dateTo || new Date().toISOString().slice(0, 10);

  const byPartner = new Map();
  for (const m of moves) {
    const key = m.partner || '(none)';
    if (!byPartner.has(key)) {
      byPartner.set(key, Object.fromEntries([
        ['partner', key], ['total', 0], ...AGE_BUCKETS.map((b) => [b.key, 0]),
      ]));
    }
    const row = byPartner.get(key);
    const amount = round(Number(m.amountResidual || m.amountTotal) * (SIGN[m.moveType] || 1));
    const d = daysOverdue(m.invoiceDateDue, asOf);
    const bucket = AGE_BUCKETS.find((b) => d >= b.min && d <= b.max) || AGE_BUCKETS[0];
    row[bucket.key] = round(row[bucket.key] + amount);
    row.total = round(row.total + amount);
  }

  const rows = [...byPartner.values()].sort((a, b) => b.total - a.total);
  return {
    columns: [
      { key: 'partner', label: partnerLabel },
      ...AGE_BUCKETS.map((b) => ({ key: b.key, label: b.label, align: 'right', type: 'money' })),
      { key: 'total', label: 'Total', align: 'right', type: 'money' },
    ],
    rows,
    totals: Object.fromEntries(
      [...AGE_BUCKETS.map((b) => b.key), 'total'].map((k) => [k, sum(rows, k)])
    ),
  };
};

// ── Partner ledger / statements ─────────────────────────────────────────────
// A running balance of everything billed to and paid by a partner.
const statement = (types, paymentType, partnerLabel) => async (ctx) => {
  const { AccountPayment } = ctx.models;
  const moves = await postedMoves(ctx, types);
  const payments = await AccountPayment.findAll({
    where: {
      state: { [Op.in]: ['posted', 'reconciled', 'sent'] },
      paymentType,
      ...dateWhere(ctx, 'paymentDate'),
      ...(ctx.partnerId ? { partnerId: ctx.partnerId } : {}),
    },
    raw: true,
  });

  const entries = [
    ...moves.map((m) => ({
      date: m.invoiceDate,
      partner: m.partner,
      document: m.name,
      label: m.ref || '',
      debit: SIGN[m.moveType] > 0 ? round(m.amountTotal) : 0,
      credit: SIGN[m.moveType] > 0 ? 0 : round(m.amountTotal),
      currency: m.currency,
    })),
    ...payments.map((p) => ({
      date: p.paymentDate,
      partner: p.partner,
      document: p.name,
      label: p.paymentMethod || 'Payment',
      debit: 0,
      credit: round(p.amount),
      currency: p.currency,
    })),
  ].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  let running = 0;
  const rows = entries.map((e) => {
    running = round(running + e.debit - e.credit);
    return { ...e, balance: running };
  });

  return {
    columns: [
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'partner', label: partnerLabel },
      { key: 'document', label: 'Document' },
      { key: 'label', label: 'Label' },
      { key: 'debit', label: 'Debit', align: 'right', type: 'money' },
      { key: 'credit', label: 'Credit', align: 'right', type: 'money' },
      { key: 'balance', label: 'Balance', align: 'right', type: 'money' },
    ],
    rows,
    totals: { debit: sum(rows, 'debit'), credit: sum(rows, 'credit'), balance: running },
  };
};

// ── Tax ─────────────────────────────────────────────────────────────────────
// Group the tax charged on each line by its rate. Used by the generic Tax
// Report and by each jurisdiction's variant, which differ only in labelling.
const taxReport = (types, { netLabel = 'Net', taxLabel = 'Tax' } = {}) => async (ctx) => {
  const moves = await postedMoves(ctx, types);
  const byRate = new Map();
  for (const m of moves) {
    const s = SIGN[m.moveType] || 1;
    for (const l of (Array.isArray(m.lines) ? m.lines : [])) {
      const key = l.taxes || 'VAT 0%';
      if (!byRate.has(key)) byRate.set(key, { tax: key, net: 0, amount: 0 });
      const row = byRate.get(key);
      row.net = round(row.net + Number(l.subtotal || 0) * s);
      row.amount = round(row.amount + Number(l.vatAmount || 0) * s);
    }
  }
  const rows = [...byRate.values()].sort((a, b) => a.tax.localeCompare(b.tax));
  return {
    columns: [
      { key: 'tax', label: 'Tax' },
      { key: 'net', label: netLabel, align: 'right', type: 'money' },
      { key: 'amount', label: taxLabel, align: 'right', type: 'money' },
    ],
    rows,
    totals: { net: sum(rows, 'net'), amount: sum(rows, 'amount') },
  };
};

// ── Registry ────────────────────────────────────────────────────────────────
const REPORTS = {
  // Accounting > Ledgers
  'general-ledger': {
    title: 'General Ledger',
    build: async (ctx) => {
      const moves = await postedMoves(ctx, [...CUSTOMER_TYPES, ...VENDOR_TYPES, 'entry']);
      const rows = [];
      for (const m of moves) {
        for (const j of (Array.isArray(m.journalItems) ? m.journalItems : [])) {
          rows.push({
            date: m.invoiceDate,
            account: j.account,
            document: m.name,
            partner: j.partner || m.partner,
            label: j.label || '',
            debit: round(j.debit),
            credit: round(j.credit),
          });
        }
      }
      rows.sort((a, b) => String(a.account).localeCompare(String(b.account))
        || String(a.date).localeCompare(String(b.date)));
      return {
        columns: [
          { key: 'account', label: 'Account' },
          { key: 'date', label: 'Date', type: 'date' },
          { key: 'document', label: 'Document' },
          { key: 'partner', label: 'Partner' },
          { key: 'label', label: 'Label' },
          { key: 'debit', label: 'Debit', align: 'right', type: 'money' },
          { key: 'credit', label: 'Credit', align: 'right', type: 'money' },
        ],
        rows,
        totals: { debit: sum(rows, 'debit'), credit: sum(rows, 'credit') },
      };
    },
  },

  'partner-ledger': { title: 'Partner Ledger', build: statement(CUSTOMER_TYPES, 'inbound', 'Partner') },

  'vat-201': {
    title: 'VAT 201 Return Report',
    build: async (ctx) => {
      const outward = await taxReport(CUSTOMER_TYPES)(ctx);
      const inward = await taxReport(VENDOR_TYPES)(ctx);
      const outTax = outward.totals.amount;
      const inTax = inward.totals.amount;
      const rows = [
        { box: '1a', label: 'Standard rated supplies', net: outward.totals.net, vat: outTax },
        { box: '3', label: 'Recoverable VAT on purchases', net: inward.totals.net, vat: inTax },
        { box: '5', label: 'Net VAT due', net: round(outward.totals.net - inward.totals.net), vat: round(outTax - inTax) },
      ];
      return {
        columns: [
          { key: 'box', label: 'Box' },
          { key: 'label', label: 'Description' },
          { key: 'net', label: 'Amount', align: 'right', type: 'money' },
          { key: 'vat', label: 'VAT', align: 'right', type: 'money' },
        ],
        rows,
        totals: {},
      };
    },
  },

  // Reporting > Management
  'invoice-analysis': {
    title: 'Invoice Analysis',
    build: async (ctx) => {
      const moves = await postedMoves(ctx, CUSTOMER_TYPES);
      const byMonth = new Map();
      for (const m of moves) {
        const key = String(m.invoiceDate || '').slice(0, 7) || 'unknown';
        if (!byMonth.has(key)) byMonth.set(key, { period: key, count: 0, untaxed: 0, tax: 0, total: 0 });
        const r = byMonth.get(key);
        const s = SIGN[m.moveType] || 1;
        r.count += 1;
        r.untaxed = round(r.untaxed + Number(m.amountUntaxed) * s);
        r.tax = round(r.tax + Number(m.amountTax) * s);
        r.total = round(r.total + Number(m.amountTotal) * s);
      }
      const rows = [...byMonth.values()].sort((a, b) => a.period.localeCompare(b.period));
      return {
        columns: [
          { key: 'period', label: 'Period' },
          { key: 'count', label: 'Invoices', align: 'right' },
          { key: 'untaxed', label: 'Tax Excluded', align: 'right', type: 'money' },
          { key: 'tax', label: 'Tax', align: 'right', type: 'money' },
          { key: 'total', label: 'Total', align: 'right', type: 'money' },
        ],
        rows,
        totals: {
          count: rows.reduce((a, r) => a + r.count, 0),
          untaxed: sum(rows, 'untaxed'), tax: sum(rows, 'tax'), total: sum(rows, 'total'),
        },
      };
    },
  },

  'depreciation-schedule': {
    title: 'Depreciation Schedule',
    build: async (ctx) => {
      const { AccountAsset } = ctx.models;
      const assets = await AccountAsset.findAll({
        where: { state: { [Op.in]: ['running', 'paused', 'close'] } }, raw: true,
      });
      const rows = [];
      for (const a of assets) {
        for (const l of (Array.isArray(a.depreciationLines) ? a.depreciationLines : [])) {
          if (ctx.dateFrom && l.date < ctx.dateFrom) continue;
          if (ctx.dateTo && l.date > ctx.dateTo) continue;
          rows.push({
            asset: a.name, date: l.date, depreciation: round(l.depreciation),
            cumulative: round(l.cumulative), remaining: round(l.remaining),
          });
        }
      }
      rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
      return {
        columns: [
          { key: 'asset', label: 'Asset' },
          { key: 'date', label: 'Date', type: 'date' },
          { key: 'depreciation', label: 'Depreciation', align: 'right', type: 'money' },
          { key: 'cumulative', label: 'Cumulative', align: 'right', type: 'money' },
          { key: 'remaining', label: 'Residual', align: 'right', type: 'money' },
        ],
        rows,
        totals: { depreciation: sum(rows, 'depreciation') },
      };
    },
  },

  'invoice-charge-wise': {
    title: 'Invoice Charge Wise Report',
    build: async (ctx) => {
      const moves = await postedMoves(ctx, CUSTOMER_TYPES);
      const byCharge = new Map();
      for (const m of moves) {
        const s = SIGN[m.moveType] || 1;
        for (const l of (Array.isArray(m.lines) ? m.lines : [])) {
          const key = l.product || l.label || '(unnamed)';
          if (!byCharge.has(key)) byCharge.set(key, { charge: key, count: 0, untaxed: 0, tax: 0, total: 0 });
          const r = byCharge.get(key);
          r.count += 1;
          r.untaxed = round(r.untaxed + Number(l.subtotal || 0) * s);
          r.tax = round(r.tax + Number(l.vatAmount || 0) * s);
          r.total = round(r.untaxed + r.tax);
        }
      }
      const rows = [...byCharge.values()].sort((a, b) => b.total - a.total);
      return {
        columns: [
          { key: 'charge', label: 'Charge' },
          { key: 'count', label: 'Lines', align: 'right' },
          { key: 'untaxed', label: 'Tax Excluded', align: 'right', type: 'money' },
          { key: 'tax', label: 'Tax', align: 'right', type: 'money' },
          { key: 'total', label: 'Total', align: 'right', type: 'money' },
        ],
        rows,
        totals: { untaxed: sum(rows, 'untaxed'), tax: sum(rows, 'tax'), total: sum(rows, 'total') },
      };
    },
  },

  'accounting-operations': {
    title: 'Accounting And Operations Report',
    build: async (ctx) => {
      const moves = await postedMoves(ctx, CUSTOMER_TYPES);
      // Only documents actually tied to an operation belong on this report.
      const rows = moves
        .filter((m) => (m.houseShipmentRefs || []).length || (m.serviceJobRefs || []).length)
        .map((m) => ({
          document: m.name,
          partner: m.partner,
          shipment: (m.houseShipmentRefs || []).join(', '),
          serviceJob: (m.serviceJobRefs || []).join(', '),
          date: m.invoiceDate,
          revenue: round(Number(m.amountUntaxed) * (SIGN[m.moveType] || 1)),
          total: round(Number(m.amountTotal) * (SIGN[m.moveType] || 1)),
        }));
      return {
        columns: [
          { key: 'document', label: 'Document' },
          { key: 'partner', label: 'Customer' },
          { key: 'shipment', label: 'House Shipment' },
          { key: 'serviceJob', label: 'Service Job' },
          { key: 'date', label: 'Date', type: 'date' },
          { key: 'revenue', label: 'Revenue', align: 'right', type: 'money' },
          { key: 'total', label: 'Total', align: 'right', type: 'money' },
        ],
        rows,
        totals: { revenue: sum(rows, 'revenue'), total: sum(rows, 'total') },
      };
    },
  },

  'unrealised-fx': {
    title: 'Unrealised Currency Gain/Loss',
    build: async (ctx) => {
      const moves = await postedMoves(ctx, [...CUSTOMER_TYPES, ...VENDOR_TYPES], {
        paymentState: { [Op.ne]: 'paid' },
      });
      // Only documents in a currency other than the company's can drift.
      const rows = moves
        .filter((m) => m.currency && m.currency !== m.companyCurrency)
        .map((m) => {
          const booked = round(m.amountTotal);
          const current = round(m.amountTotalCurrency);
          return {
            document: m.name, partner: m.partner, currency: m.currency,
            booked, current, difference: round(current - booked),
          };
        });
      return {
        columns: [
          { key: 'document', label: 'Document' },
          { key: 'partner', label: 'Partner' },
          { key: 'currency', label: 'Currency' },
          { key: 'booked', label: 'Booked', align: 'right', type: 'money' },
          { key: 'current', label: 'Current', align: 'right', type: 'money' },
          { key: 'difference', label: 'Gain / Loss', align: 'right', type: 'money' },
        ],
        rows,
        totals: { difference: sum(rows, 'difference') },
      };
    },
  },

  'product-margins': {
    title: 'Product Margins',
    build: async (ctx) => {
      const { Product } = ctx.models;
      const products = await Product.findAll({ raw: true });
      const costByName = new Map(products.map((p) => [p.name, Number(p.cost || 0)]));

      const sold = await postedMoves(ctx, CUSTOMER_TYPES);
      const bought = await postedMoves(ctx, VENDOR_TYPES);
      const acc = new Map();
      const add = (m, field) => {
        const s = SIGN[m.moveType] || 1;
        for (const l of (Array.isArray(m.lines) ? m.lines : [])) {
          const key = l.product || l.label || '(unnamed)';
          if (!acc.has(key)) acc.set(key, { product: key, revenue: 0, cost: 0, qty: 0 });
          const r = acc.get(key);
          r[field] = round(r[field] + Number(l.subtotal || 0) * s);
          if (field === 'revenue') r.qty += Number(l.quantity || 0) * s;
        }
      };
      sold.forEach((m) => add(m, 'revenue'));
      bought.forEach((m) => add(m, 'cost'));

      const rows = [...acc.values()].map((r) => {
        // Fall back to the product's standard cost when nothing was purchased.
        const cost = r.cost || round((costByName.get(r.product) || 0) * r.qty);
        const margin = round(r.revenue - cost);
        return {
          ...r, cost, margin,
          marginPct: r.revenue ? round((margin / r.revenue) * 100) : 0,
        };
      }).sort((a, b) => b.margin - a.margin);

      return {
        columns: [
          { key: 'product', label: 'Product' },
          { key: 'qty', label: 'Qty', align: 'right' },
          { key: 'revenue', label: 'Revenue', align: 'right', type: 'money' },
          { key: 'cost', label: 'Cost', align: 'right', type: 'money' },
          { key: 'margin', label: 'Margin', align: 'right', type: 'money' },
          { key: 'marginPct', label: 'Margin %', align: 'right' },
        ],
        rows,
        totals: { revenue: sum(rows, 'revenue'), cost: sum(rows, 'cost'), margin: sum(rows, 'margin') },
      };
    },
  },

  // Reporting > Finance Reports
  'balance-sheet': {
    title: 'Balance Sheet',
    build: async (ctx) => {
      const { AccountJournal } = ctx.models;
      const receivable = await postedMoves(ctx, CUSTOMER_TYPES, { paymentState: { [Op.ne]: 'paid' } });
      const payable = await postedMoves(ctx, VENDOR_TYPES, { paymentState: { [Op.ne]: 'paid' } });
      const journals = await AccountJournal.findAll({
        where: { type: { [Op.in]: ['bank', 'cash'] } }, raw: true,
      });

      const ar = round(receivable.reduce((a, m) => a + Number(m.amountResidual || m.amountTotal) * (SIGN[m.moveType] || 1), 0));
      const ap = round(payable.reduce((a, m) => a + Number(m.amountResidual || m.amountTotal) * (SIGN[m.moveType] || 1), 0));
      const cash = round(journals.reduce((a, j) => a + Number(j.balanceGl || 0), 0));

      const rows = [
        { section: 'Assets', line: 'Bank and Cash', amount: cash },
        { section: 'Assets', line: 'Accounts Receivable', amount: ar },
        { section: 'Assets', line: 'Total Assets', amount: round(cash + ar) },
        { section: 'Liabilities', line: 'Accounts Payable', amount: ap },
        { section: 'Equity', line: 'Retained Earnings', amount: round(cash + ar - ap) },
      ];
      return {
        columns: [
          { key: 'section', label: 'Section' },
          { key: 'line', label: 'Line' },
          { key: 'amount', label: 'Balance', align: 'right', type: 'money' },
        ],
        rows,
        totals: {},
      };
    },
  },

  'profit-and-loss': {
    title: 'Profit And Loss',
    build: async (ctx) => {
      const income = await postedMoves(ctx, CUSTOMER_TYPES);
      const expense = await postedMoves(ctx, VENDOR_TYPES);
      const rev = round(income.reduce((a, m) => a + Number(m.amountUntaxed) * (SIGN[m.moveType] || 1), 0));
      const cost = round(expense.reduce((a, m) => a + Number(m.amountUntaxed) * (SIGN[m.moveType] || 1), 0));
      const rows = [
        { line: 'Operating Income', amount: rev },
        { line: 'Cost of Revenue', amount: cost },
        { line: 'Gross Profit', amount: round(rev - cost) },
        { line: 'Net Profit', amount: round(rev - cost) },
      ];
      return {
        columns: [
          { key: 'line', label: 'Line' },
          { key: 'amount', label: 'Amount', align: 'right', type: 'money' },
        ],
        rows,
        totals: {},
      };
    },
  },

  'cash-flow': {
    title: 'Cash Flow Statement',
    build: async (ctx) => {
      const { AccountPayment } = ctx.models;
      const payments = await AccountPayment.findAll({
        where: { state: { [Op.in]: ['posted', 'reconciled', 'sent'] }, ...dateWhere(ctx, 'paymentDate') },
        raw: true,
      });
      const inflow = round(payments.filter((p) => p.paymentType === 'inbound')
        .reduce((a, p) => a + Number(p.amount || 0), 0));
      const outflow = round(payments.filter((p) => p.paymentType === 'outbound')
        .reduce((a, p) => a + Number(p.amount || 0), 0));
      const rows = [
        { line: 'Cash received from customers', amount: inflow },
        { line: 'Cash paid to vendors', amount: -outflow },
        { line: 'Net cash movement', amount: round(inflow - outflow) },
      ];
      return {
        columns: [
          { key: 'line', label: 'Line' },
          { key: 'amount', label: 'Amount', align: 'right', type: 'money' },
        ],
        rows,
        totals: {},
      };
    },
  },

  // Reporting > Audit Reports
  tax: { title: 'Tax Report', build: taxReport([...CUSTOMER_TYPES, ...VENDOR_TYPES]) },

  'trial-balance': {
    title: 'Trial Balance',
    build: async (ctx) => {
      const moves = await postedMoves(ctx, [...CUSTOMER_TYPES, ...VENDOR_TYPES, 'entry']);
      const byAccount = new Map();
      for (const m of moves) {
        for (const j of (Array.isArray(m.journalItems) ? m.journalItems : [])) {
          const key = j.account || '(unassigned)';
          if (!byAccount.has(key)) byAccount.set(key, { account: key, debit: 0, credit: 0 });
          const r = byAccount.get(key);
          r.debit = round(r.debit + Number(j.debit || 0));
          r.credit = round(r.credit + Number(j.credit || 0));
        }
      }
      const rows = [...byAccount.values()]
        .map((r) => ({ ...r, balance: round(r.debit - r.credit) }))
        .sort((a, b) => a.account.localeCompare(b.account));
      return {
        columns: [
          { key: 'account', label: 'Account' },
          { key: 'debit', label: 'Debit', align: 'right', type: 'money' },
          { key: 'credit', label: 'Credit', align: 'right', type: 'money' },
          { key: 'balance', label: 'Balance', align: 'right', type: 'money' },
        ],
        rows,
        totals: { debit: sum(rows, 'debit'), credit: sum(rows, 'credit'), balance: sum(rows, 'balance') },
      };
    },
  },

  // Reporting > Partner Reports
  'customer-statement': { title: 'Customer Statement', build: statement(CUSTOMER_TYPES, 'inbound', 'Customer') },
  'vendor-statement': { title: 'Vendor Statement', build: statement(VENDOR_TYPES, 'outbound', 'Vendor') },
  'aged-receivable': { title: 'Aged Receivable', build: ageingReport(CUSTOMER_TYPES, 'Customer') },
  'aged-payable': { title: 'Aged Payable', build: ageingReport(VENDOR_TYPES, 'Vendor') },

  'customer-due': {
    title: 'Customer Due Report',
    build: async (ctx) => {
      const moves = await postedMoves(ctx, CUSTOMER_TYPES, { paymentState: { [Op.ne]: 'paid' } });
      const asOf = ctx.dateTo || new Date().toISOString().slice(0, 10);
      const rows = moves.map((m) => ({
        document: m.name, partner: m.partner,
        invoiceDate: m.invoiceDate, dueDate: m.invoiceDateDue,
        overdue: daysOverdue(m.invoiceDateDue, asOf),
        total: round(m.amountTotal),
        due: round(Number(m.amountResidual || m.amountTotal) * (SIGN[m.moveType] || 1)),
      })).sort((a, b) => b.overdue - a.overdue);
      return {
        columns: [
          { key: 'document', label: 'Document' },
          { key: 'partner', label: 'Customer' },
          { key: 'invoiceDate', label: 'Invoice Date', type: 'date' },
          { key: 'dueDate', label: 'Due Date', type: 'date' },
          { key: 'overdue', label: 'Days Overdue', align: 'right' },
          { key: 'total', label: 'Total', align: 'right', type: 'money' },
          { key: 'due', label: 'Amount Due', align: 'right', type: 'money' },
        ],
        rows,
        totals: { total: sum(rows, 'total'), due: sum(rows, 'due') },
      };
    },
  },

  'balance-confirmation': {
    title: 'Balance Confirmation Report',
    build: async (ctx) => {
      const moves = await postedMoves(ctx, [...CUSTOMER_TYPES, ...VENDOR_TYPES], {
        paymentState: { [Op.ne]: 'paid' },
      });
      const byPartner = new Map();
      for (const m of moves) {
        const key = m.partner || '(none)';
        if (!byPartner.has(key)) byPartner.set(key, { partner: key, receivable: 0, payable: 0 });
        const r = byPartner.get(key);
        const amt = round(Number(m.amountResidual || m.amountTotal) * (SIGN[m.moveType] || 1));
        if (CUSTOMER_TYPES.includes(m.moveType)) r.receivable = round(r.receivable + amt);
        else r.payable = round(r.payable + amt);
      }
      const rows = [...byPartner.values()]
        .map((r) => ({ ...r, net: round(r.receivable - r.payable) }))
        .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
      return {
        columns: [
          { key: 'partner', label: 'Partner' },
          { key: 'receivable', label: 'Receivable', align: 'right', type: 'money' },
          { key: 'payable', label: 'Payable', align: 'right', type: 'money' },
          { key: 'net', label: 'Net Balance', align: 'right', type: 'money' },
        ],
        rows,
        totals: {
          receivable: sum(rows, 'receivable'), payable: sum(rows, 'payable'), net: sum(rows, 'net'),
        },
      };
    },
  },
};

// Outstanding statements are the unpaid slice of the same statement data.
const outstanding = (types, partnerLabel) => async (ctx) => {
  const moves = await postedMoves(ctx, types, { paymentState: { [Op.ne]: 'paid' } });
  const rows = moves.map((m) => ({
    document: m.name, partner: m.partner, date: m.invoiceDate, dueDate: m.invoiceDateDue,
    total: round(m.amountTotal),
    outstanding: round(Number(m.amountResidual || m.amountTotal) * (SIGN[m.moveType] || 1)),
  }));
  return {
    columns: [
      { key: 'document', label: 'Document' },
      { key: 'partner', label: partnerLabel },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'dueDate', label: 'Due Date', type: 'date' },
      { key: 'total', label: 'Total', align: 'right', type: 'money' },
      { key: 'outstanding', label: 'Outstanding', align: 'right', type: 'money' },
    ],
    rows,
    totals: { total: sum(rows, 'total'), outstanding: sum(rows, 'outstanding') },
  };
};

REPORTS['outstanding-customer'] = { title: 'Outstanding Customer Statement', build: outstanding(CUSTOMER_TYPES, 'Customer') };
REPORTS['outstanding-vendor'] = { title: 'Outstanding Vendor Statement', build: outstanding(VENDOR_TYPES, 'Vendor') };

// Jurisdiction reports read the same tax data under local names.
REPORTS['gstr-1'] = { title: 'GSTR-1', build: taxReport(CUSTOMER_TYPES, { netLabel: 'Taxable Value', taxLabel: 'GST' }) };
REPORTS['gstr-2'] = { title: 'GSTR-2', build: taxReport(VENDOR_TYPES, { netLabel: 'Taxable Value', taxLabel: 'GST' }) };
REPORTS['ph-tax'] = { title: 'Tax Report', build: taxReport([...CUSTOMER_TYPES, ...VENDOR_TYPES]) };
REPORTS['my-tax'] = { title: 'Tax Report', build: taxReport([...CUSTOMER_TYPES, ...VENDOR_TYPES]) };

// Withholding is deducted at source on what is paid to vendors.
const withholding = (rate, title) => ({
  title,
  build: async (ctx) => {
    const moves = await postedMoves(ctx, VENDOR_TYPES);
    const rows = moves.map((m) => {
      const base = round(Number(m.amountUntaxed) * (SIGN[m.moveType] || 1));
      return {
        document: m.name, partner: m.partner, date: m.invoiceDate,
        base, rate: `${rate}%`, withheld: round(base * (rate / 100)),
      };
    });
    return {
      columns: [
        { key: 'document', label: 'Document' },
        { key: 'partner', label: 'Vendor' },
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'base', label: 'Base Amount', align: 'right', type: 'money' },
        { key: 'rate', label: 'Rate' },
        { key: 'withheld', label: 'Withheld', align: 'right', type: 'money' },
      ],
      rows,
      totals: { base: sum(rows, 'base'), withheld: sum(rows, 'withheld') },
    };
  },
});

REPORTS.tds = withholding(2, 'TDS Report');
REPORTS['ph-withholding'] = withholding(2, 'Withholding Tax Report');

// The Reporting menu's General Ledger and Partner Ledger are the same reports
// the Accounting menu exposes under Ledgers.
REPORTS['general-ledger-report'] = REPORTS['general-ledger'];

const listReports = () => Object.entries(REPORTS).map(([id, r]) => ({ id, title: r.title }));

const runReport = async (id, ctx) => {
  const report = REPORTS[id];
  if (!report) return null;
  const result = await report.build(ctx);
  return { id, title: report.title, ...result };
};

module.exports = { REPORTS, runReport, listReports };
