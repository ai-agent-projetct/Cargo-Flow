import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Search, LayoutGrid, List, ExternalLink, Home } from 'lucide-react';
import { consolidationsAPI } from '../../services/api';
import { getFFJobStatusColor } from '../../utils/helpers';
import { PageLoader } from '../../common/LoadingSpinner';
import { TRANSPORT_MODES, CARGO_TYPES } from './houseShipment/constants';

const mockConsolidations = [
  { id: 1, consolidationNumber: 'CONS-SEA-E-2026-00001', transportMode: 'SEA', direction: 'EXPORT', cargoType: 'FCL', origin: 'Jebel Ali, AE', destination: 'Singapore, SG', vesselName: 'MSC AURORA', voyageNumber: 'V123', mblNumber: 'MBL-00789', etd: '2026-06-20', eta: '2026-06-28', houseShipmentIds: ['hs1', 'hs2'], status: 'confirmed' },
  { id: 2, consolidationNumber: 'CONS-AIR-I-2026-00002', transportMode: 'AIR', direction: 'IMPORT', cargoType: 'LSE', origin: 'Shanghai, CN', destination: 'Dubai, AE', vesselName: '-', voyageNumber: '-', mblNumber: 'MAWB-00456', etd: '2026-06-15', eta: '2026-06-16', houseShipmentIds: ['hs3'], status: 'draft' },
];

const DIRECTIONS = ['', 'EXPORT', 'IMPORT', 'LOCAL'];
const STATUSES = ['', 'draft', 'confirmed', 'in_transit', 'arrived', 'completed', 'cancelled'];

// The live demo opens Export Console Generation on a kanban grouped into these
// three stages (Cancelled sits collapsed between Created and Completed).
const KANBAN_COLUMNS = [
  { key: 'draft', label: 'Created' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'completed', label: 'Completed' },
];

const Consolidations = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('kanban');
  const [filters, setFilters] = useState({ transportMode: '', direction: '', cargoType: '', status: '', search: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // The kanban shows every stage at once, so pull the full set rather than
      // the default first page.
      const res = await consolidationsAPI.getAll({ ...filters, limit: 200 });
      setRecords(res.data?.data || []);
    } catch {
      setRecords(mockConsolidations);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setFilter = (key, val) => setFilters((prev) => ({ ...prev, [key]: val }));

  const displayRecords = records.filter((j) => {
    if (filters.transportMode && j.transportMode !== filters.transportMode) return false;
    if (filters.direction && j.direction !== filters.direction) return false;
    if (filters.cargoType && j.cargoType !== filters.cargoType) return false;
    if (filters.status && j.status !== filters.status) return false;
    if (filters.search) {
      const search = filters.search.toLowerCase();
      const num = String(j.consolidationNumber || '').toLowerCase();
      const mbl = String(j.mblNumber || '').toLowerCase();
      const vessel = String(j.vesselName || '').toLowerCase();
      if (!num.includes(search) && !mbl.includes(search) && !vessel.includes(search)) return false;
    }
    return true;
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Export Console Generation</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
            {[{ key: 'kanban', Icon: LayoutGrid }, { key: 'list', Icon: List }].map(({ key, Icon }) => (
              <button
                key={key}
                onClick={() => setViewMode(key)}
                title={key === 'kanban' ? 'Kanban view' : 'List view'}
                className={`p-2 transition-colors ${
                  viewMode === key ? 'bg-blue-700 text-white' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
          <button
            onClick={() => navigate('/admin/consolidations/create')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create New
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search consolidation no / MBL / vessel..."
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
        </div>
        {[
          { key: 'transportMode', options: ['', ...TRANSPORT_MODES], label: 'Transport Mode' },
          { key: 'direction', options: DIRECTIONS, label: 'Direction' },
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
      </div>

      {/* Kanban */}
      {!loading && viewMode === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {KANBAN_COLUMNS.map((col) => {
            const cards = displayRecords.filter((r) => r.status === col.key);
            return (
              <div key={col.key} className="flex-1 min-w-[300px]">
                <h3 className="text-sm font-bold text-blue-700 mb-3 px-1">
                  {col.label} <span className="text-gray-400 font-normal">({cards.length})</span>
                </h3>
                <div className="space-y-3">
                  {cards.length === 0 ? (
                    <p className="text-xs text-gray-400 px-1 py-4">No records</p>
                  ) : cards.map((rec) => (
                    <button
                      key={rec.id}
                      onClick={() => navigate(`/admin/consolidations/${rec.id}`)}
                      className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-blue-700 text-sm break-all">{rec.consolidationNumber}</span>
                        <span className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
                          <Home className="w-3.5 h-3.5" />
                          {(rec.houseShipmentIds || []).length}
                          <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                        </span>
                      </div>
                      {rec.mblNumber && (
                        <p className="text-xs text-gray-600 mt-1"><span className="font-semibold">MBL:</span> {rec.mblNumber}</p>
                      )}
                      <table className="w-full mt-3 text-xs">
                        <thead>
                          <tr className="bg-emerald-50 text-gray-700">
                            <th className="text-left px-2 py-1 font-semibold">Estimated Revenue</th>
                            <th className="text-left px-2 py-1 font-semibold">Estimated Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-emerald-50/50 text-gray-600">
                            <td className="px-2 py-1">{Number(rec.estimatedRevenue || 0).toFixed(2)} AED</td>
                            <td className="px-2 py-1">{Number(rec.estimatedCost || 0).toFixed(2)} AED</td>
                          </tr>
                        </tbody>
                      </table>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table */}
      {loading ? <PageLoader /> : viewMode === 'list' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Consolidation No', 'MBL Number', 'Direction', 'Origin', 'Destination', 'Vessel/Voyage', 'ETD', 'ETA', 'House Shipments', 'Type', 'Mode', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 text-xs whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayRecords.length === 0 ? (
                  <tr><td colSpan={13} className="text-center py-10 text-gray-400">No consolidations found</td></tr>
                ) : displayRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-blue-700 text-xs">{rec.consolidationNumber}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{rec.mblNumber || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{rec.direction || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{rec.origin || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{rec.destination || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{rec.vesselName || '-'} / {rec.voyageNumber || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{rec.etd ? new Date(rec.etd).toLocaleDateString('en-GB') : '—'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{rec.eta ? new Date(rec.eta).toLocaleDateString('en-GB') : '—'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{(rec.houseShipmentIds || []).length}</td>
                    <td className="px-4 py-3 text-xs">{rec.cargoType}</td>
                    <td className="px-4 py-3">
                      <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded">{rec.transportMode}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getFFJobStatusColor(rec.status)}`}>
                        {rec.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/admin/consolidations/${rec.id}`)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Consolidations;
