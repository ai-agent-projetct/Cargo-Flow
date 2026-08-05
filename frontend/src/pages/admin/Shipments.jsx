import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Package, RefreshCw, Download, Eye, Trash2 } from 'lucide-react';
import { shipmentsAPI } from '../../services/api';
import DataTable from '../../common/DataTable';
import StatusBadge from '../../common/StatusBadge';
import SearchBar from '../../common/SearchBar';
import Pagination from '../../common/Pagination';
import Modal from '../../common/Modal';
import { formatDate, formatCurrency, getModeIcon, getModeColor } from '../../utils/helpers';
import toast from 'react-hot-toast';

const mockShipments = {
  count: 67,
  results: [
    { id: 1, shipmentNumber: 'CF-2024-0248', houseBL: 'MSKU1234567', customer: { companyName: 'Acme Corp' }, origin: 'Shanghai, CN', destination: 'Rotterdam, NL', mode: 'sea', status: 'in_transit', shipmentType: 'FCL', estimatedDeparture: '2024-11-20T00:00:00Z', estimatedArrival: '2024-12-25T00:00:00Z', declaredValue: 4850, currency: 'USD' },
    { id: 2, shipmentNumber: 'CF-2024-0247', houseBL: 'CMAU7654321', customer: { companyName: 'Pacific Trade' }, origin: 'Dubai, AE', destination: 'London, UK', mode: 'air', status: 'customs_clearance', shipmentType: 'Air Freight', estimatedDeparture: '2024-12-01T00:00:00Z', estimatedArrival: '2024-12-12T00:00:00Z', declaredValue: 2300, currency: 'USD' },
    { id: 3, shipmentNumber: 'CF-2024-0246', houseBL: 'HLCU9988776', customer: { companyName: 'Global Imports' }, origin: 'Singapore', destination: 'Hamburg, DE', mode: 'sea', status: 'delivered', shipmentType: 'FCL', estimatedDeparture: '2024-10-15T00:00:00Z', estimatedArrival: '2024-11-20T00:00:00Z', declaredValue: 6200, currency: 'USD' },
    { id: 4, shipmentNumber: 'CF-2024-0245', houseBL: 'MSCU5544332', customer: { companyName: 'TechShip Inc' }, origin: 'Mumbai, IN', destination: 'Los Angeles, US', mode: 'sea', status: 'booking_confirmed', shipmentType: 'FCL', estimatedDeparture: '2024-12-20T00:00:00Z', estimatedArrival: '2025-01-28T00:00:00Z', declaredValue: 3800, currency: 'USD' },
    { id: 5, shipmentNumber: 'CF-2024-0244', houseBL: 'OOLU1122334', customer: { companyName: 'Euro Logistics' }, origin: 'Frankfurt, DE', destination: 'New York, US', mode: 'air', status: 'cargo_received', shipmentType: 'Air Freight', estimatedDeparture: '2024-12-10T00:00:00Z', estimatedArrival: '2024-12-12T00:00:00Z', declaredValue: 1850, currency: 'USD' },
    { id: 6, shipmentNumber: 'CF-2024-0243', houseBL: 'CSAV6677889', customer: { companyName: 'Meridian Shipping' }, origin: 'Guangzhou, CN', destination: 'Sydney, AU', mode: 'sea', status: 'in_transit', shipmentType: 'LCL', estimatedDeparture: '2024-11-25T00:00:00Z', estimatedArrival: '2024-12-30T00:00:00Z', declaredValue: 5100, currency: 'USD' },
    { id: 7, shipmentNumber: 'CF-2024-0242', houseBL: 'YMLU3344556', customer: { companyName: 'Swift Cargo' }, origin: 'Tokyo, JP', destination: 'Vancouver, CA', mode: 'sea', status: 'cancelled', shipmentType: 'FCL', estimatedDeparture: '2024-11-10T00:00:00Z', estimatedArrival: '2024-12-05T00:00:00Z', declaredValue: 2950, currency: 'USD' },
  ],
};

const AdminShipments = () => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await shipmentsAPI.getAll({
        page, page_size: 15,
        search: search || undefined,
        status: statusFilter || undefined,
        mode: modeFilter || undefined,
      });
      const result = response.data;
      setData(result.data || []);
      setTotal(result.pagination?.total || result.data?.length || 0);
    } catch {
      setData(mockShipments.results);
      setTotal(mockShipments.count);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, modeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await shipmentsAPI.delete(deleteModal.id);
      toast.success('Shipment deleted');
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
      key: 'shipmentNumber',
      label: 'Reference',
      sortable: true,
      render: (v, row) => (
        <div>
          <p className="font-semibold text-slate-900 text-sm">{v}</p>
          <p className="text-xs text-slate-400 mt-0.5">{row.houseBL || row.masterBL || '—'}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      label: 'Customer',
      sortable: true,
      render: (v) => <span className="font-medium text-slate-700 text-sm">{v?.companyName || '-'}</span>,
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
    {
      key: 'mode',
      label: 'Mode',
      render: (v) => (
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${getModeColor(v)}`}>
          {getModeIcon(v)} {v?.charAt(0).toUpperCase() + v?.slice(1)}
        </span>
      ),
    },
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
    {
      key: 'declaredValue',
      label: 'Value',
      sortable: true,
      render: (v, row) => <span className="font-semibold text-slate-900 text-sm">{formatCurrency(v, row.currency)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: 'actions',
      label: '',
      stopPropagation: true,
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button onClick={() => navigate(`/admin/shipments/${row.id}`)} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg" title="View">
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setDeleteModal(row)} className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg" title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Shipments</h2>
          <p className="text-sm text-slate-500">{total} total shipments</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><RefreshCw className="w-4 h-4" /></button>
          <button className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => navigate('/admin/shipments/create')} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium">
            <Plus className="w-4 h-4" /> New Shipment
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex flex-wrap gap-3">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by reference, BL number, customer..." className="flex-1 min-w-48" />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">All Statuses</option>
          <option value="booking_confirmed">Booking Confirmed</option>
          <option value="cargo_received">Cargo Received</option>
          <option value="customs_clearance">Customs Clearance</option>
          <option value="loaded">Loaded</option>
          <option value="departed">Departed</option>
          <option value="in_transit">In Transit</option>
          <option value="arrived">Arrived</option>
          <option value="delivered">Delivered</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={modeFilter} onChange={(e) => { setModeFilter(e.target.value); setPage(1); }} className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">All Modes</option>
          <option value="sea">Sea</option>
          <option value="air">Air</option>
          <option value="land">Land</option>
          <option value="rail">Rail</option>
          <option value="multimodal">Multimodal</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          onRowClick={(row) => navigate(`/admin/shipments/${row.id}`)}
          emptyMessage="No shipments found"
          emptyIcon={Package}
        />
        <div className="px-4 py-3 border-t border-slate-100">
          <Pagination current={page} total={total} pageSize={15} onChange={setPage} />
        </div>
      </div>

      <Modal isOpen={!!deleteModal} onClose={() => setDeleteModal(null)} title="Delete Shipment" size="sm"
        footer={
          <>
            <button onClick={() => setDeleteModal(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium">
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Delete shipment <strong>{deleteModal?.shipmentNumber}</strong>? This cannot be undone.</p>
      </Modal>
    </div>
  );
};

export default AdminShipments;
