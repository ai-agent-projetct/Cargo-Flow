import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { exportCsv } from '../../../utils/exportCsv';
import { useListView } from './useListView';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, FileText, ChevronLeft, SlidersHorizontal } from 'lucide-react';
import { cfsTariffsAPI } from '../../../services/api';
import SearchBar from '../../../common/SearchBar';
import LoadingSpinner from '../../../common/LoadingSpinner';
import { operationLabel } from './cfsTariffData';

// "Administration > CFS Tariff > Charges Tariff" list, mirroring CargoFlo
// ERP's "CFS Tariff Charges" screen (Tariff Name, Shipping Line, Operation,
// Valid From, Valid to).
const CFSTariffList = () => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await cfsTariffsAPI.getAll({ limit: 1000 });
      setData(response.data.data || []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = data.filter((item) => {
    if (!search) return true;
    return (item.tariffName || '').toLowerCase().includes(search.toLowerCase());
  });

  const formatDate = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  };

  // Filters / Group By / Favorites, applied to the rows below.
  const listView = useListView(filtered, { key: 'cfs-tariffs', groupFields: [] });

  // Export the tariffs currently listed.
  const handleExport = () => {
    if (exportCsv(listView.rows, null, 'cfs-tariffs')) toast.success(`Exported ${listView.rows.length} rows`);
    else toast.error('Nothing to export');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">CFS Tariff Charges</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('create')}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Create
            </button>
            <button onClick={handleExport} title="Export to CSV"
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 border border-slate-200">
              <Download className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <SearchBar value={search} onChange={setSearch} placeholder="Search..." className="w-56" />
            {listView.controls}
            <span className="text-xs text-slate-500 whitespace-nowrap">1-{filtered.length}/{filtered.length}</span>
            <button disabled title="All tariffs fit on one page"
              className="p-1.5 text-slate-300 cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={handleExport} title="Download this list"
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 border border-slate-200"><SlidersHorizontal className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        {loading ? (
          <div className="py-16"><LoadingSpinner /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FileText className="w-10 h-10 mb-2" />
            <p className="text-sm">No CFS tariff records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 w-8">
                    <input type="checkbox" className="rounded border-slate-300" disabled />
                  </th>
                  <th className="text-left px-4 py-3">Tariff Name</th>
                  <th className="text-left px-4 py-3">Shipping Line</th>
                  <th className="text-left px-4 py-3">Operation</th>
                  <th className="text-left px-4 py-3">Valid From</th>
                  <th className="text-left px-4 py-3">Valid to</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {listView.rows.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => navigate(`${item.id}`)}
                  >
                    <td className="px-4 py-3">
                      <input type="checkbox" className="rounded border-slate-300" onClick={(e) => e.stopPropagation()} />
                    </td>
                    <td className="px-4 py-3 font-medium text-primary-600">{item.tariffName || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{item.shippingLine?.name || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{operationLabel(item.operation)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(item.validFrom)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(item.validTo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CFSTariffList;
