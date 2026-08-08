import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Download, Filter, Layers, Star, SlidersHorizontal,
  ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevRight,
} from 'lucide-react';
import { freightBookingsAPI } from '../../../services/api';
import { PageLoader } from '../../../common/LoadingSpinner';
import { AIR_STATUS, SEA_STATUS, statusLabel, rowTone, fmtDateTime } from './constants';

const COLUMNS = ['Booking Reference', 'Transport Mode', 'carrier', 'Origin Port', 'Destination Port', 'ETD', 'ETA', 'Status'];
const PAGE_SIZE = 80;

const GROUP_BY = [
  { key: '', label: 'None' },
  { key: 'status', label: 'Status' },
  { key: 'carrier', label: 'carrier' },
  { key: 'transportCode', label: 'Transport Mode' },
  { key: 'company', label: 'Company' },
];

const FreightBookingList = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [facets, setFacets] = useState({ carriers: [], companies: [], airStatuses: [], seaStatuses: [] });
  const [filters, setFilters] = useState([]);
  const [groupBy, setGroupBy] = useState('');
  const [openMenu, setOpenMenu] = useState(null);
  const [collapsed, setCollapsed] = useState({});
  const menuRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: PAGE_SIZE, search: search || undefined };
      // Filters are "field=value" pairs; same-field picks OR together.
      const byField = {};
      filters.forEach((f) => {
        const [k, v] = f.split('=');
        byField[k] = byField[k] ? `${byField[k]},${v}` : v;
      });
      Object.assign(params, byField);
      const res = await freightBookingsAPI.getAll(params);
      setRows(res.data?.data || []);
      setTotal(res.data?.pagination?.total || 0);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, filters]);

  useEffect(() => {
    freightBookingsAPI.getFacets()
      .then((r) => setFacets(r.data?.data || facets))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const away = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const groups = useMemo(() => {
    if (!groupBy) return null;
    const map = new Map();
    rows.forEach((r) => {
      const label = groupBy === 'status' ? (statusLabel(r) || 'Undefined')
        : groupBy === 'transportCode' ? (r.transportMode || r.transportCode || 'Undefined')
          : (r[groupBy] || 'Undefined');
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(r);
    });
    return [...map.entries()].sort(([a], [b]) =>
      (a === 'Undefined' ? -1 : b === 'Undefined' ? 1 : a.localeCompare(b)));
  }, [rows, groupBy]);

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  const toggleFilter = (key) =>
    setFilters((p) => (p.includes(key) ? p.filter((x) => x !== key) : [...p, key]));

  const Row = (b) => (
    <tr
      key={b.id}
      onClick={() => navigate(`/admin/freight-bookings/${b.id}`)}
      className="hover:bg-gray-50 cursor-pointer"
    >
      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" className="rounded border-gray-300" />
      </td>
      <td className="px-3 py-2 text-blue-700 whitespace-nowrap">{b.bookingReference}</td>
      <td className="px-3 py-2 text-blue-700 text-xs whitespace-nowrap">{b.transportMode || ''}</td>
      <td className="px-3 py-2 text-gray-700 text-xs whitespace-nowrap">{b.carrier || ''}</td>
      <td className="px-3 py-2 text-blue-700 text-xs max-w-[16rem] truncate" title={b.originPort}>{b.originPort || ''}</td>
      <td className="px-3 py-2 text-blue-700 text-xs max-w-[16rem] truncate" title={b.destinationPort}>{b.destinationPort || ''}</td>
      <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{fmtDateTime(b.etdTime)}</td>
      <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{fmtDateTime(b.etaTime)}</td>
      <td className={`px-3 py-2 text-xs whitespace-nowrap ${rowTone(b)}`}>{statusLabel(b)}</td>
    </tr>
  );

  return (
    <div className="px-6 pb-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h2 className="text-lg font-semibold text-gray-900">Bookings</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-80 pl-3 pr-9 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Search className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap mb-3 relative overflow-visible" ref={menuRef}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/admin/freight-bookings/create')}
            className="flex items-center gap-2 px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded"
          >
            <Plus className="w-4 h-4" /> Create
          </button>
          <button className="p-2 border border-gray-300 rounded text-gray-500 hover:bg-gray-50" title="Export">
            <Download className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3 text-sm text-gray-600">
          <div className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === 'filter' ? null : 'filter')}
              className="flex items-center gap-1 hover:text-gray-900"
            >
              <Filter className="w-3.5 h-3.5" /> Filters
              {filters.length > 0 && <span className="text-xs text-blue-700">({filters.length})</span>}
            </button>
            {openMenu === 'filter' && (
              <div className="absolute right-0 top-full mt-1 z-30 w-64 max-h-80 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">Transport</p>
                {['AIR', 'SEA'].map((m) => (
                  <label key={m} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300"
                      checked={filters.includes(`transportCode=${m}`)}
                      onChange={() => toggleFilter(`transportCode=${m}`)} />
                    {m === 'AIR' ? 'Air Freight' : 'Sea Freight'}
                  </label>
                ))}
                <p className="px-3 py-1 mt-1 text-[10px] font-bold uppercase tracking-wide text-gray-400 border-t border-gray-100">Air Status</p>
                {Object.entries(AIR_STATUS).map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300"
                      checked={filters.includes(`airStatus=${k}`)}
                      onChange={() => toggleFilter(`airStatus=${k}`)} />
                    {label}
                  </label>
                ))}
                <p className="px-3 py-1 mt-1 text-[10px] font-bold uppercase tracking-wide text-gray-400 border-t border-gray-100">Sea Status</p>
                {Object.entries(SEA_STATUS).map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300"
                      checked={filters.includes(`status=${k}`)}
                      onChange={() => toggleFilter(`status=${k}`)} />
                    {label}
                  </label>
                ))}
                {filters.length > 0 && (
                  <button onClick={() => setFilters([])}
                    className="w-full text-left px-3 py-2 text-xs text-blue-700 hover:bg-gray-50 border-t border-gray-100">
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === 'group' ? null : 'group')}
              className="flex items-center gap-1 hover:text-gray-900"
            >
              <Layers className="w-3.5 h-3.5" /> Group By
              {groupBy && <span className="text-xs text-blue-700">({GROUP_BY.find((g) => g.key === groupBy)?.label})</span>}
            </button>
            {openMenu === 'group' && (
              <div className="absolute right-0 top-full mt-1 z-30 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                {GROUP_BY.map((g) => (
                  <button key={g.key || 'none'}
                    onClick={() => { setGroupBy(g.key); setOpenMenu(null); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${groupBy === g.key ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>
                    {g.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button className="flex items-center gap-1 hover:text-gray-900"><Star className="w-3.5 h-3.5" /> Favorites</button>
          <button className="hover:text-gray-900"><SlidersHorizontal className="w-3.5 h-3.5" /></button>

          <div className="flex items-center gap-1 text-xs">
            <span>{from}-{to} / {total}</span>
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
              className="p-1 disabled:opacity-30 hover:text-gray-900"><ChevronLeft className="w-4 h-4" /></button>
            <button disabled={to >= total} onClick={() => setPage((p) => p + 1)}
              className="p-1 disabled:opacity-30 hover:text-gray-900"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {loading ? <PageLoader /> : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 w-10"><input type="checkbox" className="rounded border-gray-300" /></th>
                  {COLUMNS.map((h) => (
                    <th key={h} className="text-left px-3 py-2 font-semibold text-gray-700 text-xs whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 ? (
                  <tr><td colSpan={COLUMNS.length + 1} className="text-center py-10 text-gray-400">No bookings found</td></tr>
                ) : groups ? groups.map(([label, groupRows]) => (
                  <React.Fragment key={label}>
                    <tr className="bg-gray-100 cursor-pointer"
                      onClick={() => setCollapsed((c) => ({ ...c, [label]: !c[label] }))}>
                      <td colSpan={COLUMNS.length + 1} className="px-3 py-2 font-semibold text-gray-700 text-xs">
                        <span className="inline-flex items-center gap-1">
                          {collapsed[label] ? <ChevRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          {label} ({groupRows.length})
                        </span>
                      </td>
                    </tr>
                    {!collapsed[label] && groupRows.map(Row)}
                  </React.Fragment>
                )) : rows.map(Row)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default FreightBookingList;
