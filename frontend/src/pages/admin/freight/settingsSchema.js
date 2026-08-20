// Declarative description of the Settings panes, mirroring the demo's
// Configuration > Settings screen. Each field maps to an app_settings row.
//
// field kinds: bool | text | number | select | radio | password | static

export const PANES = [
  { key: 'general', label: 'General Settings', tone: 'bg-slate-500' },
  { key: 'crm', label: 'CRM', tone: 'bg-cyan-600' },
  { key: 'freight', label: 'Freight', tone: 'bg-emerald-600' },
  { key: 'freight_schedule', label: 'Freight Schedule', tone: 'bg-indigo-600' },
  { key: 'freight_booking', label: 'Freight Booking', tone: 'bg-blue-600', children: ['tms'] },
  { key: 'tms', label: 'TMS', nested: true },
  { key: 'website', label: 'Website', tone: 'bg-teal-600' },
  { key: 'customs', label: 'Customs', tone: 'bg-red-600' },
  { key: 'invoicing', label: 'Invoicing', tone: 'bg-orange-600' },
];

const bool = (key, label, help) => ({ key, label, help, kind: 'bool' });
const text = (key, label, help) => ({ key, label, help, kind: 'text' });
const secret = (key, label, help) => ({ key, label, help, kind: 'password' });
const num = (key, label, help) => ({ key, label, help, kind: 'number' });
const select = (key, label, options, help) => ({ key, label, help, kind: 'select', options });
const radio = (key, label, options, help) => ({ key, label, help, kind: 'radio', options });

export const SCHEMA = {
  freight_booking: [
    {
      title: 'Freight Booking',
      fields: [select('json_payload', 'JSON Payloads',
        ['Carrier Booking JSON Data Main Schema', 'Carrier Booking JSON Data Legacy Schema'])],
    },
    {
      title: 'Air Booking & Tracking Integration',
      integration: {
        toggle: 'cargoai_enabled',
        name: 'CargoAi Integration',
        blurb: 'Seamlessly connect CargoAI to search, book, and track air cargo shipments in real time.',
        keyField: secret('cargoai_product_key', 'CargoAi Product Key'),
      },
    },
    {
      title: 'Sea Booking & Tracking Integration',
      integration: {
        toggle: 'buyco_enabled',
        name: 'Buyco Integration',
        blurb: 'Seamlessly connect Buyco to book, search and update sea shipments in real time.',
        keyField: secret('buyco_product_key', 'Buyco Product Key'),
      },
    },
  ],

  tms: [
    {
      title: 'TMS',
      fields: [select('json_payload', 'JSON Payloads',
        ['Global TMS JSON Data Main Schema', 'Global TMS JSON Data Legacy Schema'])],
    },
  ],

  freight_schedule: [
    {
      title: 'Air Schedule API',
      integration: {
        toggle: 'oag_enabled',
        name: 'OAG Air Schedule',
        blurb: 'Fetching realtime Air Schedule',
        fields: [
          radio('oag_environment', 'OAG Environment', [
            { key: 'sandbox', label: 'Sandbox' }, { key: 'production', label: 'Production' },
          ]),
          secret('oag_api_key', 'OAG API Key'),
        ],
      },
    },
    {
      title: 'Sailing Schedule API',
      integration: {
        toggle: 'inttra_enabled',
        name: 'INTTRA Sailing Schedule',
        blurb: 'Fetching realtime Sea Sailing Schedule',
        fields: [
          radio('inttra_environment', 'INTTRA Environment', [
            { key: 'sandbox', label: 'Sandbox' }, { key: 'production', label: 'Production' },
          ]),
          secret('inttra_client_id', 'INTTRA Client ID'),
          secret('inttra_client_secret', 'INTTRA Client Secret'),
        ],
      },
      extra: [bool('cargoflo_schedule_enabled', 'CargoFlo Sailing Schedule', 'Enable Fetching realtime Sea Sailing Schedule')],
    },
  ],

  crm: [
    { title: 'CRM', fields: [bool('multi_teams', 'Multi Teams', 'Assign salespersons into multiple Sales Teams.')] },
    {
      title: 'Enable Party Type and Prospect Mandatory Fields',
      fields: [
        bool('enable_party_types', 'Enable Party Types'),
        bool('enable_prospect_mandatory', 'Enable Prospect Mandatory Fields',
          'Designation, Contact Person, Email, Mobile are Mandatory'),
        bool('enable_target_non_mandatory', 'Enable Target Non-Mandatory Fields',
          'Shipment Type, Transport Mode, Cargo Type are Non-Mandatory'),
      ],
    },
  ],

  freight: [
    {
      title: 'Service Type Mapping',
      fields: [
        select('pickup_type', 'Pickup Type', ['[PUD] Pickup', '[PCAG] Pre Carriage']),
        select('on_carriage_type', 'On Carriage Type', ['[OCAG] On Carriage', '[DLV] Delivery']),
        select('pre_carriage_type', 'Pre Carriage Type', ['[PCAG] Pre Carriage', '[PUD] Pickup']),
        select('delivery_type', 'Delivery Type', ['[DLV] Delivery', '[OCAG] On Carriage']),
      ],
    },
    {
      title: 'Document Management',
      fields: [
        num('file_size_limit_mb', 'File Size limits', 'Maximum upload size in MB'),
        num('max_document_history', 'Max Document History', 'Maximum number of versions to keep in history'),
      ],
    },
    { title: 'Customer KYC', fields: [bool('customer_kyc', 'Enable KYC Feature')] },
    {
      title: 'Quote Approval',
      fields: [
        num('margin_percent', 'Margin Percent', 'Quote approval based on Margin Percentage'),
        num('margin_revenue', 'Margin Revenue', 'Quote approval based on Margin Revenue'),
      ],
    },
    {
      title: 'Freight Cost as Expense',
      fields: [bool('indirect_cost_as_expense', 'Indirect Cost for Jobs and Shipments',
        'Create indirect expense entry for your Freight Costs.')],
    },
    { title: 'Show Contact with Prefix', fields: [bool('show_contact_prefix', 'Show Contact Prefix', 'It helps to show contacts with their code as prefix.')] },
    { title: 'Re-Export Shipment', fields: [bool('re_export_shipment', 'Enable ReExport Shipment', 'Enable to create Re-Export Shipment from Import Jobs')] },
    {
      title: 'Container Validation',
      fields: [
        bool('container_length_validation', 'Enable Container Length Validation (Without ISO Standard)',
          'Container Length Validation ensures the container number provided is validated on its length.'),
        bool('container_iso6346_validation', 'Enable Container Validation (Including ISO6346 Check Digit)',
          'This Container Validation ensures that containers follow the ISO 6346 standard.'),
      ],
    },
    { title: 'Part BL', fields: [bool('enable_part_bl', 'Enable Part BL')] },
    { title: 'Freight Management Export to Import', fields: [bool('export_to_import', 'Enable Export To Import')] },
    { title: 'Enable SCAC Code as prefix in Master shipment', fields: [bool('scac_prefix_master', 'Enable Scac Prefix Code')] },
    { title: 'Party Types for Master Shipment', fields: [bool('party_types_master', 'Enable Party Types For Master Shipment')] },
    {
      title: 'Load Calculator API',
      fields: [
        bool('load_calculator_enabled', 'Enable load calculator preview',
          'This will enable the "View 3D Container" button on the LCL Consolidation screen.'),
        secret('load_calculator_api_key', 'Load Calculator API Key'),
      ],
    },
    {
      title: 'Shipment / Container Tracking',
      fields: [
        bool('shipment_tracking_enabled', 'Shipment/Container Tracking', 'Enable to track shipment for shipment / container'),
        radio('tracking_provider', 'Provider', [
          { key: 'cargoes', label: 'Cargoes Tracking' }, { key: 'cargoflo', label: 'CargoFlo Tracking' },
        ]),
        secret('cargoflo_product_key', 'CargoFlo Product Key'),
        num('tracking_update_frequency_hours', 'Auto Minimum update frequency', 'hours'),
      ],
    },
    { title: 'Create House Shipment From Master', fields: [bool('create_house_from_master', 'Create House Shipment From Master', 'Enable to create shipment from master')] },
    { title: 'Enable Charge Master Migration', fields: [bool('charge_master_migration', 'Enable Charge Master Migration')] },
    { title: 'Cut-Off Dates', fields: [bool('cut_off_dates', 'Enable Cut Off Dates')] },
    { title: 'Footer Details', fields: [bool('footer_details', 'Enable Footer Details')] },
    { title: 'Enable Shipper and Consignee are Non Mandatory', fields: [bool('shipper_consignee_non_mandatory', 'Enable Shipper and Consignee are Non Mandatory')] },
    { title: 'Shipment Status Change Without HBL Number', fields: [bool('status_change_without_hbl', 'Shipment Status Change', 'HBL Number Non Mandatory')] },
    { title: 'External Carrier Bookings', fields: [bool('external_carrier_bookings', 'Allow switch of External Carrier Bookings', 'Allows users to enter the External Carrier Bookings tab for shipments.')] },
    { title: 'Pro-Forma - Service Job', fields: [bool('proforma_service_job', 'Enable to Pro Forma Invoice from Service Job Charges')] },
    {
      title: 'FIATA eFBL',
      fields: [
        secret('fiata_username', 'Username'),
        secret('fiata_password', 'Password'),
        secret('fiata_forwarder_id', 'Freight Forwarder ID'),
      ],
    },
    { title: 'Transportation & Container Details', fields: [bool('transportation_container_details', 'Enable Container & Transportation Details', 'Enable in Transportation & Container details in Opportunity and Quote screen')] },
    { title: 'MAWB Validation', fields: [bool('stop_mawb_validation', 'Stop MAWB Validations', 'Stop MAWB validation on master shipment')] },
    { title: 'Enable Quote Routing', fields: [bool('enable_quote_routing', 'Enable Quote Routing')] },
    { title: 'Enable Temporary Party Creation', fields: [bool('enable_temporary_party', 'Enable Temporary Party')] },
  ],

  general: [
    {
      title: 'Units of Measure',
      fields: [
        select('packs_uom', 'Packs UOM', ['BAG (Bag)', 'BOX (Box)', 'PLT (Pallet)', 'CTN (Carton)']),
        select('weight_uom', 'Weight UOM', ['kg', 'lb', 'ton']),
        select('volume_uom', 'Volume UOM', ['m³', 'ft³']),
        select('dimension_uom', 'Dimension UOM', ['cm', 'in', 'm']),
        num('volumetric_divided_value', 'Volumetric Divided Value'),
      ],
    },
    {
      title: 'Permissions',
      fields: [
        radio('customer_account_mode', 'Customer Account', [
          { key: 'invitation', label: 'On invitation' }, { key: 'free', label: 'Free sign up' },
        ], 'Let your customers log in to see their documents'),
        bool('password_reset', 'Password Reset', 'Enable password reset from Login page'),
        bool('default_access_rights', 'Default Access Rights', 'Set custom access rights for new users'),
      ],
    },
    {
      title: 'Integrations',
      fields: [
        bool('google_drive', 'Google Drive', 'Create and attach Google Drive documents to any record'),
        bool('unsplash', 'Unsplash Image Library', 'Find free high-resolution images from Unsplash'),
        bool('recaptcha', 'reCAPTCHA', 'Protect your forms from spam and abuse.'),
        num('recaptcha_min_score', 'Minimum score'),
      ],
    },
    {
      title: 'Audit Log & Tracking',
      fields: [
        bool('audit_log', 'Audit Log', 'Enable the auditing tool. Auditing may impact performance while active.'),
        num('audit_log_days', 'Data history (in Days)'),
      ],
    },
  ],

  website: [
    {
      title: 'Website',
      fields: [text('name', 'Name', 'Name and favicon of your website'), text('domain', 'Domain', 'Display this website when users visit this domain')],
    },
    { title: 'Features', fields: [bool('google_maps', 'Google Maps', 'Use Google Map on your website'), bool('cookies_bar', 'Cookies Bar', 'Display a customizable cookies bar on your website.'), bool('social_media', 'Social Media', 'Add links to social media on your website')] },
    { title: 'SEO', fields: [bool('google_analytics', 'Google Analytics', 'Track visits in Google Analytics')] },
  ],

  customs: [
    {
      title: 'Customs Filing',
      fields: [secret('subscriber_uuid', 'Subscriber Uuid'), text('subscription_date', 'Subscription Date')],
      note: 'You have 3 services for 36 countries enabled',
    },
    {
      title: 'Customs Retry Queue Configuration',
      fields: [num('retain_completed_queue_days', 'Retain Completed Queue Days'), num('retry_count', 'Retry Count')],
    },
  ],

  invoicing: [
    { title: 'Sequence', fields: [bool('custom_reference_number', 'Custom Reference Number', 'Custom Reference number on the Invoice / Credit note / Bill / Refund')] },
    {
      title: 'Fiscal Periods',
      fields: [
        select('fiscal_year_last_month', 'Fiscal Year Last Day',
          ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']),
        num('fiscal_year_last_day', 'Day'),
      ],
    },
    { title: 'Deferred Revenue/Expenses', fields: [bool('deferred_revenue', 'Deferred Revenue/Expenses', 'Manage Deferred Revenue/Expenses.'), bool('fixed_assets', 'Fixed Assets Management', 'Manage Fixed Assets Management')] },
    { title: 'Lumpsum Discount', fields: [bool('lumpsum_discount', 'Discount', 'Lumpsum discount for the Invoices and Vendor Bills')] },
    {
      title: 'Taxes',
      fields: [
        select('sales_tax', 'Sales Tax', ['VAT 5% (Dubai)', 'VAT 0%', 'Exempt']),
        select('purchase_tax', 'Purchase Tax', ['VAT 5%', 'VAT 0%', 'Exempt']),
        radio('rounding_method', 'Rounding Method', [
          { key: 'per_line', label: 'Round per Line' }, { key: 'globally', label: 'Round Globally' },
        ], 'How total tax amount is computed in orders and invoices'),
        select('fiscal_country', 'Fiscal Country', ['United Arab Emirates', 'India', 'Malaysia', 'Saudi Arabia', 'United Kingdom']),
      ],
    },
    { title: 'Currencies', fields: [select('main_currency', 'Currency', ['AED', 'USD', 'EUR', 'INR', 'GBP', 'SGD', 'MYR']), bool('multi_currency_adjust', 'Adjust Payment With Multi Currency', 'Allow Payment Adjustment in Multiple Currencies')] },
    {
      title: 'Customer Invoices',
      fields: [
        bool('invoice_print', 'Print'),
        bool('invoice_send_email', 'Send Email'),
        radio('line_subtotals', 'Line Subtotals Tax Display', [
          { key: 'tax_excluded', label: 'Tax-Excluded' }, { key: 'tax_included', label: 'Tax-Included' },
        ]),
        bool('invoice_warnings', 'Warnings', 'Get warnings when invoicing specific customers'),
        bool('default_terms', 'Default Terms & Conditions', 'Add your terms & conditions at the bottom of invoices/orders/quotations'),
      ],
    },
    { title: 'Credit Limit Configurations', fields: [select('credit_limit_type', 'Credit Limit Configuration Type', ['Organization Level Credit Limit', 'Customer Level Credit Limit']), bool('restrict_document_print', 'Restrict Document Print (Credit Limit Exceed)')] },
    { title: 'Customer Payments', fields: [bool('invoice_online_payment', 'Invoice Online Payment', 'Let your customers pay their invoices online'), bool('qr_codes', 'QR Codes', 'Add a payment QR-code to your invoices')] },
    { title: 'PDC Payments', fields: [bool('pdc_payments', 'PDC Payments', 'Manage your Post Dated Cheque (PDC)')] },
    { title: 'WIP Default Account', fields: [bool('wip_automation', 'WIP Automation')] },
    { title: 'Analytics', fields: [bool('analytic_accounting', 'Analytic Accounting', 'Track costs & revenues by project, department, etc'), bool('analytic_tags', 'Analytic Tags', 'Allows to tag analytic entries and to manage analytic distributions'), bool('margin_analysis', 'Margin Analysis', 'Monitor your product margins from invoices')] },
  ],
};
