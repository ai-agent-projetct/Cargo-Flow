// Static config for "Administration > Manage" dropdown + the generic
// master-data pages it links to (Languages, Container Category, Vessels,
// Countries, etc.). `section` marks a non-clickable group header.
// `external` items navigate to an existing standalone admin page instead of
// the generic master-data list.

export const MANAGE_SUBMENU = [
  { key: 'manage/incoterm', label: 'Incoterm' },
  { key: 'manage/carriers', label: 'Carriers' },
  { key: 'manage/carrier-agent', label: 'Carrier Agent' },
  { key: 'manage/hs-codes', label: 'HS Codes' },
  { key: 'manage/un-locode-locations', label: 'UN/LOCODE Locations' },
  { key: 'manage/commodity', label: 'Commodity' },
  { key: 'manage/partner-kyc', label: 'Partner KYC' },
  { key: 'manage/custom-locations', label: 'Custom Locations' },
  { key: 'email', label: 'Email', section: true },
  { key: 'manage/outgoing-mail-servers', label: 'Outgoing Mail Servers', indent: true },
  { key: 'manage/incoming-mail-servers', label: 'Incoming Mail Servers', indent: true },
  { key: 'manage/email-templates', label: 'Email Templates', indent: true },
  { key: 'manage/charge-master', label: 'Charge Master' },
  { key: 'manage/languages', label: 'Languages' },
  { key: 'manage/container-category', label: 'Container Category' },
  { key: 'manage/container-package-type', label: 'Container/Package Type' },
  { key: 'manage/mawb-stocks', label: 'MAWB Stocks' },
  { key: 'manage/status-change-reasons', label: 'Status Change Reasons' },
  { key: 'wms', label: 'WMS Invoice Integration', section: true },
  { key: 'manage/wms-warehouses', label: 'Warehouses', indent: true },
  { key: 'manage/serial-number', label: 'Serial Number' },
  { key: 'ports', label: 'Ports', external: '/admin/ports' },
  { key: 'manage/truck-number', label: 'Truck Number' },
  { key: 'manage/location-type', label: 'Location Type' },
  { key: 'manage/warehouse-depot', label: 'Warehouse/Depot' },
  { key: 'milestones', label: 'Shipment Milestones', section: true },
  { key: 'manage/manage-milestones', label: 'Manage Milestones', indent: true },
  { key: 'localization', label: 'Localization', section: true },
  { key: 'manage/countries', label: 'Countries', indent: true },
  { key: 'manage/fed-states', label: 'Fed. States', indent: true },
  { key: 'manage/country-group', label: 'Country Group', indent: true },
  { key: 'manage/cities', label: 'Cities', indent: true },
  { key: 'manage/shipment-change-reason', label: 'Shipment Change Reason' },
  { key: 'manage/service-job-type', label: 'Service Job Type' },
  { key: 'manage/custom-be-type', label: 'Custom BE Type' },
  { key: 'vessels', label: 'Vessels', section: true },
  { key: 'manage/vessel', label: 'Vessel', indent: true },
  { key: 'manage/vessel-category', label: 'Vessel Category', indent: true },
  { key: 'workflow', label: 'Workflow Management', section: true },
  { key: 'manage/transaction-workflow', label: 'Transaction Workflow', indent: true },
  { key: 'manage/milestone-activity-master', label: 'Milestone Activity Master', indent: true },
  { key: 'credit-limit', label: 'Credit Limit Configure', section: true },
  { key: 'manage/credit-request-master', label: 'Credit Request Master', indent: true },
];

// Per-category page config for GenericMasterList: title + an ordered list of
// fields to show as columns (and as inputs on the inline create row).
// Each field maps to one of the underlying record columns: code, name,
// extra, extra2. `key: 'isActive'` renders the Active toggle.
// Verified against the live CargoFlo demo (Administration > Manage):
//  - Container Category: single "Category Name" column (no code).
//  - Countries: "Country Name" then "Country Code" (no extra/currency).
//  - Vessel: Code, Vessel Name, IMO Number, MMSI Number.
// Other categories keep a Code/Name(+extra) layout consistent with the rest
// of the Manage section's simple master-list pattern.
export const MASTER_DATA_CONFIG = {
  incoterm: {
    title: 'Incoterms',
    activeLabel: 'Enable Pick-up & Delivery Address',
    fields: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Name' },
    ],
  },
  carriers: {
    title: 'Carriers',
    fields: [
      { key: 'code', label: 'Transport Mode' },
      { key: 'name', label: 'Name' },
      { key: 'extra', label: 'Email' },
      { key: 'extra2', label: 'Carrier Contact Person' },
      { key: 'extra3', label: 'Related Organization' },
    ],
  },
  'carrier-agent': {
    title: 'Carrier Agent',
    fields: [
      { key: 'code', label: 'Reference' },
      { key: 'name', label: 'Name' },
      { key: 'extra', label: 'Email' },
      { key: 'extra2', label: 'Country' },
    ],
  },
  'hs-codes': {
    title: 'HS Codes',
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'code', label: 'Code' },
      { key: 'extra', label: 'Code Range' },
      { key: 'extra2', label: 'For Country' },
    ],
  },
  'un-locode-locations': {
    title: 'UN/LOCODE Locations',
    fields: [
      { key: 'name', label: 'Location Name' },
      { key: 'extra', label: 'Country' },
      { key: 'code', label: 'LOC Code' },
      { key: 'extra2', label: 'Sub Division' },
    ],
  },
  commodity: {
    title: 'Commodity',
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'code', label: 'Code' },
      { key: 'extra', label: 'HS Code' },
      { key: 'extra2', label: 'Is HAZ' },
    ],
  },
  'partner-kyc': {
    title: 'Partner KYC',
    fields: [
      { key: 'name', label: 'Name' },
    ],
  },
  'custom-locations': {
    title: 'Custom Locations',
    fields: [
      { key: 'name', label: 'Custom Location' },
      { key: 'extra', label: 'Country' },
      { key: 'extra2', label: 'State' },
      { key: 'extra3', label: 'City' },
    ],
  },
  'outgoing-mail-servers': {
    title: 'Outgoing Mail Servers',
    fields: [
      { key: 'code', label: 'Priority' },
      { key: 'name', label: 'Description' },
      { key: 'extra', label: 'SMTP Server' },
      { key: 'extra2', label: 'Username' },
      { key: 'extra3', label: 'Connection Security' },
    ],
  },
  'incoming-mail-servers': {
    title: 'Incoming Mail Servers',
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'code', label: 'Server' },
      { key: 'extra', label: 'Server Type' },
      { key: 'extra2', label: 'Actions to Perform on Incoming Mails' },
    ],
  },
  'email-templates': {
    title: 'Email Templates',
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'code', label: 'Applies to' },
      { key: 'extra', label: 'Subject' },
      { key: 'extra2', label: 'From' },
      { key: 'extra3', label: 'To (Partners)' },
    ],
  },
  'charge-master': {
    title: 'Charge Master',
    fields: [
      { key: 'name', label: 'Product Name' },
      { key: 'code', label: 'Internal Reference' },
      { key: 'extra', label: 'Sales Price' },
      { key: 'extra2', label: 'Cost' },
    ],
  },
  languages: {
    title: 'Languages',
    fields: [
      { key: 'name', label: 'Language' },
      { key: 'code', label: 'Code' },
      { key: 'isActive', label: 'Active' },
    ],
  },
  'container-category': {
    title: 'Container Category',
    fields: [
      { key: 'name', label: 'Category Name' },
    ],
  },
  'container-package-type': {
    title: 'Container/Package Type',
    fields: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Description' },
      { key: 'extra', label: 'Container Category' },
    ],
  },
  'mawb-stocks': {
    title: 'MAWB Stocks',
    fields: [
      { key: 'name', label: 'Home Airport' },
      { key: 'code', label: 'AWB Serial No.' },
      { key: 'extra', label: 'Borrowed from Customer-Agent' },
      { key: 'extra2', label: 'Air Line' },
      { key: 'extra3', label: 'State' },
    ],
  },
  'status-change-reasons': {
    title: 'Quotation Status Change Reasons',
    fields: [
      { key: 'name', label: 'Reasons' },
    ],
  },
  'wms-warehouses': {
    title: 'Warehouses',
    fields: [
      { key: 'code', label: 'Warehouse Code' },
      { key: 'name', label: 'Warehouse Name' },
      { key: 'extra', label: 'City Code' },
      { key: 'extra2', label: 'Mobile' },
      { key: 'extra3', label: 'Email' },
    ],
  },
  'serial-number': {
    title: 'Serial Number',
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'extra', label: 'Freight Product' },
      { key: 'extra2', label: 'Model' },
      { key: 'extra3', label: 'Field' },
    ],
  },
  'truck-number': {
    title: 'Truck Number',
    fields: [
      { key: 'code', label: 'Truck No.' },
      { key: 'name', label: 'Name' },
      { key: 'extra', label: 'Details' },
    ],
  },
  'location-type': {
    title: 'Location Type',
    fields: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Location Type' },
    ],
  },
  'warehouse-depot': {
    title: 'Warehouse/Depot',
    fields: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Name' },
      { key: 'extra', label: 'Location' },
    ],
  },
  'manage-milestones': {
    title: 'Manage Milestones',
    fields: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Milestone' },
    ],
  },
  countries: {
    title: 'Countries',
    fields: [
      { key: 'name', label: 'Country Name' },
      { key: 'code', label: 'Country Code' },
    ],
  },
  'fed-states': {
    title: 'Fed. States',
    fields: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'State' },
      { key: 'extra', label: 'Country' },
    ],
  },
  'country-group': {
    title: 'Country Group',
    fields: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Group Name' },
    ],
  },
  cities: {
    title: 'Cities',
    fields: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'City' },
      { key: 'extra', label: 'Country' },
    ],
  },
  'shipment-change-reason': {
    title: 'Shipment Change Reason',
    fields: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Reason' },
    ],
  },
  'service-job-type': {
    title: 'Service Job Type',
    fields: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Job Type' },
    ],
  },
  'custom-be-type': {
    title: 'Custom BE Type',
    fields: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'BE Type' },
    ],
  },
  vessel: {
    title: 'Vessel',
    fields: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Vessel Name' },
      { key: 'extra', label: 'IMO Number' },
      { key: 'extra2', label: 'MMSI Number' },
    ],
  },
  'vessel-category': {
    title: 'Vessel Category',
    fields: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Category Name' },
    ],
  },
  'transaction-workflow': {
    title: 'Transaction Workflow',
    fields: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Workflow Name' },
      { key: 'extra', label: 'Applies To' },
    ],
  },
  'milestone-activity-master': {
    title: 'Milestone Activity Master',
    fields: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Activity' },
      { key: 'extra', label: 'Stage' },
    ],
  },
  'credit-request-master': {
    title: 'Credit Request Master',
    fields: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Request Type' },
      { key: 'extra', label: 'Validity' },
    ],
  },
};
