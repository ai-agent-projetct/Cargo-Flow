const User = require('./User');
const Company = require('./Company');
const Customer = require('./Customer');
const Quotation = require('./Quotation');
const Shipment = require('./Shipment');
const Job = require('./Job');
const Invoice = require('./Invoice');
const InvoiceItem = require('./InvoiceItem');
const Rate = require('./Rate');
const Carrier = require('./Carrier');
const Port = require('./Port');
const TrackingEvent = require('./TrackingEvent');
const Document = require('./Document');
const Schedule = require('./Schedule');
const Notification = require('./Notification');
const Container = require('./Container');
const CreditNote = require('./CreditNote');
const FFJob = require('./FFJob');
const ServiceJob = require('./ServiceJob');
const Event = require('./Event');
const VendorBill = require('./VendorBill');
const Opportunity = require('./Opportunity');
const FreightBooking = require('./FreightBooking');
const Department = require('./Department');
const Group = require('./Group');
const Incoterm = require('./Incoterm');
const Tariff = require('./Tariff');
const CFSTariff = require('./CFSTariff');
const MasterShipment = require('./MasterShipment');
const CFSReceipt = require('./CFSReceipt');
const CFSDelivery = require('./CFSDelivery');
const Consolidation = require('./Consolidation');
const ShipmentSharing = require('./ShipmentSharing');
const OCRDocument = require('./OCRDocument');
const ContainerNumber = require('./ContainerNumber');
const Organization = require('./Organization');
const RMSTariff = require('./RMSTariff');
const PurchaseOrder = require('./PurchaseOrder');
const MasterDataItem = require('./MasterDataItem');

// User <-> Company
User.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });
Company.hasMany(User, { foreignKey: 'companyId', as: 'users' });

// Customer associations
Customer.belongsTo(User, { foreignKey: 'assignedTo', as: 'assignedUser' });

// Quotation associations
Quotation.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
Quotation.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
Quotation.belongsTo(User, { foreignKey: 'approvedBy', as: 'approver' });
Quotation.belongsTo(Port, { foreignKey: 'originPortId', as: 'originPort' });
Quotation.belongsTo(Port, { foreignKey: 'destinationPortId', as: 'destinationPort' });
Quotation.belongsTo(Carrier, { foreignKey: 'carrierId', as: 'carrier' });
Quotation.belongsTo(FFJob, { foreignKey: 'ffJobId', as: 'ffJob' });
Quotation.belongsTo(ServiceJob, { foreignKey: 'serviceJobId', as: 'serviceJob' });
Customer.hasMany(Quotation, { foreignKey: 'customerId', as: 'quotations' });

// Shipment associations
Shipment.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
Shipment.belongsTo(Customer, { foreignKey: 'shipperId', as: 'shipper' });
Shipment.belongsTo(Customer, { foreignKey: 'consigneeId', as: 'consignee' });
Shipment.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
Shipment.belongsTo(User, { foreignKey: 'assignedTo', as: 'assignedUser' });
Shipment.belongsTo(Port, { foreignKey: 'originPortId', as: 'originPort' });
Shipment.belongsTo(Port, { foreignKey: 'destinationPortId', as: 'destinationPort' });
Shipment.belongsTo(Carrier, { foreignKey: 'carrierId', as: 'carrier' });
Shipment.belongsTo(Quotation, { foreignKey: 'quotationId', as: 'quotation' });
Shipment.belongsTo(Schedule, { foreignKey: 'scheduleId', as: 'schedule' });
Customer.hasMany(Shipment, { foreignKey: 'customerId', as: 'shipments' });

// Job associations
Job.belongsTo(Shipment, { foreignKey: 'shipmentId', as: 'shipment' });
Job.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
Job.belongsTo(User, { foreignKey: 'assignedTo', as: 'assignedUser' });
Job.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
Shipment.hasMany(Job, { foreignKey: 'shipmentId', as: 'jobs' });

// Invoice associations
Invoice.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
Invoice.belongsTo(Shipment, { foreignKey: 'shipmentId', as: 'shipment' });
Invoice.belongsTo(Quotation, { foreignKey: 'quotationId', as: 'quotation' });
Invoice.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
Invoice.hasMany(InvoiceItem, { foreignKey: 'invoiceId', as: 'items', onDelete: 'CASCADE' });
InvoiceItem.belongsTo(Invoice, { foreignKey: 'invoiceId', as: 'invoice' });
Customer.hasMany(Invoice, { foreignKey: 'customerId', as: 'invoices' });
Shipment.hasMany(Invoice, { foreignKey: 'shipmentId', as: 'invoices' });

// Rate associations
Rate.belongsTo(Carrier, { foreignKey: 'carrierId', as: 'carrier' });
Rate.belongsTo(Port, { foreignKey: 'originPortId', as: 'originPort' });
Rate.belongsTo(Port, { foreignKey: 'destinationPortId', as: 'destinationPort' });
Rate.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

// TrackingEvent associations
TrackingEvent.belongsTo(Shipment, { foreignKey: 'shipmentId', as: 'shipment' });
TrackingEvent.belongsTo(Port, { foreignKey: 'portId', as: 'port' });
TrackingEvent.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
Shipment.hasMany(TrackingEvent, { foreignKey: 'shipmentId', as: 'trackingEvents', onDelete: 'CASCADE' });

// Document associations
Document.belongsTo(Shipment, { foreignKey: 'shipmentId', as: 'shipment' });
Document.belongsTo(Job, { foreignKey: 'jobId', as: 'job' });
Document.belongsTo(Quotation, { foreignKey: 'quotationId', as: 'quotation' });
Document.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
Document.belongsTo(User, { foreignKey: 'uploadedBy', as: 'uploader' });
Shipment.hasMany(Document, { foreignKey: 'shipmentId', as: 'documents' });

// Schedule associations
Schedule.belongsTo(Carrier, { foreignKey: 'carrierId', as: 'carrier' });
Schedule.belongsTo(Port, { foreignKey: 'originPortId', as: 'originPort' });
Schedule.belongsTo(Port, { foreignKey: 'destinationPortId', as: 'destinationPort' });

// Notification associations
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });

// Container associations
Container.belongsTo(Shipment, { foreignKey: 'shipmentId', as: 'shipment' });
Shipment.hasMany(Container, { foreignKey: 'shipmentId', as: 'containers' });

// CreditNote associations
CreditNote.belongsTo(Invoice, { foreignKey: 'invoiceId', as: 'invoice' });
CreditNote.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
CreditNote.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });
CreditNote.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
Invoice.hasMany(CreditNote, { foreignKey: 'invoiceId', as: 'creditNotes' });
Customer.hasMany(CreditNote, { foreignKey: 'customerId', as: 'creditNotes' });

// FFJob associations
FFJob.belongsTo(Quotation, { foreignKey: 'quotationId', as: 'quotation' });
FFJob.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
FFJob.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });
FFJob.belongsTo(User, { foreignKey: 'assignedTo', as: 'assignedUser' });
FFJob.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
FFJob.belongsTo(User, { foreignKey: 'salesAgentId', as: 'salesAgent' });
FFJob.belongsTo(Customer, { foreignKey: 'shipperId', as: 'shipper' });
FFJob.belongsTo(Customer, { foreignKey: 'consigneeId', as: 'consignee' });
FFJob.belongsTo(Port, { foreignKey: 'originPortId', as: 'originPort' });
FFJob.belongsTo(Port, { foreignKey: 'destinationPortId', as: 'destinationPort' });
Customer.hasMany(FFJob, { foreignKey: 'customerId', as: 'ffJobs' });

// ServiceJob associations
ServiceJob.belongsTo(Quotation, { foreignKey: 'quotationId', as: 'quotation' });
ServiceJob.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
ServiceJob.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });
ServiceJob.belongsTo(User, { foreignKey: 'assignedTo', as: 'assignedUser' });
ServiceJob.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
Customer.hasMany(ServiceJob, { foreignKey: 'customerId', as: 'serviceJobs' });

// Event associations
Event.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

// VendorBill associations
VendorBill.belongsTo(Customer, { as: 'vendor', foreignKey: 'vendorId' });
Customer.hasMany(VendorBill, { as: 'vendorBills', foreignKey: 'vendorId' });
VendorBill.belongsTo(FFJob, { foreignKey: 'ffJobId', as: 'ffJob' });
FFJob.hasMany(VendorBill, { foreignKey: 'ffJobId', as: 'vendorBills' });
VendorBill.belongsTo(ServiceJob, { foreignKey: 'serviceJobId', as: 'serviceJob' });
ServiceJob.hasMany(VendorBill, { foreignKey: 'serviceJobId', as: 'vendorBills' });
VendorBill.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });
VendorBill.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

// Opportunity associations
Opportunity.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
Customer.hasMany(Opportunity, { foreignKey: 'customerId', as: 'opportunities' });
Opportunity.belongsTo(User, { as: 'assignee', foreignKey: 'assignedTo' });
Opportunity.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });

// FreightBooking associations
FreightBooking.belongsTo(FFJob, { foreignKey: 'ffJobId', as: 'ffJob' });
FFJob.hasMany(FreightBooking, { foreignKey: 'ffJobId', as: 'freightBookings' });
FreightBooking.belongsTo(Carrier, { foreignKey: 'carrierId', as: 'carrier' });
FreightBooking.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
Customer.hasMany(FreightBooking, { foreignKey: 'customerId', as: 'freightBookings' });
FreightBooking.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });
FreightBooking.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

// Company self-reference & agent
Company.belongsTo(Company, { foreignKey: 'parentCompanyId', as: 'parentCompany' });
Company.hasMany(Company, { foreignKey: 'parentCompanyId', as: 'subsidiaries' });
Company.belongsTo(User, { foreignKey: 'agentId', as: 'agent' });

// Department associations
Department.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });
Department.belongsTo(Department, { foreignKey: 'parentDepartmentId', as: 'parentDepartment' });
Department.hasMany(Department, { foreignKey: 'parentDepartmentId', as: 'subDepartments' });
Department.belongsTo(User, { foreignKey: 'managerId', as: 'manager' });
User.belongsTo(Department, { foreignKey: 'departmentId', as: 'department' });
Department.hasMany(User, { foreignKey: 'departmentId', as: 'members' });

// Tariff associations
Tariff.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });
Tariff.belongsTo(Customer, { foreignKey: 'partyId', as: 'party' });
Tariff.belongsTo(Incoterm, { foreignKey: 'incotermId', as: 'incoterm' });

// CFSTariff associations
CFSTariff.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });
CFSTariff.belongsTo(Customer, { foreignKey: 'partyId', as: 'party' });
CFSTariff.belongsTo(Carrier, { foreignKey: 'shippingLineId', as: 'shippingLine' });
CFSTariff.belongsTo(Port, { foreignKey: 'originPortId', as: 'originPort' });
CFSTariff.belongsTo(Port, { foreignKey: 'destinationPortId', as: 'destinationPort' });

// Group <-> User
Group.belongsToMany(User, { through: 'group_users', as: 'users', foreignKey: 'groupId', otherKey: 'userId' });
User.belongsToMany(Group, { through: 'group_users', as: 'groups', foreignKey: 'userId', otherKey: 'groupId' });

// Operations module associations
MasterShipment.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
MasterShipment.belongsTo(Port, { foreignKey: 'originPortId', as: 'originPort' });
MasterShipment.belongsTo(Port, { foreignKey: 'destinationPortId', as: 'destinationPort' });
FFJob.belongsTo(MasterShipment, { foreignKey: 'masterShipmentId', as: 'masterShipment' });
MasterShipment.hasMany(FFJob, { foreignKey: 'masterShipmentId', as: 'houseShipments' });

CFSReceipt.belongsTo(FFJob, { foreignKey: 'ffJobId', as: 'ffJob' });
CFSDelivery.belongsTo(FFJob, { foreignKey: 'ffJobId', as: 'ffJob' });
OCRDocument.belongsTo(FFJob, { foreignKey: 'ffJobId', as: 'ffJob' });

// Child address records (Invoice/Delivery/Other Address) hang off their parent
// organization, matching the Addresses tab on the SeaRates form.
Organization.hasMany(Organization, { foreignKey: 'parentId', as: 'addresses' });
Organization.belongsTo(Organization, { foreignKey: 'parentId', as: 'parent' });
ShipmentSharing.belongsTo(FFJob, { foreignKey: 'ffJobId', as: 'ffJob' });

module.exports = {
  User,
  Company,
  Customer,
  Quotation,
  Shipment,
  Job,
  Invoice,
  InvoiceItem,
  Rate,
  Carrier,
  Port,
  TrackingEvent,
  Document,
  Schedule,
  Notification,
  Container,
  CreditNote,
  FFJob,
  ServiceJob,
  Event,
  VendorBill,
  Opportunity,
  FreightBooking,
  Department,
  Group,
  Incoterm,
  Tariff,
  CFSTariff,
  MasterShipment,
  CFSReceipt,
  CFSDelivery,
  Consolidation,
  ShipmentSharing,
  OCRDocument,
  ContainerNumber,
  Organization,
  RMSTariff,
  PurchaseOrder,
  MasterDataItem,
};
