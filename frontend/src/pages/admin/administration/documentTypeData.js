// "Administration > Freight Masters > Document Type" - dedicated list +
// detail records, mirroring CargoFlo ERP's "Document Type" screen (Document
// Type / Related Model / Document Mode / Active columns, and a detail view
// with Related Model link and Document Mode).
export const DOCUMENT_TYPES = [
  { name: 'Service Job', relatedModel: 'Freight Service Job', documentMode: 'IN', active: true },
  { name: 'Packing Quote', relatedModel: 'Quote', documentMode: 'IN', active: true },
  { name: 'Packing List', relatedModel: 'House Shipment', documentMode: 'IN', active: true },
  { name: 'Others', relatedModel: 'House Shipment', documentMode: 'IN', active: true },
  { name: 'Others', relatedModel: 'Quote', documentMode: 'IN', active: true },
  { name: 'Nomination Form', relatedModel: 'House Shipment', documentMode: 'OUT', active: true },
  { name: 'Line Order Delivery', relatedModel: 'House Shipment', documentMode: 'OUT', active: true },
  { name: 'Clearance', relatedModel: 'House Shipment', documentMode: 'OUT', active: true },
  { name: 'Master House Bill', relatedModel: 'Master Shipment', documentMode: 'OUT', active: true },
  { name: 'Master Draft Bill', relatedModel: 'Master Shipment', documentMode: 'OUT', active: true },
  { name: 'Master OBL', relatedModel: 'Master Shipment', documentMode: 'OUT', active: true },
  { name: 'Master Delivery Order', relatedModel: 'Master Shipment', documentMode: 'OUT', active: true },
  { name: 'Master Transport Order', relatedModel: 'Master Shipment', documentMode: 'OUT', active: true },
  { name: 'Master Pre-CAN', relatedModel: 'Master Shipment', documentMode: 'OUT', active: true },
  { name: 'Master Pre-Alert', relatedModel: 'Master Shipment', documentMode: 'OUT', active: true },
  { name: 'Master Cargo-Manifest', relatedModel: 'Master Shipment', documentMode: 'OUT', active: true },
  { name: 'Master Container Loading', relatedModel: 'Master Shipment', documentMode: 'OUT', active: true },
  { name: 'Master Stuffing Confirmation', relatedModel: 'Master Shipment', documentMode: 'OUT', active: true },
  { name: 'Draft House Bill', relatedModel: 'House Shipment', documentMode: 'OUT', active: true },
  { name: 'House Bill', relatedModel: 'House Shipment', documentMode: 'OUT', active: true },
  { name: 'Packing List', relatedModel: 'House Shipment', documentMode: 'OUT', active: true },
  { name: 'Transport Instruction', relatedModel: 'House Shipment', documentMode: 'OUT', active: true },
  { name: 'Shipping Instruction', relatedModel: 'House Shipment', documentMode: 'OUT', active: true },
  { name: 'Freight Manifest', relatedModel: 'House Shipment', documentMode: 'OUT', active: true },
  { name: 'Cargo Manifest', relatedModel: 'House Shipment', documentMode: 'OUT', active: true },
  { name: 'Proforma Invoice', relatedModel: 'Pro Forma Invoice', documentMode: 'OUT', active: true },
  { name: 'Quotation', relatedModel: 'Quote', documentMode: 'OUT', active: true },
  { name: 'Part BL', relatedModel: 'House Shipment Part BL', documentMode: 'OUT', active: true },
  { name: 'Carrier Quote', relatedModel: 'Quote', documentMode: 'IN', active: true },
  { name: 'Commercial Invoice', relatedModel: 'House Shipment', documentMode: 'IN', active: true },
  { name: 'User Document History', relatedModel: 'House Shipment', documentMode: 'IN', active: true },
  { name: 'User Document History', relatedModel: 'Master Shipment', documentMode: 'IN', active: true },
  { name: 'Booking Confirmation', relatedModel: 'House Shipment', documentMode: 'OUT', active: true },
];

export const DOCUMENT_MODE_OPTIONS = ['IN', 'OUT'];

export const RELATED_MODEL_OPTIONS = [
  'Freight Service Job',
  'Quote',
  'House Shipment',
  'Master Shipment',
  'Pro Forma Invoice',
  'House Shipment Part BL',
];
