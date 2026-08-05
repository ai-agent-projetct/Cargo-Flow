import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Filter, Download, Eye, Trash2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { quotationsAPI } from '../../services/api';
import DataTable from '../../common/DataTable';
import StatusBadge from '../../common/StatusBadge';
import SearchBar from '../../common/SearchBar';
import Pagination from '../../common/Pagination';
import Modal from '../../common/Modal';
import { formatDate, formatCurrency, getModeIcon, capitalize } from '../../utils/helpers';
import toast from 'react-hot-toast';

const mockQuotations = {
  count: 48,
  results: [
    { id: 1, quotationNumber: 'QT-SEA-EXP-FCL/2024/00048', quoteNumber: 'QUO-2024-0048', customer: { companyName: 'Acme Corp' }, originCity: 'Shanghai, China', destinationCity: 'Rotterdam, Netherlands', transportMode: 'SEA', status: 'pending', cargoType: 'FCL', totalAmount: 4850, currency: 'USD', createdAt: '2024-12-10T10:00:00Z', validUntil: '2024-12-25T00:00:00Z' },
    { id: 2, quotationNumber: 'QT-AIR-EXP-LCL/2024/00047', quoteNumber: 'QUO-2024-0047', customer: { companyName: 'Pacific Trade Co' }, originCity: 'Dubai, UAE', destinationCity: 'London, UK', transportMode: 'AIR', status: 'approved', cargoType: 'LCL', totalAmount: 2300, currency: 'USD', createdAt: '2024-12-09T14:00:00Z', validUntil: '2024-12-24T00:00:00Z' },
    { id: 3, quotationNumber: 'QT-SEA-EXP-FCL/2024/00046', quoteNumber: 'QUO-2024-0046', customer: { companyName: 'Global Imports Ltd' }, originCity: 'Singapore', destinationCity: 'Hamburg, Germany', transportMode: 'SEA', status: 'converted', cargoType: 'FCL', totalAmount: 6200, currency: 'USD', createdAt: '2024-12-08T09:00:00Z', validUntil: '2024-12-23T00:00:00Z' },
    { id: 4, quotationNumber: 'QT-SEA-EXP-FCL/2024/00045', quoteNumber: 'QUO-2024-0045', customer: { companyName: 'TechShip Inc' }, originCity: 'Mumbai, India', destinationCity: 'Los Angeles, USA', transportMode: 'SEA', status: 'rejected', cargoType: 'FCL', totalAmount: 3800, currency: 'USD', createdAt: '2024-12-07T11:00:00Z', validUntil: '2024-12-22T00:00:00Z' },
    { id: 5, quotationNumber: 'QT-AIR-EXP-LSE/2024/00044', quoteNumber: 'QUO-2024-0044', customer: { companyName: 'Euro Logistics' }, originCity: 'Frankfurt, Germany', destinationCity: 'New York, USA', transportMode: 'AIR', status: 'draft', cargoType: 'LSE', totalAmount: 1850, currency: 'USD', createdAt: '2024-12-06T15:00:00Z', validUntil: '2024-12-21T00:00:00Z' },
    { id: 6, quotationNumber: 'QT-SEA-EXP-FCL/2024/00043', quoteNumber: 'QUO-2024-0043', customer: { companyName: 'Meridian Shipping' }, originCity: 'Guangzhou, China', destinationCity: 'Sydney, Australia', transportMode: 'SEA', status: 'pending', cargoType: 'FCL', totalAmount: 5100, currency: 'USD', createdAt: '2024-12-05T08:00:00Z', validUntil: '2024-12-20T00:00:00Z' },
    { id: 7, quotationNumber: 'QT-SEA-EXP-LCL/2024/00042', quoteNumber: 'QUO-2024-0042', customer: { companyName: 'Swift Cargo' }, originCity: 'Tokyo, Japan', destinationCity: 'Vancouver, Canada', transportMode: 'SEA', status: 'expired', cargoType: 'LCL', totalAmount: 2950, currency: 'USD', createdAt: '2024-11-28T10:00:00Z', validUntil: '2024-12-13T00:00:00Z' },
  ],
};

const AdminQuotations = () => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [confirmModal, setConfirmModal] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await quotationsAPI.getAll({
        page,
        page_size: 15,
        search: search || undefined,
        status: statusFilter || undefined,
        mode: modeFilter || undefined,
      });
      const result = response.data;
      setData(result.data || []);
      setTotal(result.pagination?.total || result.data?.length || 0);
    } catch {
      setData(mockQuotations.results);
      setTotal(mockQuotations.count);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, modeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleApprove = async (id) => {
    setActionLoading(true);
    try {
      await quotationsAPI.approve(id);
      toast.success('Quotation approved');
      fetchData();
    } catch {
      toast.error('Failed to approve');
    } finally {
      setActionLoading(false);
      setConfirmModal(null);
    }
  };

  const handleReject = async (id) => {
    setActionLoading(true);
    try {
      await quotationsAPI.reject(id);
      toast.success('Quotation rejected');
      fetchData();
    } catch {
      toast.error('Failed to reject');
    } finally {
      setActionLoading(false);
      setConfirmModal(null);
    }
  };

  const handleDelete = async (id) => {
    setActionLoading(true);
    try {
      await quotationsAPI.delete(id);
      toast.success('Quotation deleted');
      fetchData();
    } catch {
      toast.error('Failed to delete');
    } finally {
      setActionLoading(false);
      setConfirmModal(null);
    }
  };

  const columns = [
    {
      key: 'quotationNumber',
      label: 'Reference',
      sortable: true,
      render: (v, row) => (
        <div>
          <p className="font-medium text-slate-900 text-sm">{v || row.quoteNumber}</p>
          <p className="text-xs text-slate-400 mt-0.5">{formatDate(row.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      label: 'Customer',
      sortable: true,
      render: (v) => <span className="font-medium text-slate-700">{v?.companyName || '-'}</span>,
    },
    {
      key: 'originCity',
      label: 'Route',
      render: (v, row) => (
        <div className="text-xs">
          <p className="text-slate-700 font-medium">{v || '-'}</p>
          <p className="text-slate-400">→ {row.destinationCity || '-'}</p>
        </div>
      ),
    },
    {
      key: 'transportMode',
      label: 'Mode',
      render: (v) => (
        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <span>{getModeIcon(v?.toLowerCase())}</span> {v ? capitalize(v.toLowerCase()) : '-'}
        </span>
      ),
    },
    {
      key: 'cargoType',
      label: 'Type',
      render: (v) => <span className="text-xs text-slate-600">{v || '-'}</span>,
    },
    {
      key: 'totalAmount',
      label: 'Amount',
      sortable: true,
      render: (v, row) => (
        <span className="font-semibold text-slate-900 text-sm">{formatCurrency(v, row.currency)}</span>
      ),
    },
    {
      key: 'validUntil',
      label: 'Valid Until',
      render: (v) => <span className="text-xs text-slate-600">{formatDate(v)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      stopPropagation: true,
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(`/admin/quotations/${row.id}`)}
            className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
            title="View"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {row.status === 'pending' && (
            <>
              <button
                onClick={() => setConfirmModal({ type: 'approve', id: row.id, ref: (row.quotationNumber || row.quoteNumber) })}
                className="p-1.5 hover:bg-green-50 text-green-600 rounded-lg transition-colors"
                title="Approve"
              >
                <CheckCircle className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setConfirmModal({ type: 'reject', id: row.id, ref: (row.quotationNumber || row.quoteNumber) })}
                className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
                title="Reject"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button
            onClick={() => setConfirmModal({ type: 'delete', id: row.id, ref: (row.quotationNumber || row.quoteNumber) })}
            className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Quotations</h2>
          <p className="text-sm text-slate-500">{total} total quotations</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            <Download className="w-4 h-4" /> Export
          </button>
          <button
            onClick={() => navigate('/admin/quotations/create')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> New Quotation
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex flex-wrap gap-3">
        <SearchBar
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search by reference, customer, route..."
          className="flex-1 min-w-48"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="converted">Converted</option>
          <option value="expired">Expired</option>
        </select>
        <select
          value={modeFilter}
          onChange={(e) => { setModeFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Modes</option>
          <option value="sea">Sea Freight</option>
          <option value="air">Air Freight</option>
          <option value="road">Road</option>
          <option value="rail">Rail</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          onRowClick={(row) => navigate(`/admin/quotations/${row.id}`)}
          emptyMessage="No quotations found"
          emptyIcon={FileText}
        />
        <div className="px-4 py-3 border-t border-slate-100">
          <Pagination current={page} total={total} pageSize={15} onChange={setPage} />
        </div>
      </div>

      {/* Confirm Modal */}
      <Modal
        isOpen={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        title={
          confirmModal?.type === 'approve' ? 'Approve Quotation' :
          confirmModal?.type === 'reject' ? 'Reject Quotation' :
          'Delete Quotation'
        }
        size="sm"
        footer={
          <>
            <button
              onClick={() => setConfirmModal(null)}
              className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={actionLoading}
              onClick={() => {
                if (confirmModal?.type === 'approve') handleApprove(confirmModal.id);
                else if (confirmModal?.type === 'reject') handleReject(confirmModal.id);
                else handleDelete(confirmModal.id);
              }}
              className={`px-4 py-2 text-sm text-white rounded-lg transition-colors font-medium ${
                confirmModal?.type === 'approve' ? 'bg-green-600 hover:bg-green-700' :
                'bg-red-600 hover:bg-red-700'
              }`}
            >
              {actionLoading ? 'Processing...' : confirmModal?.type === 'approve' ? 'Approve' : confirmModal?.type === 'reject' ? 'Reject' : 'Delete'}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to {confirmModal?.type}{' '}
          <span className="font-semibold text-slate-900">{confirmModal?.ref}</span>?
          {confirmModal?.type === 'delete' && ' This action cannot be undone.'}
        </p>
      </Modal>
    </div>
  );
};

export default AdminQuotations;
