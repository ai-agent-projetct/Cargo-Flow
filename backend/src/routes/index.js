const express = require('express');
const router = express.Router();

// Import all route modules
const authRoutes = require('./auth');
const dashboardRoutes = require('./dashboard');
const quotationRoutes = require('./quotations');
const shipmentRoutes = require('./shipments');
const jobRoutes = require('./jobs');
const invoiceRoutes = require('./invoices');
const customerRoutes = require('./customers');
const rateRoutes = require('./rates');
const carrierRoutes = require('./carriers');
const portRoutes = require('./ports');
const trackingRoutes = require('./tracking');
const documentRoutes = require('./documents');
const scheduleRoutes = require('./schedules');
const userRoutes = require('./users');
const reportRoutes = require('./reports');
const notificationRoutes = require('./notifications');
const creditNoteRoutes = require('./creditnotes');
const ffJobRoutes = require('./ffjobs');
const serviceJobRoutes = require('./servicejobs');
const eventRoutes = require('./events');
const vendorBillRoutes = require('./vendorbills');
const opportunityRoutes = require('./opportunities');
const freightBookingRoutes = require('./freightbookings');
const companyRoutes = require('./companies');
const departmentRoutes = require('./departments');
const groupRoutes = require('./groups');
const incotermRoutes = require('./incoterms');
const tariffRoutes = require('./tariffs');
const cfsTariffRoutes = require('./cfsTariffs');
const masterShipmentRoutes = require('./masterShipments');
const cfsReceiptRoutes = require('./cfsReceipts');
const cfsDeliveryRoutes = require('./cfsDeliveries');
const consolidationRoutes = require('./consolidations');
const organizationRoutes = require('./organizations');
const aiRoutes = require('./ai');
const rmsTariffRoutes = require('./rmsTariffs');
const purchaseOrderRoutes = require('./purchaseOrders');
const calendarEventRoutes = require('./calendarEvents');
const appSettingRoutes = require('./appSettings');
const tmsRequestRoutes = require('./tmsRequests');
const accessControlRoutes = require('./accessControl');
const accountJournalRoutes = require('./accountJournals');
const accountMoveRoutes = require('./accountMoves');
const accountPaymentRoutes = require('./accountPayments');
const proFormaRoutes = require('./proFormas');
const productRoutes = require('./products');
const shipmentSharingRoutes = require('./shipmentSharings');
const ocrDocumentRoutes = require('./ocrDocuments');
const containerNumberRoutes = require('./containerNumbers');
const masterDataRoutes = require('./masterData');

// Middleware to inject socket.io into req
const injectIO = (io) => (req, res, next) => {
  req.io = io;
  next();
};

const registerRoutes = (app, io) => {
  // Apply IO middleware globally
  app.use(injectIO(io));

  // Mount routes
  app.use('/api/auth', authRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/quotations', quotationRoutes);
  app.use('/api/shipments', shipmentRoutes);
  app.use('/api/jobs', jobRoutes);
  app.use('/api/invoices', invoiceRoutes);
  app.use('/api/customers', customerRoutes);
  app.use('/api/rates', rateRoutes);
  app.use('/api/carriers', carrierRoutes);
  app.use('/api/ports', portRoutes);
  app.use('/api/tracking', trackingRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/schedules', scheduleRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/creditnotes', creditNoteRoutes);
  app.use('/api/ffjobs', ffJobRoutes);
  app.use('/api/servicejobs', serviceJobRoutes);
  app.use('/api/events', eventRoutes);
  app.use('/api/vendorbills', vendorBillRoutes);
  app.use('/api/opportunities', opportunityRoutes);
  app.use('/api/freightbookings', freightBookingRoutes);
  app.use('/api/companies', companyRoutes);
  app.use('/api/departments', departmentRoutes);
  app.use('/api/groups', groupRoutes);
  app.use('/api/incoterms', incotermRoutes);
  app.use('/api/tariffs', tariffRoutes);
  app.use('/api/cfs-tariffs', cfsTariffRoutes);
  app.use('/api/master-shipments', masterShipmentRoutes);
  app.use('/api/cfs-receipts', cfsReceiptRoutes);
  app.use('/api/cfs-deliveries', cfsDeliveryRoutes);
  app.use('/api/consolidations', consolidationRoutes);
  app.use('/api/organizations', organizationRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/rms/tariffs', rmsTariffRoutes);
  app.use('/api/procurement/purchase-orders', purchaseOrderRoutes);
  app.use('/api/calendar/events', calendarEventRoutes);
  app.use('/api/settings', appSettingRoutes);
  app.use('/api/tms/requests', tmsRequestRoutes);
  app.use('/api/access', accessControlRoutes);
  app.use('/api/accounting/journals', accountJournalRoutes);
  app.use('/api/accounting/moves', accountMoveRoutes);
  app.use('/api/accounting/payments', accountPaymentRoutes);
  app.use('/api/accounting/pro-formas', proFormaRoutes);
  app.use('/api/accounting/products', productRoutes);
  app.use('/api/shipment-sharings', shipmentSharingRoutes);
  app.use('/api/ocr-documents', ocrDocumentRoutes);
  app.use('/api/container-numbers', containerNumberRoutes);
  app.use('/api/master-data', masterDataRoutes);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'CargoFlo API is running', timestamp: new Date().toISOString() });
  });

  // 404 handler
  app.use('/api/*', (req, res) => {
    res.status(404).json({ success: false, message: 'API endpoint not found' });
  });
};

module.exports = { registerRoutes };
