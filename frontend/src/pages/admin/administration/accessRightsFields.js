// Shared Access Rights field definitions used by both Department and User
// detail pages, matching SeaRates ERP "Access Rights" matrix layout.

export const ROLE_OPTIONS = [
  '',
  'User: Own Documents Only',
  'Administrator',
  'Super Admin',
  'Billing Administrator',
  'Sales Administrator',
  'Sales Manager',
  'Schedule Administrator',
  'Schedule User',
  'Editor and Designer',
  'Restricted Editor',
  'Settings',
  'Access Rights',
  'Customs: Admin',
];

// [leftGroup, rightGroup] pairs rendered side by side
export const ACCESS_RIGHT_ROWS = [
  [
    { group: 'Sales', key: 'sales', label: 'Sales' },
    { group: 'Services', key: 'project', label: 'Project' },
  ],
  [
    { group: 'Accounting', key: 'invoicing', label: 'Invoicing' },
    { group: 'Inventory', key: 'purchase', label: 'Purchase' },
  ],
  [
    { group: 'Website', key: 'liveChat', label: 'Live Chat' },
    { group: 'Marketing', key: 'events', label: 'Events' },
  ],
  [
    { group: null, key: 'website', label: 'Website' },
    { group: null, key: null, label: null },
  ],
  [
    { group: 'Human Resources', key: 'employees', label: 'Employees' },
    { group: 'Administration', key: 'administration', label: 'Administration' },
  ],
  [
    { group: null, key: 'contracts', label: 'Contracts' },
    { group: null, key: null, label: null },
  ],
  [
    { group: null, key: 'recruitment', label: 'Recruitment' },
    { group: null, key: null, label: null },
  ],
];

export const OTHER_FULL_ROWS = [
  { group: 'Other', key: 'auditLogs', label: 'Audit Logs' },
  { key: 'shipment', label: 'Shipment' },
  { key: 'operations', label: 'Operations' },
  { key: 'salesCrm', label: 'Sales & CRM' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'serviceJob', label: 'Service Job' },
  { key: 'wms', label: 'WMS' },
  { key: 'customs', label: 'Customs' },
];

export const OTHER_CHECKBOXES = [
  [
    { key: 'accessExportToImport', label: 'Access Export To Import' },
    { key: 'accessTransactionWorkflow', label: 'Access Transaction Workflow' },
  ],
  [
    { key: 'allowAccessShippingProvider', label: 'Allow to access Shipping Provider' },
    { key: 'completedCancelledShipmentStatusChange', label: 'Completed/Cancelled Shipment Status Change' },
  ],
  [
    { key: 'convertNominationShipment', label: 'Convert Nomination Shipment' },
    { key: 'creditLimitApproverTeam', label: 'Credit Limit Approver Team' },
  ],
  [
    { key: 'directQuoteAccept', label: 'Direct Quote Accept' },
    { key: 'freightApproverTeam', label: 'Freight Approver Team' },
  ],
  [
    { key: 'manageDocuments', label: 'Manage Documents' },
    { key: 'manageKyc', label: 'Manage KYC' },
  ],
  [
    { key: 'managePricing', label: 'Manage Pricing' },
    { key: 'manageRateRequest', label: 'Manage Rate Request' },
  ],
  [
    { key: 'oneMasterAllowEdit', label: 'OneMaster: Allow Edit' },
    { key: 'reExportCreatorTeam', label: 'ReExport Creator Team' },
  ],
];
