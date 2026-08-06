import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Download } from 'lucide-react';
import { rmsTariffsAPI } from '../../../services/api';
import { PageLoader } from '../../../common/LoadingSpinner';
import { SERVICE_LABELS, TRADE_LABELS, CARGO_LABELS, fmtDate } from './constants';

// Columns mirror the live RMS > Tariff list view.
const COLUMNS = [
  'Tariff Number', 'Tariff Date', 'Service', 'Trade', 'Cargo Type',
  'Origin Country', 'Origin Port', 'Destination Country', 'Destination Port', 'Expiry Date',
];

const RMSTariffList = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await rmsTariffsAPI.getAll({ search, limit: 200 });
      setRows(res.data?.data || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">Tariff</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-80"
            />
          </div>
          <p className="text-xs text-gray-500">1-{rows.length}/{rows.length}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/admin/rms/tariffs/create')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg"
        >
          <Plus className="w-4 h-4" /> Create
        </button>
        <button className="p-2 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50" title="Export">
          <Download className="w-4 h-4" />
        </button>
      </div>

      {loading ? <PageLoader /> : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 w-10"><input type="checkbox" className="rounded border-gray-300" /></th>
                  {COLUMNS.map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 text-xs whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 ? (
                  <tr><td colSpan={COLUMNS.length + 1} className="text-center py-10 text-gray-400">No tariffs found</td></tr>
                ) : rows.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/admin/rms/tariffs/${t.id}`)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="rounded border-gray-300" />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{t.tariffNumber}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{fmtDate(t.tariffDate)}</td>
                    <td className="px-4 py-3 text-gray-700 text-xs whitespace-nowrap">{SERVICE_LABELS[t.service] || t.service}</td>
                    <td className="px-4 py-3 text-gray-700 text-xs whitespace-nowrap">{TRADE_LABELS[t.trade] || t.trade}</td>
                    <td className="px-4 py-3 text-gray-700 text-xs whitespace-nowrap">{CARGO_LABELS[t.cargoType] || t.cargoType}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{t.originCountry || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs max-w-[16rem] truncate" title={t.originPort}>{t.originPort || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{t.destinationCountry || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs max-w-[16rem] truncate" title={t.destinationPort}>{t.destinationPort || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{fmtDate(t.expiryDate)}</td>
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

export default RMSTariffList;
