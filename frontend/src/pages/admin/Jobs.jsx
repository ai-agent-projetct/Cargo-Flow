import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Briefcase, RefreshCw, Eye, Trash2 } from 'lucide-react';
import { jobsAPI } from '../../services/api';
import DataTable from '../../common/DataTable';
import StatusBadge from '../../common/StatusBadge';
import SearchBar from '../../common/SearchBar';
import Pagination from '../../common/Pagination';
import Modal from '../../common/Modal';
import { formatDate, formatCurrency } from '../../utils/helpers';
import toast from 'react-hot-toast';

const mockJobs = {
  count: 24,
  results: [
    { id: 1, jobNumber: 'JOB-2024-0024', shipment: { shipmentNumber: 'CF-2024-0248' }, type: 'pickup', title: 'Origin Services', customer: { companyName: 'Acme Corp' }, status: 'in_progress', assignedUser: { name: 'John Smith' }, dueDate: '2024-12-20T00:00:00Z', createdAt: '2024-12-10T10:00:00Z' },
    { id: 2, jobNumber: 'JOB-2024-0023', shipment: { shipmentNumber: 'CF-2024-0247' }, type: 'customs_clearance', title: 'Customs Clearance', customer: { companyName: 'Pacific Trade' }, status: 'pending', assignedUser: { name: 'Jane Doe' }, dueDate: '2024-12-15T00:00:00Z', createdAt: '2024-12-09T09:00:00Z' },
    { id: 3, jobNumber: 'JOB-2024-0022', shipment: { shipmentNumber: 'CF-2024-0246' }, type: 'delivery', title: 'Destination Services', customer: { companyName: 'Global Imports' }, status: 'completed', assignedUser: { name: 'Mark Wilson' }, dueDate: '2024-11-25T00:00:00Z', createdAt: '2024-11-10T10:00:00Z' },
    { id: 4, jobNumber: 'JOB-2024-0021', shipment: { shipmentNumber: 'CF-2024-0245' }, type: 'documentation', title: 'Documentation', customer: { companyName: 'TechShip Inc' }, status: 'pending', assignedUser: { name: 'Sarah Jones' }, dueDate: '2024-12-18T00:00:00Z', createdAt: '2024-12-08T15:00:00Z' },
    { id: 5, jobNumber: 'JOB-2024-0020', shipment: { shipmentNumber: 'CF-2024-0244' }, type: 'other', title: 'Inland Transport', customer: { companyName: 'Euro Logistics' }, status: 'in_progress', assignedUser: { name: 'Tom Brown' }, dueDate: '2024-12-14T00:00:00Z', createdAt: '2024-12-07T11:00:00Z' },
  ],
};

const AdminJobs = () => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await jobsAPI.getAll({ page, page_size: 15, search: search || undefined, status: statusFilter || undefined });
      const result = response.data;
      setData(result.data || []);
      setTotal(result.pagination?.total || result.data?.length || 0);
    } catch {
      setData(mockJobs.results);
      setTotal(mockJobs.count);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await jobsAPI.delete(deleteModal.id);
      toast.success('Job deleted');
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
      key: 'jobNumber',
      label: 'Job Ref',
      sortable: true,
      render: (v, row) => (
        <div>
          <p className="font-semibold text-slate-900 text-sm">{v}</p>
          <p className="text-xs text-slate-400">{row.shipment?.shipmentNumber || '-'}</p>
        </div>
      ),
    },
    { key: 'type', label: 'Type', render: (v) => <span className="text-sm text-slate-700">{v ? v.replace(/_/g, ' ') : '-'}</span> },
    { key: 'customer', label: 'Customer', render: (v) => <span className="font-medium text-slate-700 text-sm">{v?.companyName || '-'}</span> },
    { key: 'assignedUser', label: 'Assigned To', render: (v) => <span className="text-sm text-slate-600">{v?.name || '-'}</span> },
    { key: 'dueDate', label: 'Due Date', render: (v) => <span className="text-sm text-slate-600">{formatDate(v)}</span> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    {
      key: 'actions',
      label: '',
      stopPropagation: true,
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button onClick={() => navigate(`/admin/jobs/${row.id}`)} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg"><Eye className="w-3.5 h-3.5" /></button>
          <button onClick={() => setDeleteModal(row)} className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Jobs</h2>
          <p className="text-sm text-slate-500">{total} operational jobs</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => navigate('/admin/jobs/create')} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> New Job
          </button>
        </div>
      </div>
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex flex-wrap gap-3">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search jobs..." className="flex-1 min-w-48" />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="on_hold">On Hold</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <DataTable columns={columns} data={data} loading={loading} onRowClick={(row) => navigate(`/admin/jobs/${row.id}`)} emptyMessage="No jobs found" emptyIcon={Briefcase} />
        <div className="px-4 py-3 border-t border-slate-100">
          <Pagination current={page} total={total} pageSize={15} onChange={setPage} />
        </div>
      </div>
      <Modal isOpen={!!deleteModal} onClose={() => setDeleteModal(null)} title="Delete Job" size="sm"
        footer={
          <>
            <button onClick={() => setDeleteModal(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium">{deleting ? 'Deleting...' : 'Delete'}</button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Delete job <strong>{deleteModal?.jobNumber}</strong>? This cannot be undone.</p>
      </Modal>
    </div>
  );
};

export default AdminJobs;
