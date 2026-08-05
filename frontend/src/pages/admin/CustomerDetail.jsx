import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Mail, Phone, MapPin, Package, Receipt, TrendingUp } from 'lucide-react';
import { customersAPI } from '../../services/api';
import StatusBadge from '../../common/StatusBadge';
import StatsCard from '../../common/StatsCard';
import DataTable from '../../common/DataTable';
import { formatDate, formatCurrency, getInitials } from '../../utils/helpers';
import { PageLoader } from '../../common/LoadingSpinner';

const mockCustomer = {
  id: 1, companyName: 'Acme Corporation', email: 'shipping@acmecorp.com', phone: '+1 555 0100',
  country: 'USA', city: 'New York', address: '123 Business Park, New York, NY 10001',
  stats: { shipments: 28, totalRevenue: 84500, invoices: 2 },
  createdAt: '2023-06-15T00:00:00Z', status: 'active',
  contactName: 'John Doe', taxId: 'US-EIN-12-3456789', paymentTerms: 30,
};

const mockShipments = [
  { id: 1, shipmentNumber: 'CF-2024-0248', origin: 'Shanghai', destination: 'Rotterdam', status: 'in_transit', estimatedDeparture: '2024-11-20T00:00:00Z', totalAmount: 4850 },
  { id: 2, shipmentNumber: 'CF-2024-0230', origin: 'Dubai', destination: 'London', status: 'delivered', estimatedDeparture: '2024-10-10T00:00:00Z', totalAmount: 2300 },
];

const mockInvoices = [
  { id: 1, invoiceNumber: 'INV-2024-0036', totalAmount: 4850, status: 'sent', dueDate: '2025-01-10T00:00:00Z', issueDate: '2024-12-10T00:00:00Z' },
  { id: 2, invoiceNumber: 'INV-2024-0028', totalAmount: 2300, status: 'paid', dueDate: '2024-11-09T00:00:00Z', issueDate: '2024-10-10T00:00:00Z' },
];

const AdminCustomerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [shipments, setShipments] = useState(mockShipments);
  const [invoices, setInvoices] = useState(mockInvoices);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const fetch = async () => {
      try {
        const [cRes, sRes, iRes] = await Promise.all([
          customersAPI.getById(id),
          customersAPI.getShipments(id),
          customersAPI.getInvoices(id),
        ]);
        setCustomer(cRes.data.data);
        setShipments(sRes.data?.data || mockShipments);
        setInvoices(iRes.data?.data || mockInvoices);
      } catch {
        setCustomer({ ...mockCustomer, id });
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  if (loading) return <PageLoader />;
  if (!customer) return <div className="text-center py-16 text-slate-400">Customer not found</div>;

  const c = customer;

  const shipmentCols = [
    { key: 'shipmentNumber', label: 'Reference', render: (v) => <span className="font-medium text-slate-800 text-sm">{v}</span> },
    { key: 'origin', label: 'Route', render: (v, row) => <span className="text-xs text-slate-600">{v || '-'} → {row.destination || '-'}</span> },
    { key: 'estimatedDeparture', label: 'ETD', render: (v) => <span className="text-xs">{formatDate(v)}</span> },
    { key: 'totalAmount', label: 'Value', render: (v) => <span className="font-medium text-sm">{formatCurrency(v)}</span> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} size="xs" /> },
  ];

  const invoiceCols = [
    { key: 'invoiceNumber', label: 'Invoice #', render: (v) => <span className="font-medium text-slate-800 text-sm">{v}</span> },
    { key: 'issueDate', label: 'Issued', render: (v) => <span className="text-xs">{formatDate(v)}</span> },
    { key: 'dueDate', label: 'Due', render: (v) => <span className="text-xs">{formatDate(v)}</span> },
    { key: 'totalAmount', label: 'Amount', render: (v) => <span className="font-medium text-sm">{formatCurrency(v)}</span> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} size="xs" /> },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/customers')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><ArrowLeft className="w-4 h-4" /></button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-lg font-bold">
              {getInitials(c.companyName)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{c.companyName}</h2>
              <p className="text-sm text-slate-400">{c.city || '-'}, {c.country || '-'}</p>
            </div>
          </div>
        </div>
        <button onClick={() => navigate(`/admin/customers/${id}/edit`)} className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
          <Edit className="w-4 h-4" /> Edit
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Shipments" value={c.stats?.shipments || 0} icon={Package} iconBg="bg-blue-100" iconColor="text-blue-600" />
        <StatsCard title="Total Revenue" value={formatCurrency(c.stats?.totalRevenue)} icon={TrendingUp} iconBg="bg-green-100" iconColor="text-green-600" />
        <StatsCard title="Invoices" value={c.stats?.invoices || 0} icon={Receipt} iconBg="bg-purple-100" iconColor="text-purple-600" />
      </div>

      <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-slate-100 w-fit">
        {['overview', 'shipments', 'invoices'].map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${activeTab === tab ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-semibold text-slate-900 mb-4">Customer Profile</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Company Name', c.companyName],
                ['Contact Person', c.contactName || '—'],
                ['Email', c.email || '—'],
                ['Phone', c.phone || '—'],
                ['Address', c.address || '—'],
                ['Tax ID', c.taxId || '—'],
                ['Payment Terms', c.paymentTerms ? `Net ${c.paymentTerms}` : '—'],
                ['Member Since', formatDate(c.createdAt)],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-slate-500 mb-0.5">{label}</p>
                  <p className="text-sm font-medium text-slate-800">{value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-semibold text-slate-900 mb-4">Quick Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Shipments</span>
                <span className="font-semibold">{c.stats?.shipments || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Total Revenue</span>
                <span className="font-semibold text-green-700">{formatCurrency(c.stats?.totalRevenue)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Invoices</span>
                <span className="font-semibold text-slate-700">{c.stats?.invoices || 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'shipments' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">Shipments</h3>
          </div>
          <DataTable columns={shipmentCols} data={shipments} onRowClick={(row) => navigate(`/admin/shipments/${row.id}`)} emptyMessage="No shipments" />
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">Invoices</h3>
          </div>
          <DataTable columns={invoiceCols} data={invoices} onRowClick={(row) => navigate(`/admin/invoices/${row.id}`)} emptyMessage="No invoices" />
        </div>
      )}
    </div>
  );
};

export default AdminCustomerDetail;
