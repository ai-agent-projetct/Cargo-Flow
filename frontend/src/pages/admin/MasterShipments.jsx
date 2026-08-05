import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Search } from 'lucide-react';
import { masterShipmentsAPI } from '../../services/api';
import { getFFJobStatusColor } from '../../utils/helpers';
import { PageLoader } from '../../common/LoadingSpinner';

const mockMasters = [
  { id: 1, masterShipmentNumber: 'MSC-SEA-E-2026-00001', customer: { companyName: 'Acme Logistics' }, origin: 'Jebel Ali, AE', destination: 'Singapore, SG', etd: '2026-06-20', eta: '2026-06-28', cargoType: 'FCL', transportMode: 'SEA', direction: 'EXPORT', status: 'confirmed', mblNumber: 'MBL-00123' },
  { id: 2, masterShipmentNumber: 'MSC-AIR-I-2026-00002', customer: { companyName: 'KL Imports Sdn Bhd' }, origin: 'Shanghai, CN', destination: 'Dubai, AE', etd: '2026-06-15', eta: '2026-06-16', cargoType: 'LSE', transportMode: 'AIR', direction: 'IMPORT', status: 'in_transit', mblNumber: 'MAWB-00456' },
];

const TRANSPORT_MODES = ['', 'SEA', 'AIR', 'ROAD', 'RAIL'];
const DIRECTIONS = ['', 'EXPORT', 'IMPORT', 'LOCAL'];
const CARGO_TYPES = ['', 'FCL', 'LCL', 'LSE', 'FTL', 'LTL', 'BULK', 'RORO', 'BREAKBULK'];
const STATUSES = ['', 'draft', 'confirmed', 'in_transit', 'arrived', 'delivered', 'cancelled'];

const MasterShipments = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ transportMode: '', direction: '', cargoType: '', status: '', search: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await masterShipmentsAPI.getAll(filters);
      setRecords(res.data?.data || []);
    } catch {
      setRecords(mockMasters);
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
      const num = String(j.masterShipmentNumber || '').toLowerCase();
      const customerName = String(j.customer?.companyName || '').toLowerCase();
      const mbl = String(j.mblNumber || '').toLowerCase();
      if (!num.includes(search) && !customerName.includes(search) && !mbl.includes(search)) return false;
    }
    return true;
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Master Shipment (Console)</h1>
        <button
          onClick={() => navigate('/admin/master-shipments/create')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create New
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search master no / customer / MBL..."
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
        </div>
        {[
          { key: 'transportMode', options: TRANSPORT_MODES, label: 'Transport Mode' },
          { key: 'direction', options: DIRECTIONS, label: 'Direction' },
          { key: 'cargoType', options: CARGO_TYPES, label: 'Cargo Type' },
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

      {/* Table */}
      {loading ? <PageLoader /> : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Master No', 'Customer', 'MBL Number', 'Direction', 'Origin', 'Destination', 'ETD', 'ETA', 'Type', 'Mode', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 text-xs whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayRecords.length === 0 ? (
                  <tr><td colSpan={12} className="text-center py-10 text-gray-400">No master shipments found</td></tr>
                ) : displayRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-blue-700 text-xs">{rec.masterShipmentNumber}</td>
                    <td className="px-4 py-3 text-gray-700">{rec.customer?.companyName || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{rec.mblNumber || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{rec.direction || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{rec.origin || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{rec.destination || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{rec.etd ? new Date(rec.etd).toLocaleDateString('en-GB') : '—'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{rec.eta ? new Date(rec.eta).toLocaleDateString('en-GB') : '—'}</td>
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
                        onClick={() => navigate(`/admin/master-shipments/${rec.id}`)}
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

export default MasterShipments;
