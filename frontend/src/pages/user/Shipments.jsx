import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Eye } from 'lucide-react';
import { shipmentsAPI } from '../../services/api';
import DataTable from '../../common/DataTable';
import StatusBadge from '../../common/StatusBadge';
import SearchBar from '../../common/SearchBar';
import Pagination from '../../common/Pagination';
import { formatDate, getModeIcon, getModeColor } from '../../utils/helpers';

const mockShipments = {
  count: 12,
  results: [
    { id: 1, shipmentNumber: 'CF-2024-0248', houseBL: 'MSKU1234567', origin: 'Shanghai, CN', destination: 'Rotterdam, NL', mode: 'sea', status: 'in_transit', estimatedDeparture: '2024-11-20T00:00:00Z', estimatedArrival: '2024-12-25T00:00:00Z' },
    { id: 2, shipmentNumber: 'CF-2024-0230', houseBL: 'EK12345', origin: 'Dubai, AE', destination: 'London, UK', mode: 'air', status: 'delivered', estimatedDeparture: '2024-11-05T00:00:00Z', estimatedArrival: '2024-11-06T00:00:00Z' },
    { id: 3, shipmentNumber: 'CF-2024-0215', houseBL: 'CMA7890', origin: 'Singapore', destination: 'Hamburg, DE', mode: 'sea', status: 'booking_confirmed', estimatedDeparture: '2024-12-20T00:00:00Z', estimatedArrival: '2025-01-25T00:00:00Z' },
    { id: 4, shipmentNumber: 'CF-2024-0198', houseBL: 'MSC4567', origin: 'Mumbai, IN', destination: 'LA, US', mode: 'sea', status: 'customs_clearance', estimatedDeparture: '2024-10-01T00:00:00Z', estimatedArrival: '2024-11-10T00:00:00Z' },
  ],
};

const UserShipments = () => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await shipmentsAPI.getAll({ page, page_size: 15, search: search || undefined, status: statusFilter || undefined, my_shipments: true });
      const result = response.data;
      setData(result.data || []);
      setTotal(result.pagination?.total || result.data?.length || 0);
    } catch {
      setData(mockShipments.results);
      setTotal(mockShipments.count);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    {
      key: 'shipmentNumber',
      label: 'Reference',
      render: (v, row) => (
        <div>
          <p className="font-semibold text-slate-900 text-sm">{v}</p>
          <p className="text-xs text-slate-400">{row.houseBL || row.masterBL || '-'}</p>
        </div>
      ),
    },
    {
      key: 'origin',
      label: 'Route',
      render: (v, row) => (
        <div className="text-xs">
          <p className="font-medium text-slate-700">{v || '-'}</p>
          <p className="text-slate-400">→ {row.destination || '-'}</p>
        </div>
      ),
    },
    { key: 'mode', label: 'Mode', render: (v) => <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getModeColor(v)}`}>{getModeIcon(v)} {v?.toUpperCase()}</span> },
    {
      key: 'estimatedDeparture',
      label: 'ETD / ETA',
      render: (v, row) => (
        <div className="text-xs">
          <p className="text-slate-700">{formatDate(v)}</p>
          <p className="text-slate-400">{formatDate(row.estimatedArrival)}</p>
        </div>
      ),
    },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    {
      key: 'actions',
      label: '',
      stopPropagation: true,
      render: (_, row) => (
        <button onClick={() => navigate(`/user/shipments/${row.id}`)} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg">
          <Eye className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">My Shipments</h2>
          <p className="text-sm text-slate-500">{total} total</p>
        </div>
      </div>
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex gap-3">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search shipments..." className="flex-1 max-w-sm" />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">All Statuses</option>
          <option value="booking_confirmed">Booking Confirmed</option>
          <option value="cargo_received">Cargo Received</option>
          <option value="customs_clearance">Customs Clearance</option>
          <option value="in_transit">In Transit</option>
          <option value="arrived">Arrived</option>
          <option value="delivered">Delivered</option>
          <option value="completed">Completed</option>
        </select>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <DataTable columns={columns} data={data} loading={loading} onRowClick={(row) => navigate(`/user/shipments/${row.id}`)} emptyMessage="No shipments found" emptyIcon={Package} />
        <div className="px-4 py-3 border-t border-slate-100">
          <Pagination current={page} total={total} pageSize={15} onChange={setPage} />
        </div>
      </div>
    </div>
  );
};

export default UserShipments;
