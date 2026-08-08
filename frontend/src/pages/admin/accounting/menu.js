// The Accounting menu, transcribed from the demo's 118-node tree.
// Routes marked `todo: true` are mapped but not yet built — they render a
// stub that says so rather than 404ing, so the menu is complete from day one
// and each wave just fills stubs in.

const A = '/admin/accounting';

export const ACCOUNTING_MENU = [
  { label: 'Dashboard', href: `${A}/dashboard` },

  {
    label: 'Customers',
    groups: [{
      items: [
        { label: 'Invoices', href: `${A}/customers/invoices` },
        { label: 'Credit Notes', href: `${A}/customers/credit-notes` },
        { label: 'Debit Notes', href: `${A}/customers/debit-notes` },
        { label: 'Payments', href: `${A}/customers/payments` },
        { label: 'Pro Forma Invoice', href: `${A}/customers/pro-forma` },
        { label: 'Products', href: `${A}/customers/products` },
        { label: 'Customers', href: `${A}/customers/list` },
      ],
    }],
  },

  {
    label: 'Vendors',
    groups: [{
      items: [
        { label: 'Bills', href: `${A}/vendors/bills` },
        { label: 'Refunds', href: `${A}/vendors/refunds` },
        { label: 'Vendor Debit Notes', href: `${A}/vendors/debit-notes` },
        { label: 'Payments', href: `${A}/vendors/payments` },
        { label: 'Products', href: `${A}/vendors/products` },
        { label: 'Vendors', href: `${A}/vendors/list` },
      ],
    }],
  },

  {
    label: 'Accounting',
    groups: [
      { title: 'Miscellaneous', items: [{ label: 'Journal Entries', href: `${A}/entries` }] },
      {
        title: 'Journals',
        items: [
          { label: 'Sales', href: `${A}/journals/sales` },
          { label: 'Purchases', href: `${A}/journals/purchases` },
          { label: 'Bank and Cash', href: `${A}/journals/bank-cash` },
          { label: 'Miscellaneous', href: `${A}/journals/misc` },
        ],
      },
      {
        title: 'Ledgers',
        items: [
          { label: 'General Ledger', href: `${A}/ledgers/general` },
          { label: 'Partner Ledger', href: `${A}/ledgers/partner` },
          { label: 'VAT 201 Return Report', href: `${A}/ledgers/vat-201` },
        ],
      },
      {
        title: 'Management',
        items: [
          { label: 'Deferred Expenses', href: `${A}/management/deferred-expenses` },
          { label: 'Deferred Revenue', href: `${A}/management/deferred-revenue` },
          { label: 'Assets', href: `${A}/management/assets` },
          { label: 'WIP Automation', href: `${A}/management/wip` },
        ],
      },
      { title: 'Post Dated Cheque (PDC)', items: [{ label: 'PDC Payments', href: `${A}/pdc` }] },
      {
        title: 'Actions',
        items: [
          { label: 'Reconciliation', href: `${A}/actions/reconciliation` },
          { label: 'Lock Dates', href: `${A}/actions/lock-dates` },
          { label: 'Import Statement', href: `${A}/actions/import-statement` },
        ],
      },
    ],
  },

  {
    label: 'Reporting',
    groups: [
      {
        title: 'Management',
        items: [
          { label: 'Invoice Analysis', href: `${A}/reports/invoice-analysis` },
          { label: 'Depreciation Schedule', href: `${A}/reports/depreciation-schedule` },
          { label: 'Invoice Charge Wise Report', href: `${A}/reports/invoice-charge-wise` },
          { label: 'Accounting And Operations Report', href: `${A}/reports/accounting-operations` },
          { label: 'Unrealised Currency Gain/Loss', href: `${A}/reports/unrealised-fx` },
          { label: 'Product Margins', href: `${A}/reports/product-margins` },
        ],
      },
      {
        title: 'Finance Reports',
        items: [
          { label: 'Balance Sheet', href: `${A}/reports/balance-sheet` },
          { label: 'Profit And Loss', href: `${A}/reports/profit-and-loss` },
          { label: 'Cash Flow Statement', href: `${A}/reports/cash-flow` },
        ],
      },
      {
        title: 'Audit Reports',
        items: [
          { label: 'Tax Report', href: `${A}/reports/tax` },
          { label: 'General Ledger', href: `${A}/reports/general-ledger` },
          { label: 'Trial Balance', href: `${A}/reports/trial-balance` },
        ],
      },
      {
        title: 'Partner Reports',
        items: [
          { label: 'Partner Ledger', href: `${A}/reports/partner-ledger` },
          { label: 'Customer Due Report', href: `${A}/reports/customer-due` },
          { label: 'Customer Statement', href: `${A}/reports/customer-statement` },
          { label: 'Vendor Statement', href: `${A}/reports/vendor-statement` },
          { label: 'Outstanding Customer Statement', href: `${A}/reports/outstanding-customer` },
          { label: 'Outstanding Vendor Statement', href: `${A}/reports/outstanding-vendor` },
          { label: 'Balance Confirmation Report', href: `${A}/reports/balance-confirmation` },
          { label: 'Aged Payable', href: `${A}/reports/aged-payable` },
          { label: 'Aged Receivable', href: `${A}/reports/aged-receivable` },
        ],
      },
      {
        title: 'India',
        items: [
          { label: 'GSTR-1', href: `${A}/reports/gstr-1` },
          { label: 'GSTR-2', href: `${A}/reports/gstr-2` },
          { label: 'TDS Report', href: `${A}/reports/tds` },
        ],
      },
      {
        title: 'Philippines',
        items: [
          { label: 'Tax Report', href: `${A}/reports/ph-tax` },
          { label: 'Withholding Tax Report', href: `${A}/reports/ph-withholding` },
        ],
      },
      { title: 'Malaysia', items: [{ label: 'Tax Report', href: `${A}/reports/my-tax` }] },
    ],
  },

  {
    label: 'Configuration',
    groups: [
      { items: [{ label: 'Settings', href: `${A}/config/settings` }] },
      {
        title: 'Invoicing',
        items: [
          { label: 'Payment Terms', href: `${A}/config/payment-terms` },
          { label: 'Incoterms', href: `${A}/config/incoterms` },
          { label: 'Invoice Terms & Condition', href: `${A}/config/invoice-terms` },
        ],
      },
      {
        title: 'Banks',
        items: [
          { label: 'Add a Bank Account', href: `${A}/config/add-bank-account` },
          { label: 'Banks', href: `${A}/config/banks` },
          { label: 'Bank Accounts', href: `${A}/config/bank-accounts` },
          { label: 'Reconciliation Models', href: `${A}/config/reconciliation-models` },
        ],
      },
      {
        title: 'Accounting',
        items: [
          { label: 'Chart of Accounts', href: `${A}/config/chart-of-accounts` },
          { label: 'Taxes', href: `${A}/config/taxes` },
          { label: 'Journals', href: `${A}/config/journals` },
          { label: 'Currencies', href: `${A}/config/currencies` },
          { label: 'Fiscal Positions', href: `${A}/config/fiscal-positions` },
          { label: 'Journal Groups', href: `${A}/config/journal-groups` },
          { label: 'Account Group', href: `${A}/config/account-groups` },
          { label: 'Fiscal Years', href: `${A}/config/fiscal-years` },
          { label: 'Statement Sheet Mappings', href: `${A}/config/statement-mappings` },
          { label: 'Chart Of Account Sequence', href: `${A}/config/coa-sequence` },
          { label: 'Tax Category', href: `${A}/config/tax-category` },
          { label: 'Currency Rates Providers', href: `${A}/config/currency-providers` },
          { label: 'Misc Code', href: `${A}/config/misc-code` },
          { label: 'Item Code', href: `${A}/config/item-code` },
          { label: 'UOM Code', href: `${A}/config/uom-code` },
        ],
      },
      { title: 'Payments', items: [{ label: 'Payment Acquirers', href: `${A}/config/payment-acquirers` }] },
      {
        title: 'Management',
        items: [
          { label: 'Product Categories', href: `${A}/config/product-categories` },
          { label: 'Deferred Revenue Models', href: `${A}/config/deferred-revenue-models` },
          { label: 'Deferred Expense Models', href: `${A}/config/deferred-expense-models` },
          { label: 'Asset Models', href: `${A}/config/asset-models` },
          { label: 'Analytic Items', href: `${A}/config/analytic-items` },
        ],
      },
      {
        title: 'Analytic Accounting',
        items: [
          { label: 'Analytic Accounts', href: `${A}/config/analytic-accounts` },
          { label: 'Analytic Account Groups', href: `${A}/config/analytic-groups` },
          { label: 'Analytic Tags', href: `${A}/config/analytic-tags` },
          { label: 'Analytic Defaults Rules', href: `${A}/config/analytic-defaults` },
        ],
      },
      {
        title: 'Account Finance Reports',
        items: [{ label: 'Account Finance Reports', href: `${A}/config/finance-reports` }],
      },
    ],
  },
];

// Flat lookup used by the stub page to name itself.
export const MENU_INDEX = ACCOUNTING_MENU.flatMap((m) =>
  m.href ? [{ label: m.label, href: m.href }]
    : (m.groups || []).flatMap((g) => g.items.map((i) => ({
      label: i.label, href: i.href, group: g.title, menu: m.label,
    }))));
