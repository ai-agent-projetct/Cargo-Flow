import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Contexts
import { PermissionProvider } from './context/PermissionContext';
import AccessWarningDialog from './common/AccessWarningDialog';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';

// Common
import Layout from './common/Layout';
import ProtectedRoute from './common/ProtectedRoute';

// Auth
import Login from './pages/auth/Login';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminQuotations from './pages/admin/Quotations';
import AdminQuotationDetail from './pages/admin/QuotationDetail';
import AdminQuotationCreate from './pages/admin/QuotationCreate';
import AdminShipments from './pages/admin/Shipments';
import AdminShipmentDetail from './pages/admin/ShipmentDetail';
import AdminShipmentCreate from './pages/admin/ShipmentCreate';
import AdminJobs from './pages/admin/Jobs';
import AdminJobDetail from './pages/admin/JobDetail';
import AdminInvoices from './pages/admin/Invoices';
import AdminInvoiceDetail from './pages/admin/InvoiceDetail';
import AdminInvoiceCreate from './pages/admin/InvoiceCreate';
import AdminCustomers from './pages/admin/Customers';
import AdminCustomerDetail from './pages/admin/CustomerDetail';
import AdminRates from './pages/admin/Rates';
import AdminRateCreate from './pages/admin/RateCreate';
import AdminCarriers from './pages/admin/Carriers';
import AdminPorts from './pages/admin/Ports';
import AdminSchedules from './pages/admin/Schedules';
import AdminReports from './pages/admin/Reports';
import AdminUsers from './pages/admin/Users';
import AdminUserCreate from './pages/admin/UserCreate';
import AdminUserDetail from './pages/admin/administration/UserDetail';
import AdminSettings from './pages/admin/Settings';

// New Admin Pages
import AdminHouseShipments from './pages/admin/HouseShipments';
import AdminHouseShipmentDetail from './pages/admin/HouseShipmentDetail';
import AdminServiceJobs from './pages/admin/ServiceJobs';
import AdminServiceJobDetail from './pages/admin/ServiceJobDetail';
import AdminOpportunities from './pages/admin/Opportunities';
import FreightBookingLayout from './pages/admin/freight/FreightBookingLayout';
import FreightBookingList from './pages/admin/freight/FreightBookingList';
import FreightBookingDetail from './pages/admin/freight/FreightBookingDetail';
import FreightBookingSettings from './pages/admin/freight/FreightBookingSettings';
import TMSRequestList from './pages/admin/tms/TMSRequestList';
import TMSRequestDetail from './pages/admin/tms/TMSRequestDetail';
import AccessRights from './pages/admin/administration/AccessRights';
import AccountingLayout from './pages/admin/accounting/AccountingLayout';
import AccountingDashboard from './pages/admin/accounting/AccountingDashboard';
import AccountingStub from './pages/admin/accounting/AccountingStub';
import MoveList from './pages/admin/accounting/MoveList';
import MoveDetail from './pages/admin/accounting/MoveDetail';
import PaymentList from './pages/admin/accounting/PaymentList';
import PaymentDetail from './pages/admin/accounting/PaymentDetail';
import ProFormaList from './pages/admin/accounting/ProFormaList';
import ProFormaDetail from './pages/admin/accounting/ProFormaDetail';
import ProductList from './pages/admin/accounting/ProductList';
import ProductDetail from './pages/admin/accounting/ProductDetail';
import PartnerList from './pages/admin/accounting/PartnerList';
import AdminVendorBills from './pages/admin/VendorBills';
import AdminCreditNotes from './pages/admin/CreditNotes';
import AdminOrganizations from './pages/admin/Organizations';
import OrganizationDetail from './pages/admin/OrganizationDetail';
import OrganizationRelated from './pages/admin/organization/OrganizationRelated';
import RMSLayout from './pages/admin/rms/RMSLayout';
import RMSTariffList from './pages/admin/rms/RMSTariffList';
import RMSTariffDetail from './pages/admin/rms/RMSTariffDetail';
import CalendarPage from './pages/admin/calendar/CalendarPage';
import CalendarEventDetail from './pages/admin/calendar/CalendarEventDetail';
import ProcurementLayout from './pages/admin/procurement/ProcurementLayout';
import PurchaseOrderList from './pages/admin/procurement/PurchaseOrderList';
import PurchaseOrderDetail from './pages/admin/procurement/PurchaseOrderDetail';
import MasterShipments from './pages/admin/MasterShipments';
import MasterShipmentDetail from './pages/admin/MasterShipmentDetail';
import CFSReceipts from './pages/admin/CFSReceipts';
import CFSReceiptDetail from './pages/admin/CFSReceiptDetail';
import CFSDeliveries from './pages/admin/CFSDeliveries';
import CFSDeliveryDetail from './pages/admin/CFSDeliveryDetail';
import Consolidations from './pages/admin/Consolidations';
import ConsolidationDetail from './pages/admin/ConsolidationDetail';
import ShipmentSharings from './pages/admin/ShipmentSharings';
import ShipmentSharingDetail from './pages/admin/ShipmentSharingDetail';
import OCRDocuments from './pages/admin/OCRDocuments';
import ContainerNumbers from './pages/admin/ContainerNumbers';
import AdministrationLayout from './pages/admin/administration/AdministrationLayout';
import OperationsLayout from './pages/admin/OperationsLayout';

// User Pages
import UserDashboard from './pages/user/Dashboard';
import UserQuotations from './pages/user/Quotations';
import UserQuotationCreate from './pages/user/QuotationCreate';
import UserQuotationDetail from './pages/user/QuotationDetail';
import UserShipments from './pages/user/Shipments';
import UserShipmentDetail from './pages/user/ShipmentDetail';
import UserInvoices from './pages/user/Invoices';
import UserInvoiceDetail from './pages/user/InvoiceDetail';
import UserTracking from './pages/user/Tracking';
import UserProfile from './pages/user/Profile';

// New User Pages
import UserCreditNotes from './pages/user/CreditNotes';
import UserFFJobs from './pages/user/FFJobs';
import UserFFJobDetail from './pages/user/FFJobDetail';
import UserServiceJobs from './pages/user/ServiceJobs';
import UserServiceJobDetail from './pages/user/ServiceJobDetail';
import UserEvents from './pages/user/Events';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PermissionProvider>
        <AppProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1e293b',
                color: '#f8fafc',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '500',
                padding: '12px 16px',
              },
              success: { iconTheme: { primary: '#22c55e', secondary: '#f8fafc' } },
              error: { iconTheme: { primary: '#ef4444', secondary: '#f8fafc' } },
            }}
          />
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />

            {/* ─── Admin Routes ──────────────────────────────────────────── */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute adminOnly>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/admin/dashboard" replace />} />

              {/* Administration */}
              <Route path="administration/*" element={<AdministrationLayout />} />

              {/* Dashboard variants */}
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="dashboard/quotes" element={<AdminDashboard tab="quotes" />} />
              <Route path="dashboard/shipments" element={<AdminDashboard tab="shipments" />} />

              {/* Operations module - Odoo-style top tab bar layout */}
              <Route element={<OperationsLayout />}>
                {/* Quotations */}
                <Route path="quotations" element={<AdminQuotations />} />
                <Route path="quotations/create" element={<AdminQuotationCreate />} />
                <Route path="quotations/:id" element={<AdminQuotationDetail />} />
                <Route path="quotations/:id/edit" element={<AdminQuotationCreate />} />

                {/* House Shipments (FF Jobs) */}
                <Route path="house-shipments" element={<AdminHouseShipments />} />
                <Route path="house-shipments/create" element={<AdminHouseShipmentDetail />} />
                <Route path="house-shipments/:id" element={<AdminHouseShipmentDetail />} />
                <Route path="master-shipments" element={<MasterShipments />} />
                <Route path="master-shipments/create" element={<MasterShipmentDetail />} />
                <Route path="master-shipments/:id" element={<MasterShipmentDetail />} />
                <Route path="cfs-receipts" element={<CFSReceipts />} />
                <Route path="cfs-receipts/create" element={<CFSReceiptDetail />} />
                <Route path="cfs-receipts/:id" element={<CFSReceiptDetail />} />
                <Route path="cfs-deliveries" element={<CFSDeliveries />} />
                <Route path="cfs-deliveries/create" element={<CFSDeliveryDetail />} />
                <Route path="cfs-deliveries/:id" element={<CFSDeliveryDetail />} />
                <Route path="consolidations" element={<Consolidations />} />
                <Route path="consolidations/create" element={<ConsolidationDetail />} />
                <Route path="consolidations/:id" element={<ConsolidationDetail />} />
                <Route path="shipment-sharings" element={<ShipmentSharings />} />
                <Route path="shipment-sharings/create" element={<ShipmentSharingDetail />} />
                <Route path="shipment-sharings/:id" element={<ShipmentSharingDetail />} />
                <Route path="ocr-documents" element={<OCRDocuments />} />
                <Route path="container-numbers" element={<ContainerNumbers />} />

                {/* Service Jobs */}
                <Route path="service-jobs" element={<AdminServiceJobs />} />
                <Route path="service-jobs/create" element={<AdminServiceJobDetail />} />
                <Route path="service-jobs/:id" element={<AdminServiceJobDetail />} />

                {/* Opportunities */}
                <Route path="opportunities" element={<AdminOpportunities />} />

                {/* Reports */}
                <Route path="reports" element={<AdminReports />} />
              </Route>

              {/* Freight Bookings */}
              {/* Freight Booking — Bookings list/detail + Configuration > Settings */}
              <Route path="freight-bookings" element={<FreightBookingLayout />}>
                <Route index element={<FreightBookingList />} />
                <Route path="settings" element={<FreightBookingSettings />} />
                <Route path="create" element={<FreightBookingDetail />} />
                <Route path=":id" element={<FreightBookingDetail />} />
              </Route>

              {/* Shipments (legacy) */}
              <Route path="shipments" element={<AdminShipments />} />
              <Route path="shipments/create" element={<AdminShipmentCreate />} />
              <Route path="shipments/:id" element={<AdminShipmentDetail />} />
              <Route path="shipments/:id/edit" element={<AdminShipmentCreate />} />

              {/* Jobs (legacy) */}
              <Route path="jobs" element={<AdminJobs />} />
              <Route path="jobs/create" element={<AdminJobDetail />} />
              <Route path="jobs/:id" element={<AdminJobDetail />} />

              {/* Accounting */}
              <Route path="invoices" element={<AdminInvoices />} />
              <Route path="invoices/create" element={<AdminInvoiceCreate />} />
              <Route path="invoices/:id" element={<AdminInvoiceDetail />} />
              <Route path="credit-notes" element={<AdminCreditNotes />} />
              <Route path="vendor-bills" element={<AdminVendorBills />} />
              <Route path="payments" element={<AdminInvoices />} />

              {/* Organizations */}
              <Route path="organizations" element={<AdminOrganizations />} />
              <Route path="organizations/create" element={<OrganizationDetail />} />
              <Route path="organizations/:id" element={<OrganizationDetail />} />
              <Route path="organizations/:id/:type" element={<OrganizationRelated />} />

              {/* RMS — Tariff list/detail under a shared tab bar */}
              <Route path="rms" element={<RMSLayout />}>
                <Route index element={<Navigate to="/admin/rms/tariffs" replace />} />
                <Route path="tariffs" element={<RMSTariffList />} />
                <Route path="tariffs/create" element={<RMSTariffDetail />} />
                <Route path="tariffs/:id" element={<RMSTariffDetail />} />
              </Route>
              {/* Accounting — full 118-node menu; unbuilt leaves render a stub */}
              <Route path="accounting" element={<AccountingLayout />}>
                <Route index element={<Navigate to="/admin/accounting/dashboard" replace />} />
                <Route path="dashboard" element={<AccountingDashboard />} />

                {/* Customers > Invoices / Credit Notes / Debit Notes — one model */}
                <Route path="customers/invoices" element={<MoveList menu="invoices" />} />
                <Route path="customers/invoices/create" element={<MoveDetail menu="invoices" />} />
                <Route path="customers/invoices/:id" element={<MoveDetail menu="invoices" />} />
                <Route path="customers/credit-notes" element={<MoveList menu="credit-notes" />} />
                <Route path="customers/credit-notes/create" element={<MoveDetail menu="credit-notes" />} />
                <Route path="customers/credit-notes/:id" element={<MoveDetail menu="credit-notes" />} />
                <Route path="customers/debit-notes" element={<MoveList menu="debit-notes" />} />
                <Route path="customers/debit-notes/create" element={<MoveDetail menu="debit-notes" />} />
                <Route path="customers/debit-notes/:id" element={<MoveDetail menu="debit-notes" />} />

                {/* Customers > Payments / Pro Forma / Products / Customers */}
                <Route path="customers/payments" element={<PaymentList menu="payments" />} />
                <Route path="customers/payments/create" element={<PaymentDetail menu="payments" />} />
                <Route path="customers/payments/:id" element={<PaymentDetail menu="payments" />} />
                <Route path="customers/pro-forma" element={<ProFormaList />} />
                <Route path="customers/pro-forma/create" element={<ProFormaDetail />} />
                <Route path="customers/pro-forma/:id" element={<ProFormaDetail />} />
                <Route path="customers/products" element={<ProductList menu="products" />} />
                <Route path="customers/products/create" element={<ProductDetail menu="products" />} />
                <Route path="customers/products/:id" element={<ProductDetail menu="products" />} />
                {/* The partner screens are the Organization records, filtered */}
                <Route path="customers/list" element={<PartnerList kind="customer" />} />

                {/* Vendors > Payments / Products / Vendors share the same screens */}
                <Route path="vendors/payments" element={<PaymentList menu="vendor-payments" />} />
                <Route path="vendors/payments/create" element={<PaymentDetail menu="vendor-payments" />} />
                <Route path="vendors/payments/:id" element={<PaymentDetail menu="vendor-payments" />} />
                <Route path="vendors/products" element={<ProductList menu="vendor-products" />} />
                <Route path="vendors/products/create" element={<ProductDetail menu="vendor-products" />} />
                <Route path="vendors/products/:id" element={<ProductDetail menu="vendor-products" />} />
                <Route path="vendors/list" element={<PartnerList kind="vendor" />} />

                <Route path="*" element={<AccountingStub />} />
              </Route>

              {/* TMS — read-only provider requests */}
              <Route path="tms" element={<TMSRequestList />} />
              <Route path="tms/:id" element={<TMSRequestDetail />} />

              {/* Access rights — groups, the ACL matrix, and user assignment */}
              <Route path="access-rights" element={<AccessRights />} />

              {/* Calendar — Meetings across Day/Week/Month/Year + list */}
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="calendar/events/:id" element={<CalendarEventDetail />} />

              {/* Procurement — Purchase list/detail under a shared tab bar */}
              <Route path="procurement" element={<ProcurementLayout />}>
                <Route index element={<Navigate to="/admin/procurement/purchase-orders" replace />} />
                <Route path="purchase-orders" element={<PurchaseOrderList />} />
                <Route path="purchase-orders/create" element={<PurchaseOrderDetail />} />
                <Route path="purchase-orders/:id" element={<PurchaseOrderDetail />} />
              </Route>
              <Route path="customers" element={<AdminCustomers />} />
              <Route path="customers/create" element={<AdminCustomerDetail />} />
              <Route path="customers/:id" element={<AdminCustomerDetail />} />

              {/* Rates */}
              <Route path="rates" element={<AdminRates />} />
              <Route path="rates/create" element={<AdminRateCreate />} />
              <Route path="rates/:id/edit" element={<AdminRateCreate />} />

              {/* Carriers */}
              <Route path="carriers" element={<AdminCarriers />} />
              <Route path="carriers/create" element={<AdminCarriers />} />

              {/* Ports */}
              <Route path="ports" element={<AdminPorts />} />

              {/* Schedules */}
              <Route path="schedules" element={<AdminSchedules />} />

              {/* Users */}
              <Route path="users" element={<AdminUsers />} />
              <Route path="users/create" element={<AdminUserCreate />} />
              <Route path="users/:id/edit" element={<AdminUserCreate />} />
              <Route path="users/:id" element={<AdminUserDetail basePath="/admin/users" />} />

              {/* Settings */}
              <Route path="settings" element={<AdminSettings />} />
            </Route>

            {/* ─── User Routes ───────────────────────────────────────────── */}
            <Route
              path="/user"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/user/dashboard" replace />} />
              <Route path="dashboard" element={<UserDashboard />} />

              {/* Quotations */}
              <Route path="quotations" element={<UserQuotations />} />
              <Route path="quotations/create" element={<UserQuotationCreate />} />
              <Route path="quotations/:id" element={<UserQuotationDetail />} />

              {/* Invoices */}
              <Route path="invoices" element={<UserInvoices />} />
              <Route path="invoices/:id" element={<UserInvoiceDetail />} />

              {/* Credit Notes */}
              <Route path="credit-notes" element={<UserCreditNotes />} />

              {/* FF Jobs */}
              <Route path="ff-jobs" element={<UserFFJobs />} />
              <Route path="ff-jobs/:id" element={<UserFFJobDetail />} />

              {/* Service Jobs */}
              <Route path="service-jobs" element={<UserServiceJobs />} />
              <Route path="service-jobs/:id" element={<UserServiceJobDetail />} />

              {/* Shipments (legacy) */}
              <Route path="shipments" element={<UserShipments />} />
              <Route path="shipments/:id" element={<UserShipmentDetail />} />

              {/* Tracking */}
              <Route path="tracking" element={<UserTracking />} />

              {/* Events */}
              <Route path="events" element={<UserEvents />} />

              {/* Profile */}
              <Route path="profile" element={<UserProfile />} />
            </Route>

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </AppProvider>
        <AccessWarningDialog />
        </PermissionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
