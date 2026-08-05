import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, RefreshCw, Search } from 'lucide-react';
import { schedulesAPI } from '../../services/api';
import DataTable from '../../common/DataTable';
import SearchBar from '../../common/SearchBar';
import Pagination from '../../common/Pagination';
import { formatDate, getModeIcon } from '../../utils/helpers';

const mockSchedules = {
  count: 35,
  results: [
    { id: 1, carrier: { name: 'Maersk Line' }, vesselName: 'MV Maersk Edinburgh', voyageNumber: 'VOY-448', originPort: { name: 'Shanghai', code: 'CNSHA' }, destinationPort: { name: 'Rotterdam', code: 'NLRTM' }, departureDate: '2024-12-15T00:00:00Z', arrivalDate: '2025-01-20T00:00:00Z', transitDays: 36, mode: 'sea', availableCapacity: 250, capacityUnit: 'TEU' },
    { id: 2, carrier: { name: 'CMA CGM' }, vesselName: 'CMA CGM Marco Polo', voyageNumber: 'FA1-448', originPort: { name: 'Singapore', code: 'SGSIN' }, destinationPort: { name: 'Hamburg', code: 'DEHAM' }, departureDate: '2024-12-18T00:00:00Z', arrivalDate: '2025-01-25T00:00:00Z', transitDays: 38, mode: 'sea', availableCapacity: 180, capacityUnit: 'TEU' },
    { id: 3, carrier: { name: 'Emirates SkyCargo' }, vesselName: 'EK-001', voyageNumber: 'EK001', originPort: { name: 'Dubai', code: 'DXB' }, destinationPort: { name: 'London', code: 'LHR' }, departureDate: '2024-12-14T22:00:00Z', arrivalDate: '2024-12-15T06:00:00Z', transitDays: 1, mode: 'air', availableCapacity: 15, capacityUnit: 'tons' },
    { id: 4, carrier: { name: 'MSC' }, vesselName: 'MSC Giulia', voyageNumber: 'TGR-221', originPort: { name: 'Mumbai', code: 'INNSA' }, destinationPort: { name: 'Los Angeles', code: 'USLAX' }, departureDate: '2024-12-20T00:00:00Z', arrivalDate: '2025-01-28T00:00:00Z', transitDays: 39, mode: 'sea', availableCapacity: 320, capacityUnit: 'TEU' },
    { id: 5, carrier: { name: 'OOCL' }, vesselName: 'OOCL Germany', voyageNumber: 'EC4-119', originPort: { name: 'Hong Kong', code: 'HKHKG' }, destinationPort: { name: 'Sydney', code: 'AUSYD' }, departureDate: '2024-12-16T00:00:00Z', arrivalDate: '2024-12-30T00:00:00Z', transitDays: 14, mode: 'sea', availableCapacity: 90, capacityUnit: 'TEU' },
  ],
};

const AdminSchedules = () => {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await schedulesAPI.getAll({ page, page_size: 15, search: search || undefined });
      const result = response.data;
      setData(result.data || []);
      setTotal(result.pagination?.total || result.data?.length || 0);
    } catch {
      setData(mockSchedules.results);
      setTotal(mockSchedules.count);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    {
      key: 'carrier',
      label: 'Carrier / Vessel',
      render: (v, row) => (
        <div>
          <p className="font-semibold text-slate-900 text-sm">{v?.name || '-'}</p>
          <p className="text-xs text-slate-400">{row.vesselName || '-'} · {row.voyageNumber || row.flightNumber || '-'}</p>
        </div>
      ),
    },
    {
      key: 'originPort',
      label: 'Route',
      render: (v, row) => (
        <div className="text-xs">
          <p className="font-medium text-slate-700">{v ? `${v.name} (${v.code})` : '-'}</p>
          <p className="text-slate-400">→ {row.destinationPort ? `${row.destinationPort.name} (${row.destinationPort.code})` : '-'}</p>
        </div>
      ),
    },
    { key: 'mode', label: 'Mode', render: (v) => <span className="text-sm">{getModeIcon(v)} {v?.toUpperCase()}</span> },
    {
      key: 'departureDate',
      label: 'ETD / ETA',
      render: (v, row) => (
        <div className="text-xs">
          <p className="font-medium text-slate-700">{formatDate(v)}</p>
          <p className="text-slate-400">{formatDate(row.arrivalDate)}</p>
        </div>
      ),
    },
    {
      key: 'transitDays',
      label: 'Transit',
      render: (v) => <span className="text-sm font-medium text-slate-700">{v != null ? `${v} days` : '-'}</span>,
    },
    { key: 'availableCapacity', label: 'Space', render: (v, row) => <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">{v != null ? `${v} ${row.capacityUnit || ''}` : '-'}</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Schedules</h2>
          <p className="text-sm text-slate-500">Sailing & flight schedules</p>
        </div>
        <button onClick={fetchData} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><RefreshCw className="w-4 h-4" /></button>
      </div>
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by carrier, route, vessel..." className="max-w-sm" />
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <DataTable columns={columns} data={data} loading={loading} emptyMessage="No schedules found" emptyIcon={Calendar} />
        <div className="px-4 py-3 border-t border-slate-100">
          <Pagination current={page} total={total} pageSize={15} onChange={setPage} />
        </div>
      </div>
    </div>
  );
};

export default AdminSchedules;
