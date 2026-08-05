import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Truck, RefreshCw, Edit } from 'lucide-react';
import { carriersAPI } from '../../services/api';
import DataTable from '../../common/DataTable';
import SearchBar from '../../common/SearchBar';
import Pagination from '../../common/Pagination';
const carrierTypeIcons = {
  shipping_line: '🚢',
  airline: '✈️',
  trucking: '🚛',
  rail: '🚂',
};

const mockCarriers = {
  count: 18,
  results: [
    { id: 1, name: 'Maersk Line', code: 'MAEU', type: 'shipping_line', country: 'Denmark', website: 'www.maersk.com', status: 'active' },
    { id: 2, name: 'MSC Mediterranean', code: 'MSCU', type: 'shipping_line', country: 'Switzerland', website: 'www.msc.com', status: 'active' },
    { id: 3, name: 'CMA CGM', code: 'CMAU', type: 'shipping_line', country: 'France', website: 'www.cmacgm.com', status: 'active' },
    { id: 4, name: 'Emirates SkyCargo', code: 'EK', type: 'airline', country: 'UAE', website: 'www.skycargo.com', status: 'active' },
    { id: 5, name: 'Lufthansa Cargo', code: 'LH', type: 'airline', country: 'Germany', website: 'www.lufthansa-cargo.com', status: 'active' },
    { id: 6, name: 'DHL Freight', code: 'DHL', type: 'trucking', country: 'Germany', website: 'www.dhl.com', status: 'active' },
  ],
};

const AdminCarriers = () => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await carriersAPI.getAll({ page, page_size: 15, search: search || undefined });
      const result = response.data;
      setData(result.data || []);
      setTotal(result.pagination?.total || result.data?.length || 0);
    } catch {
      setData(mockCarriers.results);
      setTotal(mockCarriers.count);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    {
      key: 'name',
      label: 'Carrier',
      sortable: true,
      render: (v, row) => (
        <div>
          <p className="font-semibold text-slate-900 text-sm">{v}</p>
          <p className="text-xs text-slate-400">{row.code} · {row.country}</p>
        </div>
      ),
    },
    { key: 'type', label: 'Type', render: (v) => <span className="text-sm">{carrierTypeIcons[v] || ''} {v ? v.replace(/_/g, ' ') : '-'}</span> },
    { key: 'website', label: 'Website', render: (v) => v ? <a href={`https://${v}`} target="_blank" rel="noreferrer" className="text-xs text-primary-600 hover:underline" onClick={(e) => e.stopPropagation()}>{v}</a> : <span className="text-xs text-slate-400">-</span> },
    {
      key: 'status',
      label: 'Status',
      render: (v) => <span className={`text-xs px-2 py-1 rounded-full font-medium ${v === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{v}</span>,
    },
    {
      key: 'actions',
      label: '',
      stopPropagation: true,
      render: (_, row) => (
        <button onClick={() => navigate(`/admin/carriers/${row.id}/edit`)} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg"><Edit className="w-3.5 h-3.5" /></button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Carriers</h2>
          <p className="text-sm text-slate-500">{total} carriers</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => navigate('/admin/carriers/create')} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> Add Carrier
          </button>
        </div>
      </div>
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search carriers..." className="max-w-sm" />
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <DataTable columns={columns} data={data} loading={loading} emptyMessage="No carriers found" emptyIcon={Truck} />
        <div className="px-4 py-3 border-t border-slate-100">
          <Pagination current={page} total={total} pageSize={15} onChange={setPage} />
        </div>
      </div>
    </div>
  );
};

export default AdminCarriers;
