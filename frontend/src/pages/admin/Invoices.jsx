import React, { useState, useEffect, useCallback } from 'react';
import { exportCsv } from '../../utils/exportCsv';
import { useNavigate } from 'react-router-dom';
import { Plus, Receipt, RefreshCw, Download, Eye, Trash2 } from 'lucide-react';
import { invoicesAPI } from '../../services/api';
import DataTable from '../../common/DataTable';
import StatusBadge from '../../common/StatusBadge';
import SearchBar from '../../common/SearchBar';
import Pagination from '../../common/Pagination';
import StatsCard from '../../common/StatsCard';
import Modal from '../../common/Modal';
import { formatDate, formatCurrency } from '../../utils/helpers';
import toast from 'react-hot-toast';

const mockInvoices = {
  count: 36,
  results: [
    { id: 1, invoiceNumber: 'INV-2024-0036', customer: { companyName: 'Acme Corp' }, shipment: { shipmentNumber: 'CF-2024-0248' }, status: 'sent', totalAmount: 4850, currency: 'USD', dueDate: '2025-01-10T00:00:00Z', issueDate: '2024-12-10T00:00:00Z' },
    { id: 2, invoiceNumber: 'INV-2024-0035', customer: { companyName: 'Pacific Trade' }, shipment: { shipmentNumber: 'CF-2024-0247' }, status: 'paid', totalAmount: 2300, currency: 'USD', dueDate: '2025-01-09T00:00:00Z', issueDate: '2024-12-09T00:00:00Z' },
    { id: 3, invoiceNumber: 'INV-2024-0034', customer: { companyName: 'Global Imports' }, shipment: { shipmentNumber: 'CF-2024-0246' }, status: 'overdue', totalAmount: 6200, currency: 'USD', dueDate: '2024-12-01T00:00:00Z', issueDate: '2024-11-01T00:00:00Z' },
    { id: 4, invoiceNumber: 'INV-2024-0033', customer: { companyName: 'TechShip Inc' }, shipment: { shipmentNumber: 'CF-2024-0245' }, status: 'partially_paid', totalAmount: 3800, currency: 'USD', dueDate: '2025-01-07T00:00:00Z', issueDate: '2024-12-07T00:00:00Z' },
    { id: 5, invoiceNumber: 'INV-2024-0032', customer: { companyName: 'Euro Logistics' }, shipment: { shipmentNumber: 'CF-2024-0244' }, status: 'paid', totalAmount: 1850, currency: 'USD', dueDate: '2024-12-06T00:00:00Z', issueDate: '2024-11-06T00:00:00Z' },
    { id: 6, invoiceNumber: 'INV-2024-0031', customer: { companyName: 'Meridian Shipping' }, shipment: { shipmentNumber: 'CF-2024-0243' }, status: 'draft', totalAmount: 5100, currency: 'USD', dueDate: '2025-01-05T00:00:00Z', issueDate: '2024-12-05T00:00:00Z' },
  ],
};

const mockSummary = {
  total_invoiced: 284500,
  total_paid: 198300,
  total_overdue: 28400,
  total_pending: 57800,
};

const AdminInvoices = () => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState(mockSummary);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, sumRes] = await Promise.all([
        invoicesAPI.getAll({ page, page_size: 15, search: search || undefined, status: statusFilter || undefined }),
        invoicesAPI.getPaymentSummary(),
      ]);
      const result = invRes.data;
      setData(result.data || []);
      setTotal(result.pagination?.total || result.data?.length || 0);
      setSummary(sumRes.data.data);
    } catch {
      setData(mockInvoices.results);
      setTotal(mockInvoices.count);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await invoicesAPI.delete(deleteModal.id);
      toast.success('Invoice deleted');
      fetchData();
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeleting(false);
      setDeleteModal(null);
    }
  };

  const columns = [
    {
      key: 'invoiceNumber',
      label: 'Invoice #',
      sortable: true,
      render: (v, row) => (
        <div>
          <p className="font-semibold text-slate-900 text-sm">{v}</p>
          <p className="text-xs text-slate-400">{formatDate(row.issueDate)}</p>
        </div>
      ),
    },
    { key: 'customer', label: 'Customer', render: (v) => <span className="font-medium text-slate-700 text-sm">{v?.companyName || '-'}</span> },
    { key: 'shipment', label: 'Shipment', render: (v) => <span className="text-xs text-primary-600 font-medium">{v?.shipmentNumber || '-'}</span> },
    {
      key: 'totalAmount',
      label: 'Amount',
      sortable: true,
      render: (v, row) => <span className="font-bold text-slate-900 text-sm">{formatCurrency(v, row.currency)}</span>,
    },
    {
      key: 'dueDate',
      label: 'Due Date',
      render: (v, row) => {
        const isOverdue = row.status === 'overdue';
        return <span className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-slate-600'}`}>{formatDate(v)}</span>;
      },
    },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    {
      key: 'actions',
      label: '',
      stopPropagation: true,
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button onClick={() => navigate(`/admin/invoices/${row.id}`)} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg"><Eye className="w-3.5 h-3.5" /></button>
          <button onClick={() => setDeleteModal(row)} className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ),
    },
  ];

  // Export the rows currently on screen, so the file matches the filters.
  const handleExport = () => {
    if (exportCsv(data, null, 'invoices')) toast.success(`Exported ${data.length} rows`);
    else toast.error('Nothing to export');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Invoices</h2>
          <p className="text-sm text-slate-500">{total} total invoices</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => navigate('/admin/invoices/create')} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> New Invoice
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Invoiced" value={formatCurrency(summary.total_invoiced)} icon={Receipt} iconBg="bg-blue-100" iconColor="text-blue-600" />
        <StatsCard title="Total Paid" value={formatCurrency(summary.total_paid)} icon={Receipt} iconBg="bg-green-100" iconColor="text-green-600" />
        <StatsCard title="Overdue" value={formatCurrency(summary.total_overdue)} icon={Receipt} iconBg="bg-red-100" iconColor="text-red-600" />
        <StatsCard title="Pending" value={formatCurrency(summary.total_pending)} icon={Receipt} iconBg="bg-yellow-100" iconColor="text-yellow-600" />
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex flex-wrap gap-3">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search invoices..." className="flex-1 min-w-48" />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="partially_paid">Partially Paid</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <DataTable columns={columns} data={data} loading={loading} onRowClick={(row) => navigate(`/admin/invoices/${row.id}`)} emptyMessage="No invoices found" emptyIcon={Receipt} />
        <div className="px-4 py-3 border-t border-slate-100">
          <Pagination current={page} total={total} pageSize={15} onChange={setPage} />
        </div>
      </div>

      <Modal isOpen={!!deleteModal} onClose={() => setDeleteModal(null)} title="Delete Invoice" size="sm"
        footer={
          <>
            <button onClick={() => setDeleteModal(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium">{deleting ? 'Deleting...' : 'Delete'}</button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Delete invoice <strong>{deleteModal?.invoiceNumber}</strong>?</p>
      </Modal>
    </div>
  );
};

export default AdminInvoices;
