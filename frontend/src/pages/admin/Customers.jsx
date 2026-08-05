import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Building2, RefreshCw, Eye, Trash2, Mail, Phone } from 'lucide-react';
import { customersAPI } from '../../services/api';
import DataTable from '../../common/DataTable';
import SearchBar from '../../common/SearchBar';
import Pagination from '../../common/Pagination';
import Modal from '../../common/Modal';
import { formatDate, getInitials } from '../../utils/helpers';
import toast from 'react-hot-toast';

const mockCustomers = {
  count: 89,
  results: [
    { id: 1, companyName: 'Acme Corporation', email: 'shipping@acmecorp.com', phone: '+1 555 0100', country: 'USA', city: 'New York', createdAt: '2023-06-15T00:00:00Z', status: 'active' },
    { id: 2, companyName: 'Pacific Trade Solutions', email: 'ops@pacifictrade.sg', phone: '+65 6123 4567', country: 'Singapore', city: 'Singapore', createdAt: '2023-08-20T00:00:00Z', status: 'active' },
    { id: 3, companyName: 'Global Imports Ltd', email: 'logistics@globalimports.de', phone: '+49 89 1234567', country: 'Germany', city: 'Hamburg', createdAt: '2023-10-05T00:00:00Z', status: 'active' },
    { id: 4, companyName: 'TechShip Inc', email: 'freight@techship.com', phone: '+1 555 0200', country: 'USA', city: 'Los Angeles', createdAt: '2023-05-10T00:00:00Z', status: 'active' },
    { id: 5, companyName: 'Euro Logistics GmbH', email: 'info@eurologistics.de', phone: '+49 69 9876543', country: 'Germany', city: 'Frankfurt', createdAt: '2024-01-15T00:00:00Z', status: 'active' },
    { id: 6, companyName: 'Meridian Shipping', email: 'ops@meridian.ae', phone: '+971 4 123 4567', country: 'UAE', city: 'Dubai', createdAt: '2023-03-20T00:00:00Z', status: 'active' },
    { id: 7, companyName: 'Swift Cargo Japan', email: 'logistics@swiftcargo.jp', phone: '+81 3 1234 5678', country: 'Japan', city: 'Tokyo', createdAt: '2024-02-01T00:00:00Z', status: 'inactive' },
  ],
};

const AdminCustomers = () => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await customersAPI.getAll({ page, page_size: 15, search: search || undefined });
      const result = response.data;
      setData(result.data || []);
      setTotal(result.pagination?.total || result.data?.length || 0);
    } catch {
      setData(mockCustomers.results);
      setTotal(mockCustomers.count);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await customersAPI.delete(deleteModal.id);
      toast.success('Customer deleted');
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
      key: 'companyName',
      label: 'Customer',
      sortable: true,
      render: (v, row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-xs font-bold flex-shrink-0">
            {getInitials(v)}
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">{v}</p>
            <p className="text-xs text-slate-400">{row.city || '-'}{row.city && row.country ? ', ' : ''}{row.country || ''}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      label: 'Contact',
      render: (v, row) => (
        <div className="text-xs">
          <div className="flex items-center gap-1 text-slate-600"><Mail className="w-3 h-3" /> {v || '-'}</div>
          {row.phone && <div className="flex items-center gap-1 text-slate-400 mt-0.5"><Phone className="w-3 h-3" /> {row.phone}</div>}
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (v) => <span className="text-sm text-slate-700 capitalize">{v || '-'}</span>,
    },
    {
      key: 'createdAt',
      label: 'Member Since',
      render: (v) => <span className="text-xs text-slate-500">{formatDate(v)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => (
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${v === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
          {v ? v.charAt(0).toUpperCase() + v.slice(1) : '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      stopPropagation: true,
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button onClick={() => navigate(`/admin/customers/${row.id}`)} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg"><Eye className="w-3.5 h-3.5" /></button>
          <button onClick={() => setDeleteModal(row)} className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Customers</h2>
          <p className="text-sm text-slate-500">{total} total customers</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => navigate('/admin/customers/create')} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Add Customer
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by name, email, country..." className="max-w-md" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <DataTable columns={columns} data={data} loading={loading} onRowClick={(row) => navigate(`/admin/customers/${row.id}`)} emptyMessage="No customers found" emptyIcon={Building2} />
        <div className="px-4 py-3 border-t border-slate-100">
          <Pagination current={page} total={total} pageSize={15} onChange={setPage} />
        </div>
      </div>

      <Modal isOpen={!!deleteModal} onClose={() => setDeleteModal(null)} title="Delete Customer" size="sm"
        footer={
          <>
            <button onClick={() => setDeleteModal(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium">{deleting ? 'Deleting...' : 'Delete'}</button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Delete customer <strong>{deleteModal?.companyName}</strong>? This will not delete their shipments or invoices.</p>
      </Modal>
    </div>
  );
};

export default AdminCustomers;
