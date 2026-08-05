import axios from 'axios';
import toast from 'react-hot-toast';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor - attach token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');

      if (refreshToken) {
        try {
          const response = await axios.post(`${BASE_URL}/auth/refresh`, {
            refreshToken,
          });
          const { accessToken } = response.data.data;
          localStorage.setItem('access_token', accessToken);
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      } else {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }

    const message = error.response?.data?.detail ||
      error.response?.data?.message ||
      (typeof error.response?.data === 'string' ? error.response.data : null) ||
      error.message ||
      'An error occurred';

    if (error.response?.status !== 401) {
      toast.error(message);
    }

    return Promise.reject(error);
  }
);

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  logout: (data) => api.post('/auth/logout', data),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
  refreshToken: (data) => api.post('/auth/refresh', data),
};

// ─── Dashboard ───────────────────────────────────────────────────────────────
export const dashboardAPI = {
  getAdminStats: () => api.get('/dashboard/admin-stats/'),
  getUserStats: () => api.get('/dashboard/user-stats/'),
  getShipmentDashboard: () => api.get('/dashboard/shipment-dashboard/'),
  getCarrierBookingDashboard: () => api.get('/dashboard/carrier-booking-dashboard/'),
  getActivityDashboard: () => api.get('/dashboard/activity-dashboard/'),
  getCreditLimitOverdue: () => api.get('/dashboard/credit-limit-overdue/'),
};

// ─── Quotations ──────────────────────────────────────────────────────────────
export const quotationsAPI = {
  getAll: (params) => api.get('/quotations/', { params }),
  getById: (id) => api.get(`/quotations/${id}/`),
  create: (data) => api.post('/quotations/', data),
  update: (id, data) => api.put(`/quotations/${id}/`, data),
  approve: (id, data) => api.post(`/quotations/${id}/approve/`, data),
  reject: (id, data) => api.post(`/quotations/${id}/reject/`, data),
  cancel: (id) => api.post(`/quotations/${id}/cancel/`),
  convertToShipment: (id, data) => api.post(`/quotations/${id}/convert/`, data),
  convertToFFJob: (id) => api.post(`/quotations/${id}/convert-to-ffjob/`),
  delete: (id) => api.delete(`/quotations/${id}/`),
};

// ─── Shipments ───────────────────────────────────────────────────────────────
export const shipmentsAPI = {
  getAll: (params) => api.get('/shipments/', { params }),
  getById: (id) => api.get(`/shipments/${id}/`),
  create: (data) => api.post('/shipments/', data),
  update: (id, data) => api.put(`/shipments/${id}/`, data),
  updateStatus: (id, data) => api.post(`/shipments/${id}/update-status/`, data),
  delete: (id) => api.delete(`/shipments/${id}/`),
  getDocuments: (id) => api.get(`/shipments/${id}/documents/`),
  uploadDocument: (id, data) => api.post(`/shipments/${id}/documents/`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

// ─── Jobs ─────────────────────────────────────────────────────────────────────
export const jobsAPI = {
  getAll: (params) => api.get('/jobs/', { params }),
  getById: (id) => api.get(`/jobs/${id}/`),
  create: (data) => api.post('/jobs/', data),
  update: (id, data) => api.put(`/jobs/${id}/`, data),
  delete: (id) => api.delete(`/jobs/${id}/`),
};

// ─── Invoices ────────────────────────────────────────────────────────────────
export const invoicesAPI = {
  getAll: (params) => api.get('/invoices/', { params }),
  getById: (id) => api.get(`/invoices/${id}/`),
  create: (data) => api.post('/invoices/', data),
  update: (id, data) => api.put(`/invoices/${id}/`, data),
  delete: (id) => api.delete(`/invoices/${id}/`),
  getPaymentSummary: () => api.get('/invoices/payment-summary/'),
  markPaid: (id, data) => api.post(`/invoices/${id}/mark-paid/`, data),
  sendToCustomer: (id) => api.post(`/invoices/${id}/send/`),
};

// ─── Customers ───────────────────────────────────────────────────────────────
export const customersAPI = {
  getAll: (params) => api.get('/customers/', { params }),
  getById: (id) => api.get(`/customers/${id}/`),
  create: (data) => api.post('/customers/', data),
  update: (id, data) => api.put(`/customers/${id}/`, data),
  delete: (id) => api.delete(`/customers/${id}/`),
  getShipments: (id) => api.get(`/customers/${id}/shipments/`),
  getInvoices: (id) => api.get(`/customers/${id}/invoices/`),
};

// ─── Companies (Administration) ──────────────────────────────────────────────
export const companiesAPI = {
  getAll: (params) => api.get('/companies/', { params }),
  getById: (id) => api.get(`/companies/${id}/`),
  create: (data) => api.post('/companies/', data),
  update: (id, data) => api.put(`/companies/${id}/`, data),
  delete: (id) => api.delete(`/companies/${id}/`),
};

// ─── Organizations (partner master) ──────────────────────────────────────────
export const organizationsAPI = {
  getAll: (params) => api.get('/organizations', { params }),
  getById: (id) => api.get(`/organizations/${id}`),
  create: (data) => api.post('/organizations', data),
  update: (id, data) => api.put(`/organizations/${id}`, data),
  syncPartner: (id) => api.post(`/organizations/${id}/sync-partner`),
  workflow: (id) => api.get(`/organizations/${id}/workflow`),
  related: (id, type) => api.get(`/organizations/${id}/related/${type}`),
  addActivity: (id, data) => api.post(`/organizations/${id}/activity`, data),
  addAddress: (id, data) => api.post(`/organizations/${id}/addresses`, data),
  delete: (id) => api.delete(`/organizations/${id}`),
};

// ─── AI assistant, insights, and document extraction ─────────────────────────
export const aiAPI = {
  status: () => api.get('/ai/status'),
  chat: (data) => api.post('/ai/chat', data),
  insights: () => api.get('/ai/insights'),
  insightsByType: (type) => api.get(`/ai/insights/${type}`),
  extractDocument: (data) => api.post('/ai/extract-document', data),
};

// ─── Departments (Administration) ────────────────────────────────────────────
export const departmentsAPI = {
  getAll: (params) => api.get('/departments/', { params }),
  getById: (id) => api.get(`/departments/${id}/`),
  create: (data) => api.post('/departments/', data),
  update: (id, data) => api.put(`/departments/${id}/`, data),
  delete: (id) => api.delete(`/departments/${id}/`),
};

// ─── Groups (Administration) ─────────────────────────────────────────────────
export const groupsAPI = {
  getAll: (params) => api.get('/groups/', { params }),
  getById: (id) => api.get(`/groups/${id}/`),
  create: (data) => api.post('/groups/', data),
  update: (id, data) => api.put(`/groups/${id}/`, data),
  delete: (id) => api.delete(`/groups/${id}/`),
};

// ─── Incoterms (Administration) ──────────────────────────────────────────────
export const incotermsAPI = {
  getAll: (params) => api.get('/incoterms/', { params }),
  getById: (id) => api.get(`/incoterms/${id}/`),
  create: (data) => api.post('/incoterms/', data),
  update: (id, data) => api.put(`/incoterms/${id}/`, data),
  delete: (id) => api.delete(`/incoterms/${id}/`),
};

// ─── Tariffs (Administration > Tariff: Sell/Buy) ──────────────────────────────
export const tariffsAPI = {
  getAll: (params) => api.get('/tariffs/', { params }),
  getById: (id) => api.get(`/tariffs/${id}/`),
  create: (data) => api.post('/tariffs/', data),
  update: (id, data) => api.put(`/tariffs/${id}/`, data),
  delete: (id) => api.delete(`/tariffs/${id}/`),
  removeAllCharges: (id) => api.post(`/tariffs/${id}/charges/remove-all`),
  uploadCharges: (id, charges) => api.post(`/tariffs/${id}/charges/upload`, { charges }),
};

// ─── CFS Tariff (Administration > CFS Tariff > Charges Tariff) ────────────────
export const cfsTariffsAPI = {
  getAll: (params) => api.get('/cfs-tariffs/', { params }),
  getById: (id) => api.get(`/cfs-tariffs/${id}/`),
  create: (data) => api.post('/cfs-tariffs/', data),
  update: (id, data) => api.put(`/cfs-tariffs/${id}/`, data),
  delete: (id) => api.delete(`/cfs-tariffs/${id}/`),
};

// ─── Rates ───────────────────────────────────────────────────────────────────
export const ratesAPI = {
  getAll: (params) => api.get('/rates/', { params }),
  getById: (id) => api.get(`/rates/${id}/`),
  create: (data) => api.post('/rates/', data),
  update: (id, data) => api.put(`/rates/${id}/`, data),
  delete: (id) => api.delete(`/rates/${id}/`),
  search: (params) => api.get('/rates/search/', { params }),
};

// ─── Carriers ────────────────────────────────────────────────────────────────
export const carriersAPI = {
  getAll: (params) => api.get('/carriers/', { params }),
  getById: (id) => api.get(`/carriers/${id}/`),
  create: (data) => api.post('/carriers/', data),
  update: (id, data) => api.put(`/carriers/${id}/`, data),
};

// ─── Ports ───────────────────────────────────────────────────────────────────
export const portsAPI = {
  getAll: (params) => api.get('/ports/', { params }),
  search: (query) => api.get('/ports/search/', { params: { q: query } }),
};

// ─── Tracking ────────────────────────────────────────────────────────────────
export const trackingAPI = {
  getByShipment: (shipmentId) => api.get(`/tracking/${shipmentId}/`),
  addEvent: (shipmentId, data) => api.post(`/tracking/${shipmentId}/events/`, data),
  getByTrackingNumber: (trackingNumber) => api.get(`/tracking/number/${trackingNumber}/`),
};

// ─── Schedules ───────────────────────────────────────────────────────────────
export const schedulesAPI = {
  getAll: (params) => api.get('/schedules/', { params }),
  getById: (id) => api.get(`/schedules/${id}/`),
  search: (params) => api.get('/schedules/search/', { params }),
};

// ─── Users ───────────────────────────────────────────────────────────────────
export const usersAPI = {
  getAll: (params) => api.get('/users/', { params }),
  getById: (id) => api.get(`/users/${id}/`),
  create: (data) => api.post('/users/', data),
  update: (id, data) => api.put(`/users/${id}/`, data),
  delete: (id) => api.delete(`/users/${id}/`),
  resetPassword: (id) => api.post(`/users/${id}/reset-password/`),
};

// ─── Reports ─────────────────────────────────────────────────────────────────
export const reportsAPI = {
  getShipmentStats: (params) => api.get('/reports/shipments/', { params }),
  getRevenueStats: (params) => api.get('/reports/revenue/', { params }),
  getQuotationStats: (params) => api.get('/reports/quotations/', { params }),
  getCustomerStats: (params) => api.get('/reports/customers/', { params }),
  getCarrierPerformance: (params) => api.get('/reports/carrier-performance/', { params }),
  getOperationsStats: (params) => api.get('/reports/operations/', { params }),
  getAgingReport: (params) => api.get('/reports/aging/', { params }),
};

// ─── Credit Notes ────────────────────────────────────────────────────────────
export const creditNotesAPI = {
  getAll: (params) => api.get('/creditnotes/', { params }),
  getById: (id) => api.get(`/creditnotes/${id}/`),
  create: (data) => api.post('/creditnotes/', data),
  update: (id, data) => api.put(`/creditnotes/${id}/`, data),
  post: (id) => api.post(`/creditnotes/${id}/post/`),
  cancel: (id) => api.post(`/creditnotes/${id}/cancel/`),
  delete: (id) => api.delete(`/creditnotes/${id}/`),
  getStats: () => api.get('/creditnotes/stats/'),
};

// ─── FF Jobs ──────────────────────────────────────────────────────────────────
export const ffJobsAPI = {
  getAll: (params) => api.get('/ffjobs/', { params }),
  getById: (id) => api.get(`/ffjobs/${id}/`),
  getUserJobs: (params) => api.get('/ffjobs/user/', { params }),
  create: (data) => api.post('/ffjobs/', data),
  update: (id, data) => api.put(`/ffjobs/${id}/`, data),
  updateStatus: (id, status) => api.patch(`/ffjobs/${id}/status/`, { status }),
  addTracking: (id, event) => api.post(`/ffjobs/${id}/tracking/`, event),
  getTracking: (id) => api.get(`/ffjobs/${id}/tracking/`),
  getStats: () => api.get('/ffjobs/stats/'),
  delete: (id) => api.delete(`/ffjobs/${id}/`),
};

// ─── Generic Master Data (Administration > Manage) ───────────────────────────
export const masterDataAPI = {
  getAll: (category, params) => api.get(`/master-data/${category}/`, { params }),
  create: (category, data) => api.post(`/master-data/${category}/`, data),
  update: (category, id, data) => api.put(`/master-data/${category}/${id}/`, data),
  delete: (category, id) => api.delete(`/master-data/${category}/${id}/`),
};

// ─── Master Shipments (Console) ──────────────────────────────────────────────
export const masterShipmentsAPI = {
  getAll: (params) => api.get('/master-shipments/', { params }),
  getById: (id) => api.get(`/master-shipments/${id}/`),
  create: (data) => api.post('/master-shipments/', data),
  update: (id, data) => api.put(`/master-shipments/${id}/`, data),
  updateStatus: (id, status, remarks) => api.patch(`/master-shipments/${id}/status/`, { status, remarks }),
  getStats: () => api.get('/master-shipments/stats/'),
  delete: (id) => api.delete(`/master-shipments/${id}/`),
  getHouses: (id) => api.get(`/master-shipments/${id}/houses/`),
  getAvailableHouses: (id, params) => api.get(`/master-shipments/${id}/available-houses/`, { params }),
  attachHouses: (id, houseIds) => api.post(`/master-shipments/${id}/attach-houses/`, { houseIds }),
};

// ─── CFS Receive Entry ────────────────────────────────────────────────────────
export const cfsReceiptsAPI = {
  getAll: (params) => api.get('/cfs-receipts/', { params }),
  getById: (id) => api.get(`/cfs-receipts/${id}/`),
  create: (data) => api.post('/cfs-receipts/', data),
  update: (id, data) => api.put(`/cfs-receipts/${id}/`, data),
  updateStatus: (id, status) => api.patch(`/cfs-receipts/${id}/status/`, { status }),
  delete: (id) => api.delete(`/cfs-receipts/${id}/`),
};

// ─── CFS Delivery Entry ───────────────────────────────────────────────────────
export const cfsDeliveriesAPI = {
  getAll: (params) => api.get('/cfs-deliveries/', { params }),
  getById: (id) => api.get(`/cfs-deliveries/${id}/`),
  create: (data) => api.post('/cfs-deliveries/', data),
  update: (id, data) => api.put(`/cfs-deliveries/${id}/`, data),
  updateStatus: (id, status) => api.patch(`/cfs-deliveries/${id}/status/`, { status }),
  delete: (id) => api.delete(`/cfs-deliveries/${id}/`),
};

// ─── Export Console Generation (Consolidations) ──────────────────────────────
export const consolidationsAPI = {
  getAll: (params) => api.get('/consolidations/', { params }),
  getById: (id) => api.get(`/consolidations/${id}/`),
  create: (data) => api.post('/consolidations/', data),
  update: (id, data) => api.put(`/consolidations/${id}/`, data),
  updateStatus: (id, status) => api.patch(`/consolidations/${id}/status/`, { status }),
  getStats: () => api.get('/consolidations/stats/'),
  delete: (id) => api.delete(`/consolidations/${id}/`),
};

// ─── Shipment Sharing ─────────────────────────────────────────────────────────
export const shipmentSharingsAPI = {
  getAll: (params) => api.get('/shipment-sharings/', { params }),
  getById: (id) => api.get(`/shipment-sharings/${id}/`),
  create: (data) => api.post('/shipment-sharings/', data),
  update: (id, data) => api.put(`/shipment-sharings/${id}/`, data),
  updateStatus: (id, status) => api.patch(`/shipment-sharings/${id}/status/`, { status }),
  convert: (id) => api.patch(`/shipment-sharings/${id}/convert/`),
  getStats: () => api.get('/shipment-sharings/stats/'),
  delete: (id) => api.delete(`/shipment-sharings/${id}/`),
};

// ─── OCR Documents ────────────────────────────────────────────────────────────
export const ocrDocumentsAPI = {
  getAll: (params) => api.get('/ocr-documents/', { params }),
  getById: (id) => api.get(`/ocr-documents/${id}/`),
  upload: (formData) => api.post('/ocr-documents/', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, data) => api.put(`/ocr-documents/${id}/`, data),
  delete: (id) => api.delete(`/ocr-documents/${id}/`),
};

// ─── Container Numbers ────────────────────────────────────────────────────────
export const containerNumbersAPI = {
  getAll: (params) => api.get('/container-numbers/', { params }),
  create: (data) => api.post('/container-numbers/', data),
  bulkCreate: (containerNumbers) => api.post('/container-numbers/bulk/', { containerNumbers }),
  update: (id, data) => api.put(`/container-numbers/${id}/`, data),
  delete: (id) => api.delete(`/container-numbers/${id}/`),
};

// ─── Service Jobs ─────────────────────────────────────────────────────────────
export const serviceJobsAPI = {
  getAll: (params) => api.get('/servicejobs/', { params }),
  getById: (id) => api.get(`/servicejobs/${id}/`),
  getUserJobs: (params) => api.get('/servicejobs/user/', { params }),
  create: (data) => api.post('/servicejobs/', data),
  update: (id, data) => api.put(`/servicejobs/${id}/`, data),
  updateStatus: (id, status) => api.patch(`/servicejobs/${id}/status/`, { status }),
  getStats: () => api.get('/servicejobs/stats/'),
  delete: (id) => api.delete(`/servicejobs/${id}/`),
};

// ─── Events ───────────────────────────────────────────────────────────────────
export const eventsAPI = {
  getAll: (params) => api.get('/events/', { params }),
  getUpcoming: () => api.get('/events/upcoming/'),
  getPast: () => api.get('/events/past/'),
  getById: (id) => api.get(`/events/${id}/`),
  create: (data) => api.post('/events/', data),
  update: (id, data) => api.put(`/events/${id}/`, data),
  delete: (id) => api.delete(`/events/${id}/`),
};

// ─── Opportunities ────────────────────────────────────────────────────────────
export const opportunitiesAPI = {
  getAll: (params) => api.get('/opportunities/', { params }),
  getKanban: () => api.get('/opportunities/kanban/'),
  getById: (id) => api.get(`/opportunities/${id}/`),
  create: (data) => api.post('/opportunities/', data),
  update: (id, data) => api.put(`/opportunities/${id}/`, data),
  updateStage: (id, stage) => api.patch(`/opportunities/${id}/stage/`, { stage }),
  delete: (id) => api.delete(`/opportunities/${id}/`),
};

// ─── Freight Bookings ─────────────────────────────────────────────────────────
export const freightBookingsAPI = {
  getAll: (params) => api.get('/freightbookings/', { params }),
  getById: (id) => api.get(`/freightbookings/${id}/`),
  create: (data) => api.post('/freightbookings/', data),
  update: (id, data) => api.put(`/freightbookings/${id}/`, data),
  delete: (id) => api.delete(`/freightbookings/${id}/`),
};

// ─── Vendor Bills ─────────────────────────────────────────────────────────────
export const vendorBillsAPI = {
  getAll: (params) => api.get('/vendorbills/', { params }),
  getById: (id) => api.get(`/vendorbills/${id}/`),
  create: (data) => api.post('/vendorbills/', data),
  update: (id, data) => api.put(`/vendorbills/${id}/`, data),
  delete: (id) => api.delete(`/vendorbills/${id}/`),
};

// ─── Notifications ───────────────────────────────────────────────────────────
export const notificationsAPI = {
  getAll: (params) => api.get('/notifications/', { params }),
  markRead: (id) => api.post(`/notifications/${id}/read/`),
  markAllRead: () => api.post('/notifications/read-all/'),
  getUnreadCount: () => api.get('/notifications/unread-count/'),
};

export default api;
