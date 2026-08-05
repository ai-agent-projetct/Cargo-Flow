// "Administration > Document Reports > Docx Reports" - dedicated list +
// detail records, mirroring SeaRates ERP's "Docx Report Template" screen
// (Report Name / Module columns, and a detail view with Module / Output
// Type / Active / Template (.docx) / Allowed Companies / Data
// Representation / Show Wizard fields plus "Excel Document Usage" and
// "Default Terms & Conditions" tabs).
export const DOCX_REPORTS = [
  { name: 'Booking Confirmation.', module: 'House Shipment', outputType: 'PDF', active: true, template: 'BookingConfirmation.docx', dataRepresentation: 'Form', showWizard: false },
  { name: 'CAN', module: 'House Shipment', outputType: 'PDF', active: true, template: 'CAN.docx', dataRepresentation: 'Form', showWizard: false },
  { name: 'Draft House Bill', module: 'House Shipment', outputType: 'PDF', active: true, template: 'DraftHouseBill.docx', dataRepresentation: 'Form', showWizard: false },
  { name: 'House Bill', module: 'House Shipment', outputType: 'PDF', active: true, template: 'HouseBill.docx', dataRepresentation: 'Form', showWizard: false },
  { name: 'Packing List', module: 'House Shipment', outputType: 'PDF', active: true, template: 'PackingList.docx', dataRepresentation: 'Form', showWizard: false },
  { name: 'Shipping Instruction', module: 'House Shipment', outputType: 'PDF', active: true, template: 'ShippingInstruction.docx', dataRepresentation: 'Form', showWizard: false },
  { name: 'Transport Instruction', module: 'House Shipment', outputType: 'PDF', active: true, template: 'TransportInstruction.docx', dataRepresentation: 'Form', showWizard: false },
  { name: 'Freight Manifest', module: 'House Shipment', outputType: 'PDF', active: true, template: 'FreightManifest.docx', dataRepresentation: 'Form', showWizard: false },
  { name: 'Cargo Manifest', module: 'House Shipment', outputType: 'PDF', active: true, template: 'CargoManifest.docx', dataRepresentation: 'Form', showWizard: false },
  { name: 'Nomination Form', module: 'House Shipment', outputType: 'PDF', active: true, template: 'NominationForm.docx', dataRepresentation: 'Form', showWizard: false },
  { name: 'Line Order Delivery', module: 'House Shipment', outputType: 'PDF', active: true, template: 'LineOrderDelivery.docx', dataRepresentation: 'Form', showWizard: false },
  { name: 'Clearance', module: 'House Shipment', outputType: 'PDF', active: true, template: 'Clearance.docx', dataRepresentation: 'Form', showWizard: false },
  { name: 'Master House Bill', module: 'Master Shipment', outputType: 'PDF', active: true, template: 'MasterHouseBill.docx', dataRepresentation: 'Form', showWizard: false },
  { name: 'Master Draft Bill', module: 'Master Shipment', outputType: 'PDF', active: true, template: 'MasterDraftBill.docx', dataRepresentation: 'Form', showWizard: false },
  { name: 'Master OBL', module: 'Master Shipment', outputType: 'PDF', active: true, template: 'MasterOBL.docx', dataRepresentation: 'Form', showWizard: false },
  { name: 'Master Delivery Order', module: 'Master Shipment', outputType: 'PDF', active: true, template: 'MasterDeliveryOrder.docx', dataRepresentation: 'Form', showWizard: false },
  { name: 'Master Transport Order', module: 'Master Shipment', outputType: 'PDF', active: true, template: 'MasterTransportOrder.docx', dataRepresentation: 'Form', showWizard: false },
  { name: 'Master Pre-CAN', module: 'Master Shipment', outputType: 'PDF', active: true, template: 'MasterPreCAN.docx', dataRepresentation: 'Form', showWizard: false },
  { name: 'Master Pre-Alert', module: 'Master Shipment', outputType: 'PDF', active: true, template: 'MasterPreAlert.docx', dataRepresentation: 'Form', showWizard: false },
  { name: 'Master CAN', module: 'Master Shipment', outputType: 'PDF', active: true, template: 'MasterCAN.docx', dataRepresentation: 'Form', showWizard: false },
  { name: 'Master Cargo-Manifest', module: 'Master Shipment', outputType: 'PDF', active: true, template: 'MasterCargoManifest.docx', dataRepresentation: 'Form', showWizard: false },
  { name: 'Master Container Loading', module: 'Master Shipment', outputType: 'PDF', active: true, template: 'MasterContainerLoading.docx', dataRepresentation: 'Form', showWizard: false },
  { name: 'Master Stuffing Confirmation', module: 'Master Shipment', outputType: 'PDF', active: true, template: 'MasterStuffingConfirmation.docx', dataRepresentation: 'Form', showWizard: false },
  { name: 'Pro-Forma Invoice', module: 'Pro Forma Invoice', outputType: 'PDF', active: true, template: 'ProFormaInvoice.docx', dataRepresentation: 'Form', showWizard: false },
  { name: 'Quotation', module: 'Quote', outputType: 'PDF', active: true, template: 'Quotation.docx', dataRepresentation: 'Form', showWizard: false },
];
