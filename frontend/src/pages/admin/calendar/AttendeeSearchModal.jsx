import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { calendarAPI } from '../../../services/api';
import { useListView } from '../administration/useListView';
import { exportCsv } from '../../../utils/exportCsv';
import toast from 'react-hot-toast';

const COLUMNS = ['Name', 'Phone', 'Email', 'Salesperson', 'Next Activity', 'City', 'Country', 'Company'];
const PAGE_SIZE = 80;

// "Search: Attendees" — the partner picker the + Add Attendees box opens.
const AttendeeSearchModal = ({ onClose, onPick }) => {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await calendarAPI.searchAttendees({ search: search || undefined, page, limit: PAGE_SIZE });
      setRows(res.data?.data || []);
      setMeta(res.data?.pagination || { total: 0 });
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { load(); }, [load]);

  const total = meta.total || 0;
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  // The picker's own Filters / Group By / Favorites, applied to the rows below.
  const listView = useListView(rows, {
    key: 'attendees',
    groupFields: [{ key: 'country', label: 'Country' }, { key: 'city', label: 'City' }],
  });

  const handleExport = () => {
    if (exportCsv(listView.rows, null, 'attendees')) toast.success(`Exported ${listView.rows.length} rows`);
    else toast.error('Nothing to export');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl w-full max-w-5xl my-8">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h3 className="text-lg font-bold text-blue-700">Search: Attendees</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-3 flex-wrap">
          <div className="relative flex-1 min-w-[16rem] max-w-md">
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search..."
              className="w-full pl-3 pr-9 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Search className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            {listView.controls}
            <button onClick={handleExport} title="Export this list"
              className="hover:text-gray-900"><SlidersHorizontal className="w-3.5 h-3.5" /></button>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <span>{from}-{to} / {total}</span>
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="p-1 disabled:opacity-30 hover:text-gray-900"
            ><ChevronLeft className="w-4 h-4" /></button>
            <button
              disabled={to >= total}
              onClick={() => setPage((p) => p + 1)}
              className="p-1 disabled:opacity-30 hover:text-gray-900"
            ><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto border-y border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-white border-b border-gray-200 sticky top-0">
              <tr>
                {COLUMNS.map((h) => (
                  <th key={h} className="text-left px-3 py-2 font-semibold text-gray-700 text-xs whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={COLUMNS.length} className="text-center py-10 text-gray-400 text-xs">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={COLUMNS.length} className="text-center py-10 text-gray-400 text-xs">No records found</td></tr>
              ) : listView.rows.map((r) => (
                <tr key={r.id} onClick={() => onPick(r)} className="hover:bg-blue-50 cursor-pointer">
                  <td className="px-3 py-1.5 text-gray-800 whitespace-nowrap max-w-[14rem] truncate" title={r.name}>{r.name}</td>
                  <td className="px-3 py-1.5 text-gray-600 text-xs whitespace-nowrap">{r.phone}</td>
                  <td className="px-3 py-1.5 text-gray-600 text-xs max-w-[12rem] truncate" title={r.email}>{r.email}</td>
                  <td className="px-3 py-1.5 text-gray-600 text-xs">{r.salesperson}</td>
                  <td className="px-3 py-1.5 text-gray-400 text-xs">○</td>
                  <td className="px-3 py-1.5 text-gray-600 text-xs">{r.city}</td>
                  <td className="px-3 py-1.5 text-gray-600 text-xs max-w-[10rem] truncate" title={r.country}>{r.country}</td>
                  <td className="px-3 py-1.5 text-gray-600 text-xs max-w-[12rem] truncate" title={r.company}>{r.company}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3">
          <button onClick={onClose} className="px-4 py-1.5 border border-gray-300 text-sm text-gray-700 rounded hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default AttendeeSearchModal;
