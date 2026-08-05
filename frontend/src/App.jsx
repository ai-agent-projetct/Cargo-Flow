import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Contexts
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
import AdminFreightBookings from './pages/admin/FreightBookings';
import AdminVendorBills from './pages/admin/VendorBills';
import AdminCreditNotes from './pages/admin/CreditNotes';
import AdminOrganizations from './pages/admin/Organizations';
import OrganizationDetail from './pages/admin/OrganizationDetail';
import OrganizationRelated from './pages/admin/organization/OrganizationRelated';
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
              <Route path="freight-bookings" element={<AdminFreightBookings />} />

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
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
