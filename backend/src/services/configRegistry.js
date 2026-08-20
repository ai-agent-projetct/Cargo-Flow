// Accounting > Configuration is 34 leaves that are all the same shape: a small
// list of records with a handful of fields. Rather than 34 controllers, each
// leaf declares its columns and fields here.
//
// Some leaves map onto a real model that already exists elsewhere in the ERP —
// editing Incoterms here edits the same Incoterm rows Operations uses. The rest
// are generic lookup lists stored in config_items, keyed by category.

// field types: 'text' | 'number' | 'boolean' | 'select'
const f = (key, label, type = 'text', extra = {}) => ({ key, label, type, ...extra });

// A leaf backed by config_items.
const generic = (id, title, fields, seed = []) => ({
  id, title, backing: 'config_items', category: id, fields, seed,
});

// A leaf backed by a real Sequelize model.
const model = (id, title, modelName, fields, opts = {}) => ({
  id, title, backing: 'model', modelName, fields, ...opts,
});

const CONFIGS = [
  // ── Invoicing ──
  generic('payment-terms', 'Payment Terms', [
    f('name', 'Payment Terms'),
    f('days', 'Days', 'number'),
    f('note', 'Description'),
    f('active', 'Active', 'boolean'),
  ], [
    ['Immediate Payment', 0], ['15 Days', 15], ['30 Days', 30], ['45 Days', 45],
    ['60 Days', 60], ['90 Days', 90], ['End of Following Month', 30],
  ].map(([name, days]) => ({ name, days, active: true }))),

  model('incoterms', 'Incoterms', 'Incoterm', [
    f('code', 'Code'), f('name', 'Name'), f('isActive', 'Active', 'boolean'),
  ]),

  generic('invoice-terms', 'Invoice Terms & Condition', [
    f('name', 'Title'), f('note', 'Terms & Conditions'), f('active', 'Active', 'boolean'),
  ], [{ name: 'Default Terms', note: 'Payment due within the agreed credit period.', active: true }]),

  // ── Banks ──
  generic('banks', 'Banks', [
    f('name', 'Name'), f('code', 'Bank Identifier Code'), f('country', 'Country'),
    f('active', 'Active', 'boolean'),
  ], [
    { name: 'Abu Dhabi Commercial Bank', code: 'ADCBAEAA', country: 'United Arab Emirates', active: true },
    { name: 'Emirates NBD', code: 'EBILAEAD', country: 'United Arab Emirates', active: true },
    { name: 'Bank of America', code: 'BOFAUS3N', country: 'United States', active: true },
  ]),

  generic('bank-accounts', 'Bank Accounts', [
    f('name', 'Account Number'), f('code', 'Bank'), f('note', 'Account Holder'),
    f('active', 'Active', 'boolean'),
  ], [
    { name: '2044050505050', code: 'Abu Dhabi Commercial Bank', note: 'CargoFlo (Dubai)', active: true },
  ]),

  generic('add-bank-account', 'Add a Bank Account', [
    f('name', 'Account Number'), f('code', 'Bank'), f('note', 'Account Holder'),
    f('active', 'Active', 'boolean'),
  ]),

  generic('reconciliation-models', 'Reconciliation Models', [
    f('name', 'Name'),
    f('value', 'Type', 'select', { options: ['Button to generate counterpart entry', 'Rule to suggest counterpart entry', 'Rule to match invoices/bills'] }),
    f('active', 'Active', 'boolean'),
  ], [
    { name: 'Invoices/Bills Perfect Match', value: 'Rule to match invoices/bills', active: true },
    { name: 'Invoices/Bills Partial Match', value: 'Rule to match invoices/bills', active: true },
    { name: 'Bank Fees', value: 'Button to generate counterpart entry', active: true },
  ]),

  // ── Accounting ──
  generic('chart-of-accounts', 'Chart of Accounts', [
    f('code', 'Code'), f('name', 'Account Name'),
    f('value', 'Type', 'select', { options: ['Receivable', 'Payable', 'Bank and Cash', 'Current Assets', 'Income', 'Expenses', 'Equity'] }),
    f('active', 'Active', 'boolean'),
  ], [
    ['101001', 'Accounts Receivable', 'Receivable'],
    ['101002', 'Bank Suspense Account', 'Bank and Cash'],
    ['101003', 'Outstanding Receipts', 'Bank and Cash'],
    ['101004', 'Outstanding Payments', 'Bank and Cash'],
    ['201001', 'Accounts Payable', 'Payable'],
    ['201005', 'VAT Payable', 'Current Assets'],
    ['400001', 'Product Sales', 'Income'],
    ['400002', 'Freight Income', 'Income'],
    ['501001', 'Cost of Services', 'Expenses'],
    ['600001', 'Bank Fees', 'Expenses'],
    ['999999', 'Undistributed Profits/Losses', 'Equity'],
  ].map(([code, name, value]) => ({ code, name, value, active: true })),
  ),

  generic('taxes', 'Taxes', [
    f('name', 'Tax Name'), f('days', 'Amount', 'number'),
    f('value', 'Tax Scope', 'select', { options: ['Sales', 'Purchases', 'None'] }),
    f('active', 'Active', 'boolean'),
  ], [
    { name: 'VAT 5% (Dubai)', days: 5, value: 'Sales', active: true },
    { name: 'VAT 5%', days: 5, value: 'Purchases', active: true },
    { name: 'VAT 0%', days: 0, value: 'Sales', active: true },
    { name: 'Exempt', days: 0, value: 'Sales', active: true },
  ]),

  model('journals', 'Journals', 'AccountJournal', [
    f('name', 'Journal Name'), f('type', 'Type'), f('code', 'Short Code'),
    f('currency', 'Currency'), f('active', 'Active', 'boolean'),
  ]),

  generic('currencies', 'Currencies', [
    f('code', 'Currency'), f('name', 'Name'), f('days', 'Rate', 'number'),
    f('active', 'Active', 'boolean'),
  ], [
    ['AED', 'UAE Dirham', 1], ['USD', 'US Dollar', 0.2723], ['EUR', 'Euro', 0.2510],
    ['GBP', 'Pound Sterling', 0.2145], ['INR', 'Indian Rupee', 22.71], ['SGD', 'Singapore Dollar', 0.3671],
  ].map(([code, name, days]) => ({ code, name, days, active: true }))),

  generic('fiscal-positions', 'Fiscal Positions', [
    f('name', 'Fiscal Position'), f('country', 'Country'), f('active', 'Active', 'boolean'),
  ], [
    { name: 'Domestic', country: 'United Arab Emirates', active: true },
    { name: 'Export (Zero Rated)', country: '', active: true },
  ]),

  generic('journal-groups', 'Journal Groups', [
    f('name', 'Journal Group'), f('active', 'Active', 'boolean'),
  ], [{ name: 'Default', active: true }]),

  generic('account-groups', 'Account Group', [
    f('code', 'Prefix'), f('name', 'Name'), f('active', 'Active', 'boolean'),
  ], [
    { code: '1', name: 'Assets', active: true },
    { code: '2', name: 'Liabilities', active: true },
    { code: '4', name: 'Income', active: true },
    { code: '5', name: 'Expenses', active: true },
  ]),

  generic('fiscal-years', 'Fiscal Years', [
    f('name', 'Name'), f('dateFrom', 'Start Date'), f('dateTo', 'End Date'),
    f('active', 'Active', 'boolean'),
  ], [
    { name: 'FY 2025', dateFrom: '2025-01-01', dateTo: '2025-12-31', active: true },
    { name: 'FY 2026', dateFrom: '2026-01-01', dateTo: '2026-12-31', active: true },
  ]),

  generic('statement-mappings', 'Statement Sheet Mappings', [
    f('name', 'Name'), f('note', 'Column Mapping'), f('active', 'Active', 'boolean'),
  ]),

  generic('coa-sequence', 'Chart Of Account Sequence', [
    f('name', 'Name'), f('code', 'Prefix'), f('days', 'Next Number', 'number'),
    f('active', 'Active', 'boolean'),
  ]),

  generic('tax-category', 'Tax Category', [
    f('name', 'Tax Category'), f('active', 'Active', 'boolean'),
  ], [{ name: 'Standard', active: true }, { name: 'Zero Rated', active: true }, { name: 'Exempt', active: true }]),

  generic('currency-providers', 'Currency Rates Providers', [
    f('name', 'Provider'), f('active', 'Active', 'boolean'),
  ], [{ name: 'UAE Central Bank', active: true }, { name: 'European Central Bank', active: false }]),

  generic('misc-code', 'Misc Code', [f('code', 'Code'), f('name', 'Description'), f('active', 'Active', 'boolean')]),
  generic('item-code', 'Item Code', [f('code', 'Code'), f('name', 'Description'), f('active', 'Active', 'boolean')]),
  generic('uom-code', 'UOM Code', [f('code', 'Code'), f('name', 'Description'), f('active', 'Active', 'boolean')],
    [['UNIT', 'Units'], ['KG', 'Kilograms'], ['CBM', 'Cubic Meters'], ['TEU', 'Twenty-foot Equivalent']]
      .map(([code, name]) => ({ code, name, active: true }))),

  // ── Payments ──
  generic('payment-acquirers', 'Payment Acquirers', [
    f('name', 'Provider'),
    f('value', 'State', 'select', { options: ['Disabled', 'Test Mode', 'Enabled'] }),
    f('active', 'Active', 'boolean'),
  ], [
    { name: 'Wire Transfer', value: 'Enabled', active: true },
    { name: 'Stripe', value: 'Disabled', active: false },
  ]),

  // ── Management ──
  generic('product-categories', 'Product Categories', [
    f('name', 'Category'), f('active', 'Active', 'boolean'),
  ], [{ name: 'Services', active: true }, { name: 'Freight', active: true }, { name: 'All', active: true }]),

  generic('deferred-revenue-models', 'Deferred Revenue Models', [
    f('name', 'Name'), f('days', 'Number of Periods', 'number'), f('active', 'Active', 'boolean'),
  ]),
  generic('deferred-expense-models', 'Deferred Expense Models', [
    f('name', 'Name'), f('days', 'Number of Periods', 'number'), f('active', 'Active', 'boolean'),
  ]),
  generic('asset-models', 'Asset Models', [
    f('name', 'Name'), f('days', 'Duration (months)', 'number'), f('active', 'Active', 'boolean'),
  ]),
  generic('analytic-items', 'Analytic Items', [
    f('name', 'Description'), f('code', 'Analytic Account'), f('active', 'Active', 'boolean'),
  ]),
  generic('analytic-accounts', 'Analytic Accounts', [
    f('code', 'Reference'), f('name', 'Analytic Account'), f('active', 'Active', 'boolean'),
  ], [{ code: 'AA-001', name: 'Freight Operations', active: true }]),

  generic('analytic-groups', 'Analytic Account Groups', [
    f('name', 'Group'), f('code', 'Parent'), f('active', 'Active', 'boolean'),
  ], [{ name: 'Operations', active: true }, { name: 'Overheads', active: true }]),

  generic('analytic-tags', 'Analytic Tags', [
    f('name', 'Tag'), f('active', 'Active', 'boolean'),
  ], [{ name: 'Air', active: true }, { name: 'Sea', active: true }, { name: 'Land', active: true }]),

  generic('analytic-defaults', 'Analytic Defaults Rules', [
    f('name', 'Rule'), f('code', 'Analytic Account'), f('country', 'Partner'),
    f('dateFrom', 'Start Date'), f('dateTo', 'End Date'), f('active', 'Active', 'boolean'),
  ]),

  generic('finance-reports', 'Account Finance Reports', [
    f('name', 'Report Name'),
    f('value', 'Type', 'select', { options: ['Balance Sheet', 'Profit and Loss', 'Cash Flow', 'Custom'] }),
    f('sequence', 'Sequence', 'number'),
    f('active', 'Active', 'boolean'),
  ], [
    { name: 'Balance Sheet', value: 'Balance Sheet', active: true },
    { name: 'Profit And Loss', value: 'Profit and Loss', active: true },
    { name: 'Cash Flow Statement', value: 'Cash Flow', active: true },
  ]),
];

const BY_ID = Object.fromEntries(CONFIGS.map((c) => [c.id, c]));

module.exports = { CONFIGS, BY_ID };
