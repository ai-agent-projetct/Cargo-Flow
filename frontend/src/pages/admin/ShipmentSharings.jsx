import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Download } from 'lucide-react';
import { shipmentSharingsAPI } from '../../services/api';
import { PageLoader } from '../../common/LoadingSpinner';

const mockSharings = [
  { id: 1, sharingNumber: 'SHR-2026-00001', direction: 'import_to_export', company: 'SearatesERP(India)', shipmentType: 'EXP', transportMode: 'SEA', cargoType: 'LCL', bookingId: 'SEA-E-LCL-H-N-2026-00404', shipmentDate: '2024-11-09', shipper: 'A-23: Adam', consignee: 'A-14: Aafaq', originPort: 'HALDIA - [India - INH]', destinationPort: 'AJMAN - [United Arab Emirates]', status: 'created', converted: false },
  { id: 2, sharingNumber: 'SHR-2026-00002', direction: 'import_to_export', company: 'SearatesERP(India)', shipmentType: 'EXP', transportMode: 'AIR', cargoType: 'LSE', bookingId: 'AIR-E-LSE-H-N-2026-00405', shipmentDate: '2024-11-09', shipper: 'A-23: Adam', consignee: 'A-14: Aafaq', originPort: 'JAIPUR AIRPORT - [India]', destinationPort: 'Al Fujayrah - [United Arab Emirates]', status: 'nomination_generated', converted: true },
  { id: 3, sharingNumber: 'SHR-2026-00003', direction: 'export_to_import', company: 'SearatesERP(Dubai)', shipmentType: 'IMP', transportMode: 'SEA', cargoType: 'FCL', bookingId: 'SEA-I-FCL-H-N-2026-00301', shipmentDate: '2024-12-03', shipper: 'A-17: Atharva', consignee: 'A-23: Adam', originPort: 'Singapore - [SG]', destinationPort: 'Jebel Ali - [United Arab Emirates]', status: 'booked', converted: false },
  { id: 4, sharingNumber: 'SHR-2026-00004', direction: 'export_to_import', company: 'SearatesERP(Dubai)', shipmentType: 'IMP', transportMode: 'AIR', cargoType: 'LSE', bookingId: 'AIR-I-LSE-H-N-2026-00302', shipmentDate: '2024-12-06', shipper: 'A-17: Atharva', consignee: 'A-23: Adam', originPort: 'Shanghai - [CN]', destinationPort: 'Dubai - [United Arab Emirates]', status: 'nomination_generated', converted: true },
];

const TRANSPORT_MODE_LABELS = { SEA: '[SEA] Sea Freight', AIR: '[AIR] Air Freight', ROAD: '[ROAD] Road Freight', RAIL: '[RAIL] Rail Freight' };
const SHIPMENT_TYPE_LABELS = { EXP: '[EXP] Export', IMP: '[IMP] Import' };
const CARGO_TYPE_LABELS = { LCL: '[LCL] Less Container Load', FCL: '[FCL] Full Container Load', LSE: '[LSE] Loose', FTL: '[FTL] Full Truck Load', LTL: '[LTL] Less Truck Load', BULK: '[BULK] Bulk', RORO: '[RORO] Roll On Roll Off', BREAKBULK: '[BREAKBULK] Break Bulk' };

const formatDate = (d) => {
  if (!d) return '-';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
};

const DIRECTION_LABELS = {
  import_to_export: 'Import To Export',
  export_to_import: 'Export To Import',
};

const ShipmentSharings = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Which of the four Shipment Sharing views to show is driven entirely by the
  // URL, so the Operations > Shipment Sharing dropdown links deep-link straight
  // into a view (same as the live demo's four separate menu actions).
  const direction = searchParams.get('direction') === 'export_to_import' ? 'export_to_import' : 'import_to_export';
  const converted = searchParams.get('converted') === 'true';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await shipmentSharingsAPI.getAll({ direction, converted, search });
      setRecords(res.data?.data || []);
    } catch {
      setRecords(mockSharings.filter((r) => r.direction === direction && r.converted === converted));
    } finally {
      setLoading(false);
    }
  }, [direction, converted, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">
          Shipment Sharing <span className="text-gray-400 font-normal">/ {DIRECTION_LABELS[direction]}</span>
        </h1>
        {/* Converted views are read-only on the live demo (create/edit/delete off). */}
        {!converted && (
          <button
            onClick={() => navigate('/admin/shipment-sharings/create')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create New
          </button>
        )}
      </div>

      {/* Title + Search toolbar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-gray-800">
            {converted ? 'Converted Shipment' : 'Pending Shipment'}
          </h2>
          <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Download">
            <Download className="w-4 h-4" />
          </button>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-72"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? <PageLoader /> : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Company', 'Transport Mode', 'Shipment Type', 'Cargo Type', 'Booking ID', 'Shipment Date', 'Shipper', 'Consignee', 'Origin Port', 'Destination Port'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 text-xs whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-10 text-gray-400">No shipment sharings found</td></tr>
                ) : records.map((rec) => (
                  <tr
                    key={rec.id}
                    onClick={() => navigate(`/admin/shipment-sharings/${rec.id}`)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{rec.company || '-'}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{TRANSPORT_MODE_LABELS[rec.transportMode] || rec.transportMode}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{SHIPMENT_TYPE_LABELS[rec.shipmentType] || rec.shipmentType}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{CARGO_TYPE_LABELS[rec.cargoType] || rec.cargoType}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">{rec.bookingId || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{formatDate(rec.shipmentDate)}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{rec.shipper || '-'}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{rec.consignee || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{rec.originPort || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{rec.destinationPort || '-'}</td>
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

export default ShipmentSharings;
