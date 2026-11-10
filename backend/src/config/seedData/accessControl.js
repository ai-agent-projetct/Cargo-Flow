// Roles and model permissions, mirroring res.groups + ir.model.access.
// Categories and group names are the demo's; the ACL grid below is the real
// House Shipment matrix extended consistently across the cloned models.

// [category, name, ownDocumentsOnly?]
const GROUPS = [
  ['Operations', 'Administrator'],
  ['Operations', 'Operation Manager'],
  ['Operations', 'Associate'],
  ['Shipment', 'Administrator'],
  ['Shipment', 'Super Admin'],
  ['Shipment', 'User: All Documents'],
  ['Shipment', 'User: Own Documents Only', true],
  ['Sales & CRM', 'Sales Administrator'],
  ['Sales & CRM', 'Sales Manager'],
  ['Sales & CRM', 'Salesman'],
  ['Invoicing', 'Billing Administrator'],
  ['Invoicing', 'Billing'],
  ['Purchase', 'Administrator'],
  ['Purchase', 'User'],
  ['Customs', 'Customs: Admin'],
  ['Customs', 'Customs Support User'],
  ['Customs', 'Customs: User'],
  ['Schedule', 'Schedule Administrator'],
  ['Schedule', 'Schedule User'],
  ['WMS', 'WMS Admin'],
  ['WMS', 'WMS User'],
  ['Service Job', 'Super Admin'],
  ['Administration', 'Access Rights'],
  ['Administration', 'Settings'],
  ['User types', 'Internal User'],
  ['User types', 'Portal'],
  ['User types', 'Public'],
  ['Extra Rights', 'Contact Creation'],
  ['Extra Rights', 'Multi Companies'],
  ['Extra Rights', 'Multi Currencies'],
  ['Extra Rights', 'Technical Features'],
  ['Documents', 'Manage Documents'],
  ['Pricing', 'Manage Pricing'],
];

// The models the ACL covers, with the label the denial message quotes.
const MODELS = [
  ['house.shipment', 'House Shipment'],
  ['master.shipment', 'Master Shipment'],
  ['quotation', 'Quote'],
  ['purchase.order', 'Purchase Order'],
  ['calendar.event', 'Calendar Event'],
  ['freight.booking', 'Freight Booking Request'],
  ['tms.request', 'TMS Request'],
  ['organization', 'Contact'],
  ['invoice', 'Journal Entry'],
  ['account.payment', 'Payment'],
  ['pro.forma.invoice', 'Pro Forma Invoice'],
  ['product', 'Product'],
  ['rms.tariff', 'Tariff'],
  ['app.settings', 'Settings'],
  // Sales & CRM funnel, costing and vendor pricing.
  ['crm.prospect', 'Prospect'],
  ['crm.prospect.lead', 'Lead'],
  ['crm.prospect.opportunity', 'Opportunity'],
  ['crm.stage', 'CRM Stage'],
  ['crm.team', 'Sales Team'],
  ['crm.sale.target', 'Sales Target'],
  ['shipment.quote.template', 'Quote Template'],
  ['charge.line', 'Charge Line'],
  ['rate.request', 'Rate Request'],
  ['pdc.payment', 'Post Dated Cheque'],
];

// perms string is RWCD, e.g. '1110' = read+write+create, no delete.
// This is the demo's real House Shipment matrix, applied consistently.
const ACL = {
  'house.shipment': [
    ['Operations / Administrator', '1111'],
    ['Operations / Operation Manager', '1110'],
    ['Operations / Associate', '1110'],
    ['Documents / Manage Documents', '1110'],
    ['Pricing / Manage Pricing', '1000'],
    ['Sales & CRM / Sales Manager', '1100'],
    ['Sales & CRM / Sales Administrator', '1000'],
    ['Sales & CRM / Salesman', '1000'],
    ['User types / Portal', '1000'],
    ['Administration / Settings', '1111'],
    ['Shipment / Administrator', '1111'],
    ['Shipment / Super Admin', '1111'],
    ['Shipment / User: All Documents', '1110'],
    ['Shipment / User: Own Documents Only', '1110'],
  ],
  'master.shipment': [
    ['Operations / Administrator', '1111'],
    ['Operations / Operation Manager', '1110'],
    ['Operations / Associate', '1100'],
    ['Administration / Settings', '1111'],
    ['Shipment / Administrator', '1111'],
    ['Shipment / User: All Documents', '1100'],
    ['Sales & CRM / Sales Manager', '1000'],
  ],
  quotation: [
    ['Sales & CRM / Sales Administrator', '1111'],
    ['Sales & CRM / Sales Manager', '1110'],
    ['Sales & CRM / Salesman', '1110'],
    ['Operations / Administrator', '1111'],
    ['Operations / Operation Manager', '1100'],
    ['Administration / Settings', '1111'],
    ['User types / Portal', '1000'],
  ],
  'purchase.order': [
    ['Purchase / Administrator', '1111'],
    ['Purchase / User', '1110'],
    ['Invoicing / Billing Administrator', '1110'],
    ['Invoicing / Billing', '1000'],
    ['Administration / Settings', '1111'],
    ['Operations / Administrator', '1100'],
  ],
  'calendar.event': [
    ['User types / Internal User', '1111'],
    ['Operations / Administrator', '1111'],
    ['Sales & CRM / Salesman', '1111'],
    ['Administration / Settings', '1111'],
    ['User types / Portal', '1000'],
  ],
  'freight.booking': [
    ['Operations / Administrator', '1111'],
    ['Operations / Operation Manager', '1110'],
    ['Operations / Associate', '1110'],
    ['Schedule / Schedule Administrator', '1110'],
    ['Schedule / Schedule User', '1000'],
    ['Administration / Settings', '1111'],
    ['Sales & CRM / Sales Manager', '1000'],
  ],
  'tms.request': [
    // Read-only everywhere — the model is system-written.
    ['Operations / Administrator', '1000'],
    ['Operations / Operation Manager', '1000'],
    ['Operations / Associate', '1000'],
    ['Administration / Settings', '1000'],
    ['Customs / Customs: Admin', '1000'],
    ['Customs / Customs Support User', '1000'],
    ['WMS / WMS Admin', '1000'],
  ],
  organization: [
    ['Sales & CRM / Sales Administrator', '1111'],
    ['Sales & CRM / Sales Manager', '1110'],
    ['Sales & CRM / Salesman', '1100'],
    ['Extra Rights / Contact Creation', '1110'],
    ['Operations / Administrator', '1110'],
    ['Administration / Settings', '1111'],
    ['User types / Internal User', '1000'],
  ],
  invoice: [
    ['Invoicing / Billing Administrator', '1111'],
    ['Invoicing / Billing', '1110'],
    ['Administration / Settings', '1111'],
    ['Operations / Administrator', '1000'],
    ['Sales & CRM / Sales Manager', '1000'],
  ],
  'account.payment': [
    ['Invoicing / Billing Administrator', '1111'],
    ['Invoicing / Billing', '1110'],
    ['Administration / Settings', '1111'],
    ['Sales & CRM / Sales Manager', '1000'],
  ],
  'pro.forma.invoice': [
    ['Invoicing / Billing Administrator', '1111'],
    ['Invoicing / Billing', '1110'],
    ['Administration / Settings', '1111'],
    ['Operations / Administrator', '1100'],
    ['Sales & CRM / Sales Manager', '1000'],
  ],
  product: [
    ['Invoicing / Billing Administrator', '1111'],
    ['Invoicing / Billing', '1100'],
    ['Administration / Settings', '1111'],
    ['Operations / Administrator', '1000'],
    ['Sales & CRM / Sales Manager', '1000'],
    ['Sales & CRM / Salesman', '1000'],
  ],
  'rms.tariff': [
    ['Pricing / Manage Pricing', '1111'],
    ['Sales & CRM / Sales Administrator', '1110'],
    ['Sales & CRM / Salesman', '1000'],
    ['Operations / Administrator', '1110'],
    ['Administration / Settings', '1111'],
  ],
  'app.settings': [
    ['Administration / Settings', '1111'],
    ['Administration / Access Rights', '1100'],
  ],

  // --- Sales & CRM funnel --------------------------------------------------
  // The funnel belongs to sales: they create and work it, operations can see
  // it so they know what is coming, and nobody else needs it.
  'crm.prospect': [
    ['Sales & CRM / Sales Administrator', '1111'],
    ['Sales & CRM / Sales Manager', '1111'],
    ['Sales & CRM / Salesman', '1110'],
    ['Extra Rights / Contact Creation', '1110'],
    ['Operations / Administrator', '1000'],
    ['Administration / Settings', '1111'],
  ],
  'crm.prospect.lead': [
    ['Sales & CRM / Sales Administrator', '1111'],
    ['Sales & CRM / Sales Manager', '1111'],
    ['Sales & CRM / Salesman', '1110'],
    ['Operations / Administrator', '1000'],
    ['Operations / Operation Manager', '1000'],
    ['Administration / Settings', '1111'],
  ],
  'crm.prospect.opportunity': [
    ['Sales & CRM / Sales Administrator', '1111'],
    ['Sales & CRM / Sales Manager', '1111'],
    ['Sales & CRM / Salesman', '1110'],
    ['Operations / Administrator', '1100'],
    ['Operations / Operation Manager', '1000'],
    ['Pricing / Manage Pricing', '1100'],
    ['Administration / Settings', '1111'],
  ],
  // Stages and teams are configuration: a salesman works the pipeline but
  // does not get to redefine it.
  'crm.stage': [
    ['Sales & CRM / Sales Administrator', '1111'],
    ['Sales & CRM / Sales Manager', '1100'],
    ['Sales & CRM / Salesman', '1000'],
    ['Administration / Settings', '1111'],
  ],
  'crm.team': [
    ['Sales & CRM / Sales Administrator', '1111'],
    ['Sales & CRM / Sales Manager', '1110'],
    ['Sales & CRM / Salesman', '1000'],
    ['Administration / Settings', '1111'],
  ],
  // A salesperson may read their own target but not set it.
  'crm.sale.target': [
    ['Sales & CRM / Sales Administrator', '1111'],
    ['Sales & CRM / Sales Manager', '1110'],
    ['Sales & CRM / Salesman', '1000'],
    ['Administration / Settings', '1111'],
  ],
  'shipment.quote.template': [
    ['Sales & CRM / Sales Administrator', '1111'],
    ['Sales & CRM / Sales Manager', '1100'],
    ['Sales & CRM / Salesman', '1000'],
    ['Administration / Settings', '1111'],
  ],

  // --- costing -------------------------------------------------------------
  // Charge lines are where cost and margin live, so write access is the
  // pricing and operations desks plus billing for the invoicing side. Sales
  // can read them to see what a job earned, and the portal can see nothing.
  'charge.line': [
    ['Pricing / Manage Pricing', '1111'],
    ['Operations / Administrator', '1111'],
    ['Operations / Operation Manager', '1110'],
    ['Operations / Associate', '1100'],
    ['Invoicing / Billing Administrator', '1111'],
    ['Invoicing / Billing', '1110'],
    ['Sales & CRM / Sales Administrator', '1100'],
    ['Sales & CRM / Sales Manager', '1000'],
    ['Service Job / Super Admin', '1111'],
    ['Administration / Settings', '1111'],
  ],
  // Vendor rates are buy-side pricing: the pricing desk owns them.
  'rate.request': [
    ['Pricing / Manage Pricing', '1111'],
    ['Sales & CRM / Sales Administrator', '1111'],
    ['Sales & CRM / Sales Manager', '1110'],
    ['Sales & CRM / Salesman', '1100'],
    ['Purchase / Administrator', '1111'],
    ['Purchase / User', '1110'],
    ['Operations / Administrator', '1000'],
    ['Administration / Settings', '1111'],
  ],

  // --- accounting ----------------------------------------------------------
  'pdc.payment': [
    ['Invoicing / Billing Administrator', '1111'],
    ['Invoicing / Billing', '1110'],
    ['Operations / Administrator', '1000'],
    ['Administration / Settings', '1111'],
  ],
};

module.exports = { GROUPS, MODELS, ACL };
