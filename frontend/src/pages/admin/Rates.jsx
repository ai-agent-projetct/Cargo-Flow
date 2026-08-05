import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, DollarSign, RefreshCw, Eye, Trash2, Edit } from 'lucide-react';
import { ratesAPI } from '../../services/api';
import DataTable from '../../common/DataTable';
import SearchBar from '../../common/SearchBar';
import Pagination from '../../common/Pagination';
import Modal from '../../common/Modal';
import { formatDate, formatCurrency, getModeIcon } from '../../utils/helpers';
import toast from 'react-hot-toast';

const mockRates = {
  count: 42,
  results: [
    { id: 1, originPort: { name: 'Shanghai', code: 'CNSHA' }, destinationPort: { name: 'Rotterdam', code: 'NLRTM' }, mode: 'sea', carrier: { name: 'Maersk Line' }, containerType: "40'HC", freightRate: 1800, currency: 'USD', validFrom: '2024-12-01T00:00:00Z', validTo: '2025-01-31T00:00:00Z', status: 'active' },
    { id: 2, originPort: { name: 'Dubai', code: 'DXB' }, destinationPort: { name: 'London', code: 'LHR' }, mode: 'air', carrier: { name: 'Emirates SkyCargo' }, containerType: 'Per KG', freightRate: 4.5, currency: 'USD', validFrom: '2024-12-01T00:00:00Z', validTo: '2025-01-31T00:00:00Z', status: 'active' },
    { id: 3, originPort: { name: 'Singapore', code: 'SGSIN' }, destinationPort: { name: 'Hamburg', code: 'DEHAM' }, mode: 'sea', carrier: { name: 'CMA CGM' }, containerType: "40'GP", freightRate: 1650, currency: 'USD', validFrom: '2024-12-01T00:00:00Z', validTo: '2025-02-28T00:00:00Z', status: 'active' },
    { id: 4, originPort: { name: 'Mumbai', code: 'INNSA' }, destinationPort: { name: 'Los Angeles', code: 'USLAX' }, mode: 'sea', carrier: { name: 'MSC' }, containerType: "20'GP", freightRate: 980, currency: 'USD', validFrom: '2024-11-01T00:00:00Z', validTo: '2024-12-31T00:00:00Z', status: 'expired' },
    { id: 5, originPort: { name: 'Hong Kong', code: 'HKHKG' }, destinationPort: { name: 'Sydney', code: 'AUSYD' }, mode: 'sea', carrier: { name: 'OOCL' }, containerType: "40'HC", freightRate: 1400, currency: 'USD', validFrom: '2024-12-01T00:00:00Z', validTo: '2025-02-28T00:00:00Z', status: 'active' },
  ],
};

const AdminRates = () => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await ratesAPI.getAll({ page, page_size: 15, search: search || undefined, mode: modeFilter || undefined });
      const result = response.data;
      setData(result.data || []);
      setTotal(result.pagination?.total || result.data?.length || 0);
    } catch {
      setData(mockRates.results);
      setTotal(mockRates.count);
    } finally {
      setLoading(false);
    }
  }, [page, search, modeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await ratesAPI.delete(deleteModal.id);
      toast.success('Rate deleted');
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
      key: 'originPort',
      label: 'Route',
      render: (v, row) => (
        <div className="text-sm">
          <p className="font-medium text-slate-800">{v ? `${v.name} (${v.code})` : row.originCountry || '-'}</p>
          <p className="text-slate-400 text-xs">→ {row.destinationPort ? `${row.destinationPort.name} (${row.destinationPort.code})` : row.destinationCountry || '-'}</p>
        </div>
      ),
    },
    { key: 'mode', label: 'Mode', render: (v) => <span className="text-sm">{getModeIcon(v)} {v?.toUpperCase()}</span> },
    { key: 'carrier', label: 'Carrier', render: (v) => <span className="text-sm text-slate-700">{v?.name || '-'}</span> },
    { key: 'containerType', label: 'Container', render: (v) => <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded">{v || '-'}</span> },
    {
      key: 'freightRate',
      label: 'Rate',
      sortable: true,
      render: (v, row) => <span className="font-bold text-primary-700 text-sm">{formatCurrency(v, row.currency)}</span>,
    },
    {
      key: 'validFrom',
      label: 'Validity',
      render: (v, row) => (
        <div className="text-xs">
          <p className="text-slate-600">{formatDate(v)}</p>
          <p className="text-slate-400">to {formatDate(row.validTo)}</p>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => (
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
          v === 'active' ? 'bg-green-100 text-green-700' :
          v === 'expired' ? 'bg-red-100 text-red-700' :
          'bg-slate-100 text-slate-500'
        }`}>
          {v || '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      stopPropagation: true,
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button onClick={() => navigate(`/admin/rates/${row.id}/edit`)} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg"><Edit className="w-3.5 h-3.5" /></button>
          <button onClick={() => setDeleteModal(row)} className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Freight Rates</h2>
          <p className="text-sm text-slate-500">{total} rates configured</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => navigate('/admin/rates/create')} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Add Rate
          </button>
        </div>
      </div>
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex gap-3">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by route, carrier..." className="flex-1 max-w-sm" />
        <select value={modeFilter} onChange={(e) => { setModeFilter(e.target.value); setPage(1); }} className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">All Modes</option>
          <option value="sea">Sea</option>
          <option value="air">Air</option>
          <option value="land">Land</option>
          <option value="rail">Rail</option>
        </select>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <DataTable columns={columns} data={data} loading={loading} emptyMessage="No rates found" emptyIcon={DollarSign} />
        <div className="px-4 py-3 border-t border-slate-100">
          <Pagination current={page} total={total} pageSize={15} onChange={setPage} />
        </div>
      </div>
      <Modal isOpen={!!deleteModal} onClose={() => setDeleteModal(null)} title="Delete Rate" size="sm"
        footer={
          <>
            <button onClick={() => setDeleteModal(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium">{deleting ? 'Deleting...' : 'Delete'}</button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Delete this rate for <strong>{deleteModal?.originPort?.name || deleteModal?.originCountry || '-'} → {deleteModal?.destinationPort?.name || deleteModal?.destinationCountry || '-'}</strong>?</p>
      </Modal>
    </div>
  );
};

export default AdminRates;
