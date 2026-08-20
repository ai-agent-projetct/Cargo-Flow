import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { cfsDeliveriesAPI } from '../../services/api';
import { getFFJobStatusColor } from '../../utils/helpers';
import { PageLoader } from '../../common/LoadingSpinner';
import { useListView } from './administration/useListView';
import { TRANSPORT_MODES, CARGO_TYPES } from './houseShipment/constants';
import ExportDataModal from '../../components/ExportDataModal';
import { CFS_DELIVERY_EXPORT_FIELDS } from './cfs/exportFields';

const mockDeliveries = [
  { id: 1, deliveryNumber: 'CFS-DLV-2026-00001', cfsLocation: 'Jebel Ali CFS', transportMode: 'SEA', cargoType: 'LCL', containerNumber: 'MSCU1234567', vehicleNumber: 'DXB-54321', gateOutDate: '2026-06-14', packages: 25, grossWeight: 1200, status: 'delivered' },
  { id: 2, deliveryNumber: 'CFS-DLV-2026-00002', cfsLocation: 'Sharjah CFS', transportMode: 'ROAD', cargoType: 'LCL', containerNumber: '-', vehicleNumber: 'SHJ-11223', gateOutDate: '2026-06-15', packages: 10, grossWeight: 450, status: 'created' },
];

const STATUSES = ['', 'created', 'delivered', 'cancelled'];
const PAGE_SIZE = 20;

const CFSDeliveries = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ transportMode: '', cargoType: '', status: '', search: '' });
  const [selected, setSelected] = useState([]);
  const [page, setPage] = useState(1);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const actionMenuRef = useRef(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await cfsDeliveriesAPI.getAll({ ...filters, limit: 1000 });
      setRecords(res.data?.data || []);
    } catch {
      setRecords(mockDeliveries);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target)) setShowActionMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const setFilter = (key, val) => { setFilters((prev) => ({ ...prev, [key]: val })); setPage(1); };

  const displayRecords = useMemo(() => records.filter((j) => {
    if (filters.transportMode && j.transportMode !== filters.transportMode) return false;
    if (filters.cargoType && j.cargoType !== filters.cargoType) return false;
    if (filters.status && j.status !== filters.status) return false;
    if (filters.search) {
      const search = filters.search.toLowerCase();
      const num = String(j.deliveryNumber || '').toLowerCase();
      const cont = String(j.containerNumber || '').toLowerCase();
      const veh = String(j.vehicleNumber || '').toLowerCase();
      const cfs = String(j.cfsLocation || '').toLowerCase();
      if (!num.includes(search) && !cont.includes(search) && !veh.includes(search) && !cfs.includes(search)) return false;
    }
    return true;
  }), [records, filters]);

  const totalPages = Math.max(1, Math.ceil(displayRecords.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRecords = displayRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const rangeStart = displayRecords.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, displayRecords.length);

  const allPageSelected = pageRecords.length > 0 && pageRecords.every((r) => selected.includes(r.id));

  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelected((prev) => prev.filter((id) => !pageRecords.some((r) => r.id === id)));
    } else {
      setSelected((prev) => [...new Set([...prev, ...pageRecords.map((r) => r.id)])]);
    }
  };

  const toggleSelectOne = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectedRecords = displayRecords.filter((r) => selected.includes(r.id));

  const handleBulkDelete = async () => {
    const deletable = selectedRecords.filter((r) => r.status === 'created');
    if (deletable.length === 0) {
      toast.error('Only deliveries in Created status can be deleted');
      setShowActionMenu(false);
      return;
    }
    if (!window.confirm(`Delete ${deletable.length} delivery(s)?`)) return;
    try {
      await Promise.all(deletable.map((r) => cfsDeliveriesAPI.delete(r.id)));
      toast.success(`Deleted ${deletable.length} delivery(s)`);
      setSelected([]);
      fetchData();
    } catch {
      toast.error('Failed to delete some deliveries');
    } finally {
      setShowActionMenu(false);
    }
  };

  const exportRecords = selectedRecords.length > 0 ? selectedRecords : displayRecords;

  // Filters / Group By / Favorites, applied to the rows below.
  const listView = useListView(pageRecords, { key: 'cfs-deliveries', groupFields: [{ key: 'state', label: 'State' }, { key: 'cfs', label: 'CFS' }] });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">CFS Delivery Entry</h1>
        <button
          onClick={() => navigate('/admin/cfs-deliveries/create')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-wrap items-center gap-3">
        {selected.length > 0 ? (
          <span className="px-3 py-1.5 bg-blue-50 text-blue-700 text-sm font-semibold rounded-lg">
            {selected.length} selected
          </span>
        ) : null}

        {selected.length > 0 && (
          <button
            onClick={() => setSelected([])}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
        )}

        <div className="relative" ref={actionMenuRef}>
          <button
            onClick={() => setShowActionMenu((p) => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            Action
          </button>
          {showActionMenu && (
            <div className="absolute left-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-30">
              <button
                onClick={() => { setShowActionMenu(false); setShowExportModal(true); }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Export
              </button>
              <button
                onClick={handleBulkDelete}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {listView.controls}

        <div className="relative ml-auto">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search delivery no / container / vehicle / CFS..."
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
        </div>
        {[
          { key: 'transportMode', options: ['', ...TRANSPORT_MODES], label: 'Transport Mode' },
          { key: 'cargoType', options: ['', ...CARGO_TYPES], label: 'Cargo Type' },
          { key: 'status', options: STATUSES, label: 'Status' },
        ].map(({ key, options, label }) => (
          <select
            key={key}
            value={filters[key]}
            onChange={(e) => setFilter(key, e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">{label}</option>
            {options.filter(Boolean).map((o) => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
          </select>
        ))}

        {/* Pagination */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>{rangeStart}-{rangeEnd} / {displayRecords.length}</span>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? <PageLoader /> : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" checked={allPageSelected} onChange={toggleSelectAll} className="rounded border-gray-300" />
                  </th>
                  {['Delivery Entry Reference Number', 'State'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 text-xs whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pageRecords.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-10 text-gray-400">No CFS deliveries found</td></tr>
                ) : listView.rows.map((rec) => (
                  <tr
                    key={rec.id}
                    onClick={() => navigate(`/admin/cfs-deliveries/${rec.id}`)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.includes(rec.id)}
                        onChange={() => toggleSelectOne(rec.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-blue-700 text-xs">{rec.deliveryNumber}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getFFJobStatusColor(rec.status)}`}>
                        {rec.status?.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ExportDataModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        fields={CFS_DELIVERY_EXPORT_FIELDS}
        records={exportRecords}
        filename="cfs-delivery-entries"
      />
    </div>
  );
};

export default CFSDeliveries;
