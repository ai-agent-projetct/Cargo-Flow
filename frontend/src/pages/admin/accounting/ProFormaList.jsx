import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Download, Filter, Layers, Star, SlidersHorizontal,
  ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevRight,
  List, LayoutGrid, ExternalLink,
} from 'lucide-react';
import { accountingAPI } from '../../../services/api';
import { usePermissions } from '../../../context/PermissionContext';
import { PageLoader } from '../../../common/LoadingSpinner';
import { useListToolbar } from './useListToolbar';

const PAGE_SIZE = 80;

export const PF_STATE = {
  to_approve: 'To Approve', approved: 'Approved',
  invoiced: 'Invoiced', cancel: 'Cancel',
};
export const PF_PILL = {
  to_approve: 'bg-amber-100 text-amber-800',
  approved: 'bg-blue-100 text-blue-700',
  invoiced: 'bg-green-100 text-green-700',
  cancel: 'bg-gray-200 text-gray-500',
};

const COLUMNS = ['Customer', 'Number', 'Service Jobs', 'House Shipment', 'Next Activity',
  'Company Currency', 'Taxes', 'Total', 'Company', 'Currency', 'State'];

const Chip = ({ children }) => (
  <span className="inline-block px-2 py-0.5 rounded-full border border-gray-300 text-[11px] text-gray-700 max-w-[9rem] truncate align-middle">
    {children}
  </span>
);

const ProFormaList = () => {
  const navigate = useNavigate();
  const { guard, can } = usePermissions();
  const base = '/admin/accounting/customers/pro-forma';

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, totals: { taxes: 0, total: 0 } });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Export / Favorites / column toggle, shared with the other accounting lists.
  const toolbar = useListToolbar({
    key: 'pro-forma',
    rows: rows,
    columns: COLUMNS,
    exportSpec: [
      { key: 'customer', label: 'Customer' },
      { key: 'name', label: 'Number' },
      { key: 'serviceJobRefs', label: 'Service Jobs' },
      { key: 'houseShipmentRefs', label: 'House Shipment' },
      { key: 'companyCurrency', label: 'Company Currency' },
      { key: 'taxes', label: 'Taxes' },
      { key: 'total', label: 'Total' },
      { key: 'currency', label: 'Currency' },
      { key: 'state', label: 'State' },
    ],
  });
  const [search, setSearch] = useState('');
  const [facets, setFacets] = useState({ states: [], customers: [] });
  const [filters, setFilters] = useState([]);
  const [groupBy, setGroupBy] = useState('');
  const [view, setView] = useState('list');
  const [openMenu, setOpenMenu] = useState(null);
  const [collapsed, setCollapsed] = useState({});
  const menuRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    const q = { page, limit: PAGE_SIZE, search: search || undefined };
    filters.forEach((f) => { const [k, v] = f.split('='); q[k] = q[k] ? `${q[k]},${v}` : v; });
    const res = await guard(() => accountingAPI.proFormas(q));
    if (res) {
      setRows(res.data.data || []);
      setMeta(res.data.pagination || { total: 0, totals: { taxes: 0, total: 0 } });
    } else { setRows([]); }
    setLoading(false);
  }, [page, search, filters, guard]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, filters]);

  useEffect(() => {
    accountingAPI.proFormaFacets().then((r) => setFacets(r.data.data)).catch(() => {});
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
      const label = groupBy === 'state' ? PF_STATE[r.state] : (r[groupBy] || 'Undefined');
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(r);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows, groupBy]);

  const total = meta.total || 0;
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const toggle = (k) => setFilters((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const dec = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const Row = (r) => (
    <tr key={r.id} onClick={() => navigate(`${base}/${r.id}`)} className="hover:bg-gray-50 cursor-pointer">
      <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" className="rounded border-gray-300" />
      </td>
      <td className="px-2 py-1.5 text-xs text-gray-800 max-w-[14rem] truncate" title={r.customer}>{r.customer}</td>
      <td className="px-2 py-1.5 whitespace-nowrap">
        <span className="inline-flex items-center gap-1">
          <ExternalLink className="w-3 h-3 text-blue-700" />
          <span className="font-semibold text-xs text-gray-900">{r.name}</span>
        </span>
      </td>
      <td className="px-2 py-1.5">{(r.serviceJobRefs || []).map((s) => <Chip key={s}>{s}</Chip>)}</td>
      <td className="px-2 py-1.5">{(r.houseShipmentRefs || []).map((s) => <Chip key={s}>{s}</Chip>)}</td>
      <td className="px-2 py-1.5 text-gray-300 text-center">○</td>
      <td className="px-2 py-1.5 text-xs text-gray-700">{r.companyCurrency}</td>
      <td className="px-2 py-1.5 text-xs text-right text-gray-800 whitespace-nowrap">{dec(r.taxes)}</td>
      <td className="px-2 py-1.5 text-xs text-right font-semibold text-gray-900 whitespace-nowrap">{dec(r.total)}</td>
      <td className="px-2 py-1.5 text-xs text-gray-600 max-w-[10rem] truncate">{r.company}</td>
      <td className="px-2 py-1.5 text-xs text-gray-700">{r.currency}</td>
      <td className="px-2 py-1.5">
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${PF_PILL[r.state]}`}>
          {PF_STATE[r.state]}
        </span>
      </td>
    </tr>
  );

  return (
    <div className="px-6 pb-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h2 className="text-base font-semibold text-gray-900">Pro Forma Invoice</h2>
        <div className="relative">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..."
            className="w-[26rem] pl-3 pr-9 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <Search className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap mb-3 relative overflow-visible" ref={menuRef}>
        <div className="flex items-center gap-2">
          {can('pro.forma.invoice', 'create') && (
            <button onClick={() => navigate(`${base}/create`)}
              className="flex items-center gap-2 px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded">
              <Plus className="w-4 h-4" /> Create
            </button>
          )}
          <button onClick={toolbar.onExport} className="p-2 border border-gray-300 rounded text-gray-500 hover:bg-gray-50" title="Export">
            <Download className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3 text-sm text-gray-600">
          <div className="relative">
            <button onClick={() => setOpenMenu(openMenu === 'filter' ? null : 'filter')}
              className="flex items-center gap-1 hover:text-gray-900">
              <Filter className="w-3.5 h-3.5" /> Filters
              {filters.length > 0 && <span className="text-xs text-blue-700">({filters.length})</span>}
            </button>
            {openMenu === 'filter' && (
              <div className="absolute right-0 top-full mt-1 z-30 w-64 max-h-96 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">State</p>
                {(facets.states || []).map((s) => (
                  <label key={s.value} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300"
                      checked={filters.includes(`status=${s.value}`)} onChange={() => toggle(`status=${s.value}`)} />
                    {PF_STATE[s.value] || s.value} <span className="text-gray-400 text-xs">({s.count})</span>
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
            <button onClick={() => setOpenMenu(openMenu === 'group' ? null : 'group')}
              className="flex items-center gap-1 hover:text-gray-900">
              <Layers className="w-3.5 h-3.5" /> Group By
            </button>
            {openMenu === 'group' && (
              <div className="absolute right-0 top-full mt-1 z-30 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                {[{ key: '', label: 'None' }, { key: 'state', label: 'State' },
                  { key: 'customer', label: 'Customer' }, { key: 'currency', label: 'Currency' }].map((g) => (
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
              <div className="absolute right-0 top-7 z-20 w-56 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
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
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
              className="p-1 disabled:opacity-30 hover:text-gray-900"><ChevronLeft className="w-4 h-4" /></button>
            <button disabled={to >= total} onClick={() => setPage((p) => p + 1)}
              className="p-1 disabled:opacity-30 hover:text-gray-900"><ChevronRight className="w-4 h-4" /></button>
          </div>

          <div className="flex border border-gray-300 rounded overflow-hidden">
            {[['list', List], ['kanban', LayoutGrid]].map(([k, Icon]) => (
              <button key={k} onClick={() => setView(k)} title={k}
                className={`px-2 py-1 ${view === k ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? <PageLoader /> : view === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {rows.map((r) => (
            <button key={r.id} onClick={() => navigate(`${base}/${r.id}`)}
              className="bg-white border border-gray-200 rounded-lg p-3 text-left hover:shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-gray-900 text-sm">{r.name}</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] ${PF_PILL[r.state]}`}>{PF_STATE[r.state]}</span>
              </div>
              <p className="text-sm text-gray-700 mt-1 truncate">{r.customer}</p>
              <p className="text-xs text-gray-500 mt-0.5">{(r.houseShipmentRefs || []).join(', ')}</p>
              <p className="font-semibold text-gray-900 text-sm mt-2 text-right">{dec(r.total)} {r.currency}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className="px-2 py-2 w-8"><input type="checkbox" className="rounded border-gray-300" /></th>
                  {COLUMNS.map((h) => (
                    <th key={h} className={`px-2 py-2 font-semibold text-gray-800 text-xs whitespace-nowrap ${['Taxes', 'Total'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 ? (
                  <tr><td colSpan={COLUMNS.length + 1} className="text-center py-10 text-gray-400">No records found</td></tr>
                ) : groups ? groups.map(([label, gr]) => (
                  <React.Fragment key={label}>
                    <tr className="bg-gray-100 cursor-pointer"
                      onClick={() => setCollapsed((c) => ({ ...c, [label]: !c[label] }))}>
                      <td colSpan={COLUMNS.length + 1} className="px-3 py-2 font-semibold text-gray-700 text-xs">
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
              {rows.length > 0 && (
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={7} />
                    <td className="px-2 py-2 text-xs text-right font-semibold text-gray-900 whitespace-nowrap">{dec(meta.totals?.taxes)}</td>
                    <td className="px-2 py-2 text-xs text-right font-semibold text-gray-900 whitespace-nowrap">{dec(meta.totals?.total)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProFormaList;
