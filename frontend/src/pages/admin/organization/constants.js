// Shared bits of the Organizations module.

// KYC progress bar across the top of the form.
export const KYC_STEPS = [
  { key: 'new', label: 'New' },
  { key: 'kyc_pending', label: 'KYC Pending' },
  { key: 'kyc_done', label: 'KYC Done' },
];

// Party Types render as coloured chips, matching the demo's palette.
export const PARTY_TYPE_COLORS = {
  Customer: 'bg-red-100 text-red-700',
  Shipper: 'bg-purple-100 text-purple-700',
  Consignee: 'bg-blue-100 text-blue-700',
  Vendor: 'bg-orange-100 text-orange-700',
  Transporter: 'bg-green-100 text-green-700',
  Customs: 'bg-teal-100 text-teal-700',
  Logistics: 'bg-indigo-100 text-indigo-700',
};

export const partyTypeClass = (name) => PARTY_TYPE_COLORS[name] || 'bg-slate-100 text-slate-700';

// Column sets for each workflow-step drill-down, taken from the live demo.
export const RELATED_COLUMNS = {
  opportunity: [
    ['name', 'Opportunity Number'], ['expectedCloseDate', 'Date'], ['origin', 'Location'],
    ['contactName', 'Prospect'], ['opportunityType', 'Opportunity Type'], ['type', 'Type'],
    ['transportMode', 'Transport Mode'], ['direction', 'Shipment Type'],
    ['incoterm', 'Incoterms'], ['assignedTo', 'Sales Agent'], ['stage', 'Opportunity Stage'],
  ],
  quotation: [
    ['quotationNumber', 'Quotation Number'], ['customerName', 'Customer'], ['status', 'Status'],
    ['totalRevenue', 'Estimated Total Revenue'], ['totalCost', 'Estimated Total Cost'],
    ['estimatedProfit', 'Estimated Profit'],
  ],
  booking: [
    ['jobNumber', 'Booking Ref / Nomination No'], ['hblNumber', 'House BL No'],
    ['shipmentDate', 'Shipment Date'], ['containerCount', 'List Containers Count'],
    ['status', 'State'], ['truckCount', 'Truck Count'],
  ],
  'job-card-sheet': [
    ['jobNumber', 'Booking Ref / Nomination No'], ['hblNumber', 'House BL No'],
    ['shipmentDate', 'Shipment Date'], ['containerCount', 'List Containers Count'],
    ['status', 'State'], ['truckCount', 'Truck Count'],
  ],
  bl: [
    ['masterShipmentNumber', 'Booking Ref / Nomination No'], ['mblNumber', 'Master BL No'],
    ['etd', 'Shipment Date'], ['containerCount', 'List Containers Count'],
    ['status', 'State'], ['carrier', 'Carrier'],
  ],
  'milestone-activity': [
    ['eventType', 'Event Type'], ['status', 'Status'], ['place', 'Place'],
    ['edt', 'EDT'], ['adt', 'ADT'],
  ],
  invoice: [
    ['invoiceNumber', 'Number'], ['serviceJob', 'Service Job'], ['hblNumber', 'House Shipment'],
    ['mblNumber', 'Master Shipment'], ['dueDate', 'Due Date'], ['currency', 'Currency'],
    ['subtotal', 'Tax Excluded'], ['total', 'Total'],
    ['paymentStatus', 'Payment Status'], ['status', 'Status'],
  ],
  'credit-note': [
    ['creditNoteNumber', 'Number'], ['invoiceNumber', 'Invoice'], ['issueDate', 'Date'],
    ['currency', 'Currency'], ['total', 'Total'], ['status', 'Status'],
  ],
  'vendor-invoice': [
    ['billNumber', 'Number'], ['vendorName', 'Vendor'], ['billDate', 'Bill Date'],
    ['dueDate', 'Due Date'], ['currency', 'Currency'], ['total', 'Total'],
    ['paymentStatus', 'Payment Status'], ['status', 'Status'],
  ],
  'vendor-credit-note': [
    ['billNumber', 'Number'], ['vendorName', 'Vendor'], ['billDate', 'Bill Date'],
    ['currency', 'Currency'], ['total', 'Total'], ['status', 'Status'],
  ],
  'delivery-order': [
    ['deliveryNumber', 'Delivery Entry Reference Number'], ['status', 'State'],
  ],
};
