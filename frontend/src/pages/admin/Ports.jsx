import React, { useState, useEffect, useCallback } from 'react';
import { Anchor, RefreshCw } from 'lucide-react';
import { portsAPI } from '../../services/api';
import DataTable from '../../common/DataTable';
import SearchBar from '../../common/SearchBar';
import Pagination from '../../common/Pagination';

const mockPorts = {
  count: 120,
  results: [
    { id: 1, name: 'Port of Shanghai', code: 'CNSHA', country: 'China', city: 'Shanghai', type: 'sea', status: 'active' },
    { id: 2, name: 'Port of Singapore', code: 'SGSIN', country: 'Singapore', city: 'Singapore', type: 'sea', status: 'active' },
    { id: 3, name: 'Port of Rotterdam', code: 'NLRTM', country: 'Netherlands', city: 'Rotterdam', type: 'sea', status: 'active' },
    { id: 4, name: 'Port of Dubai (Jebel Ali)', code: 'AEJEA', country: 'UAE', city: 'Dubai', type: 'sea', status: 'active' },
    { id: 5, name: 'Port of Hamburg', code: 'DEHAM', country: 'Germany', city: 'Hamburg', type: 'sea', status: 'active' },
    { id: 6, name: 'Dubai International Airport', code: 'DXB', country: 'UAE', city: 'Dubai', type: 'air', status: 'active' },
    { id: 7, name: 'Los Angeles Airport', code: 'LAX', country: 'USA', city: 'Los Angeles', type: 'air', status: 'active' },
    { id: 8, name: 'Frankfurt Airport', code: 'FRA', country: 'Germany', city: 'Frankfurt', type: 'air', status: 'active' },
    { id: 9, name: 'Port Klang', code: 'MYPKG', country: 'Malaysia', city: 'Kuala Lumpur', type: 'sea', status: 'active' },
    { id: 10, name: 'Port of Antwerp', code: 'BEANR', country: 'Belgium', city: 'Antwerp', type: 'sea', status: 'active' },
  ],
};

const AdminPorts = () => {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await portsAPI.getAll({ page, page_size: 15, search: search || undefined, type: typeFilter || undefined });
      const result = response.data;
      setData(result.data || []);
      setTotal(result.pagination?.total || result.data?.length || 0);
    } catch {
      setData(mockPorts.results);
      setTotal(mockPorts.count);
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    {
      key: 'name',
      label: 'Port / Airport',
      sortable: true,
      render: (v, row) => (
        <div>
          <p className="font-semibold text-slate-900 text-sm">{v}</p>
          <p className="text-xs text-slate-400">{row.city}, {row.country}</p>
        </div>
      ),
    },
    {
      key: 'code',
      label: 'Code',
      render: (v) => <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded font-semibold text-slate-700">{v}</span>,
    },
    { key: 'country', label: 'Country', render: (v) => <span className="text-sm text-slate-700">{v}</span> },
    {
      key: 'type',
      label: 'Type',
      render: (v) => {
        const labels = { sea: '🚢 Sea', air: '✈️ Air', inland: '🚛 Inland', rail: '🚂 Rail' };
        const colors = { sea: 'bg-blue-100 text-blue-700', air: 'bg-sky-100 text-sky-700', inland: 'bg-orange-100 text-orange-700', rail: 'bg-purple-100 text-purple-700' };
        return (
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${colors[v] || 'bg-slate-100 text-slate-500'}`}>
            {labels[v] || v || '-'}
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => <span className={`text-xs px-2 py-1 rounded-full font-medium ${v === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{v}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Ports & Airports</h2>
          <p className="text-sm text-slate-500">{total} locations</p>
        </div>
        <button onClick={fetchData} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><RefreshCw className="w-4 h-4" /></button>
      </div>
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex gap-3">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search ports, airports, codes..." className="flex-1 max-w-sm" />
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">All Types</option>
          <option value="sea">Sea Ports</option>
          <option value="air">Airports</option>
          <option value="inland">Inland</option>
          <option value="rail">Rail</option>
        </select>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <DataTable columns={columns} data={data} loading={loading} emptyMessage="No ports found" emptyIcon={Anchor} />
        <div className="px-4 py-3 border-t border-slate-100">
          <Pagination current={page} total={total} pageSize={15} onChange={setPage} />
        </div>
      </div>
    </div>
  );
};

export default AdminPorts;
