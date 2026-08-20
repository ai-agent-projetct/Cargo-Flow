import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Download, Filter, Layers, Star, SlidersHorizontal,
  ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevRight,
} from 'lucide-react';
import { tmsAPI } from '../../../services/api';
import { usePermissions } from '../../../context/PermissionContext';
import { PageLoader } from '../../../common/LoadingSpinner';
import { useListToolbar } from '../accounting/useListToolbar';

const COLUMNS = [
  'Shipment ID', 'Declariction/Emanifest', 'Request Date', 'Resubmit Url',
  'Request Complete Date', 'Requested By', 'Provider Status', 'Status',
];
const PAGE_SIZE = 80;

const STATUS = { init: 'Initialized', success: 'Success', fail: 'Failed', invalid: 'Invalid' };
// decoration-danger / success / muted / info on the demo's tree.
const TONE = {
  fail: 'text-red-600', success: 'text-green-700',
  invalid: 'text-gray-400', init: 'text-blue-700',
};

const pad = (n) => String(n).padStart(2, '0');
const fmt = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const TMSRequestList = () => {
  const navigate = useNavigate();
  const { guard } = usePermissions();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Export / Favorites / column toggle, shared with the accounting lists.
  const toolbar = useListToolbar({
    key: 'tms-requests',
    rows,
    columns: COLUMNS,
    exportSpec: [{ key: 'name', label: 'Name' }, { key: 'requestDate', label: 'Request Date' }, { key: 'requestedBy', label: 'Requested By' }, { key: 'providerStatus', label: 'Provider Status' }, { key: 'status', label: 'Status' }, { key: 'reference', label: 'Reference' }],
  });
  const [search, setSearch] = useState('');
  const [facets, setFacets] = useState({ requesters: [], statuses: [] });
  const [filters, setFilters] = useState([]);
  const [groupBy, setGroupBy] = useState('');
  const [openMenu, setOpenMenu] = useState(null);
  const [collapsed, setCollapsed] = useState({});
  const menuRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await guard(() => tmsAPI.getAll({
      page, limit: PAGE_SIZE, search: search || undefined,
      ...Object.fromEntries(filters.map((f) => f.split('='))),
    }));
    if (res) { setRows(res.data.data || []); setTotal(res.data.pagination?.total || 0); }
    else { setRows([]); setTotal(0); }
    setLoading(false);
  }, [page, search, filters, guard]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, filters]);

  useEffect(() => {
    tmsAPI.getFacets().then((r) => setFacets(r.data.data)).catch(() => {});
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
      const label = groupBy === 'status' ? (STATUS[r.status] || r.status) : (r[groupBy] || 'Undefined');
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(r);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows, groupBy]);

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  const shown = COLUMNS.filter((c) => !toolbar.hidden.includes(c));

  // Cells keyed by column label so hiding a column drops its cells with it.
  const Row = (r) => {
    const cells = {
      'Shipment ID': <span className={TONE[r.status] || ''}>{r.name}</span>,
      'Declariction/Emanifest': <span className="text-gray-700 text-xs">{r.providerMessageType || ''}</span>,
      'Request Date': <span className="text-gray-700 text-xs">{fmt(r.requestDate)}</span>,
      'Resubmit Url': r.resubmitUrl
        ? <a href={r.resubmitUrl} className="text-blue-700 hover:underline text-xs" onClick={(e) => e.stopPropagation()}>{r.resubmitUrl}</a>
        : '',
      'Request Complete Date': <span className="text-gray-700 text-xs">{fmt(r.requestCompleteDate)}</span>,
      'Requested By': <span className="text-gray-700 text-xs">{r.requestedBy || ''}</span>,
      'Provider Status': <span className={`text-xs font-medium ${TONE[r.status] || ''}`}>{r.providerStatus || ''}</span>,
      Status: <span className={`text-xs ${TONE[r.status] || ''}`}>{STATUS[r.status] || r.status}</span>,
    };
    return (
      <tr key={r.id} onClick={() => navigate(`/admin/tms/${r.id}`)} className="hover:bg-gray-50 cursor-pointer">
        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" className="rounded border-gray-300" />
        </td>
        {shown.map((c) => (
          <td key={c} className="px-3 py-2 whitespace-nowrap max-w-[18rem] truncate">{cells[c] ?? ''}</td>
        ))}
      </tr>
    );
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-3">
        <h1 className="text-2xl font-bold text-gray-900">TMS</h1>
        <span className="px-3 py-1 bg-gray-200 text-gray-900 text-sm font-medium rounded">TMS Requests</span>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h2 className="text-base font-semibold text-gray-900">TMS Request</h2>
        <div className="relative">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..."
            className="w-[28rem] pl-3 pr-9 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <Search className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap mb-3 relative overflow-visible" ref={menuRef}>
        {/* No Create button: the model is system-written (create="false" in the demo). */}
        <button onClick={toolbar.onExport} className="p-2 border border-gray-300 rounded text-gray-500 hover:bg-gray-50" title="Export">
          <Download className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 text-sm text-gray-600">
          <div className="relative">
            <button onClick={() => setOpenMenu(openMenu === 'filter' ? null : 'filter')} className="flex items-center gap-1 hover:text-gray-900">
              <Filter className="w-3.5 h-3.5" /> Filters
              {filters.length > 0 && <span className="text-xs text-blue-700">({filters.length})</span>}
            </button>
            {openMenu === 'filter' && (
              <div className="absolute right-0 top-full mt-1 z-30 w-60 max-h-80 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">Status</p>
                {(facets.statuses || []).map((s) => (
                  <label key={s.key} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300"
                      checked={filters.includes(`status=${s.key}`)}
                      onChange={() => setFilters((p) => p.includes(`status=${s.key}`) ? p.filter((x) => x !== `status=${s.key}`) : [...p, `status=${s.key}`])} />
                    {s.label}
                  </label>
                ))}
                <p className="px-3 py-1 mt-1 text-[10px] font-bold uppercase tracking-wide text-gray-400 border-t border-gray-100">Requested By</p>
                {(facets.requesters || []).map((r) => (
                  <label key={r} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300"
                      checked={filters.includes(`requestedBy=${r}`)}
                      onChange={() => setFilters((p) => p.includes(`requestedBy=${r}`) ? p.filter((x) => x !== `requestedBy=${r}`) : [...p, `requestedBy=${r}`])} />
                    {r}
                  </label>
                ))}
                {filters.length > 0 && (
                  <button onClick={() => setFilters([])} className="w-full text-left px-3 py-2 text-xs text-blue-700 hover:bg-gray-50 border-t border-gray-100">
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="relative">
            <button onClick={() => setOpenMenu(openMenu === 'group' ? null : 'group')} className="flex items-center gap-1 hover:text-gray-900">
              <Layers className="w-3.5 h-3.5" /> Group By
            </button>
            {openMenu === 'group' && (
              <div className="absolute right-0 top-full mt-1 z-30 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                {[{ key: '', label: 'None' }, { key: 'status', label: 'Status' }, { key: 'requestedBy', label: 'Requested By' }, { key: 'name', label: 'Shipment ID' }].map((g) => (
                  <button key={g.key || 'none'} onClick={() => { setGroupBy(g.key); setOpenMenu(null); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${groupBy === g.key ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>
                    {g.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => toolbar.toggleFavorite({ search })}
            className={`flex items-center gap-1 hover:text-gray-900 ${toolbar.favorite ? 'text-amber-500' : ''}`}>
            <Star className={`w-3.5 h-3.5 ${toolbar.favorite ? 'fill-amber-400' : ''}`} /> Favorites
          </button>
          <div className="relative">
            <button onClick={() => toolbar.setColsOpen(!toolbar.colsOpen)} title="Toggle columns"
              className="hover:text-gray-900"><SlidersHorizontal className="w-3.5 h-3.5" /></button>
            {toolbar.colsOpen && (
              <div className="absolute right-0 top-7 z-20 w-60 bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-72 overflow-y-auto">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-gray-500 uppercase">Columns</div>
                {COLUMNS.map((c) => (
                  <label key={c} className="flex items-center gap-2 px-3 py-1 text-xs hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300"
                      checked={!toolbar.hidden.includes(c)} onChange={() => toolbar.toggleColumn(c)} />
                    {c}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 text-xs">
            <span>{from}-{to} / {total}</span>
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="p-1 disabled:opacity-30 hover:text-gray-900"><ChevronLeft className="w-4 h-4" /></button>
            <button disabled={to >= total} onClick={() => setPage((p) => p + 1)} className="p-1 disabled:opacity-30 hover:text-gray-900"><ChevronRight className="w-4 h-4" /></button>
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
                  {shown.map((h) => (
                    <th key={h} className="text-left px-3 py-2 font-semibold text-gray-800 text-xs whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 ? (
                  <tr><td colSpan={shown.length + 1} className="text-center py-10 text-gray-400">No TMS requests found</td></tr>
                ) : groups ? groups.map(([label, gr]) => (
                  <React.Fragment key={label}>
                    <tr className="bg-gray-100 cursor-pointer" onClick={() => setCollapsed((c) => ({ ...c, [label]: !c[label] }))}>
                      <td colSpan={shown.length + 1} className="px-3 py-2 font-semibold text-gray-700 text-xs">
                        <span className="inline-flex items-center gap-1">
                          {collapsed[label] ? <ChevRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          {label} ({gr.length})
                        </span>
                      </td>
                    </tr>
                    {!collapsed[label] && gr.map(Row)}
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

export default TMSRequestList;
