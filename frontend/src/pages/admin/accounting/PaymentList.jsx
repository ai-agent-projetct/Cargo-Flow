import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Download, Filter, Layers, Star, SlidersHorizontal,
  ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevRight,
  List, LayoutGrid, BarChart3, X,
} from 'lucide-react';
import { accountingAPI } from '../../../services/api';
import { usePermissions } from '../../../context/PermissionContext';
import { PageLoader } from '../../../common/LoadingSpinner';
import { fmtDate, money } from './constants';

const PAGE_SIZE = 80;

// account.payment's own states — the invoice pills don't apply here.
const PSTATE = {
  draft: 'Draft', posted: 'Posted', sent: 'Sent',
  reconciled: 'Reconciled', cancel: 'Cancelled',
};
const PSTATE_PILL = {
  draft: 'bg-gray-100 text-gray-700',
  posted: 'bg-green-100 text-green-700',
  sent: 'bg-blue-100 text-blue-700',
  reconciled: 'bg-teal-100 text-teal-700',
  cancel: 'bg-gray-200 text-gray-500',
};

const COLUMNS = ['Date', 'Number', 'Journal', 'Payment Method', 'Customer',
  'Invoice Number', 'Amount', 'Status'];

const PaymentList = ({ menu = 'payments' }) => {
  const navigate = useNavigate();
  const { guard, can } = usePermissions();
  const vendor = menu === 'vendor-payments';
  const base = vendor ? '/admin/accounting/vendors/payments' : '/admin/accounting/customers/payments';

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, totals: { amount: 0 } });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [facets, setFacets] = useState({ journals: [], methods: [], states: [] });
  const [filters, setFilters] = useState([]);
  // The demo lands on this list with the "Customer Payments" chip already set.
  const [scope, setScope] = useState(true);
  const [groupBy, setGroupBy] = useState('');
  const [view, setView] = useState('list');
  const [openMenu, setOpenMenu] = useState(null);
  const [collapsed, setCollapsed] = useState({});
  const menuRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    const q = { menu, page, limit: PAGE_SIZE, search: search || undefined };
    filters.forEach((f) => { const [k, v] = f.split('='); q[k] = q[k] ? `${q[k]},${v}` : v; });
    const res = await guard(() => accountingAPI.payments(q));
    if (res) {
      setRows(res.data.data || []);
      setMeta(res.data.pagination || { total: 0, totals: { amount: 0 } });
    } else { setRows([]); }
    setLoading(false);
  }, [menu, page, search, filters, guard]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, filters, menu]);

  useEffect(() => {
    accountingAPI.paymentFacets(menu).then((r) => setFacets(r.data.data)).catch(() => {});
  }, [menu]);

  useEffect(() => {
    const away = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const groups = useMemo(() => {
    if (!groupBy) return null;
    const map = new Map();
    rows.forEach((r) => {
      const label = groupBy === 'state' ? PSTATE[r.state] : (r[groupBy] || 'Undefined');
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(r);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows, groupBy]);

  // The chart toggle shows amounts settled per month across the page.
  const chart = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const k = String(r.paymentDate || '').slice(0, 7);
      if (!k) return;
      map.set(k, (map.get(k) || 0) + Number(r.amount || 0));
    });
    const entries = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
    const peak = Math.max(1, ...entries.map(([, v]) => v));
    return { entries, peak };
  }, [rows]);

  const total = meta.total || 0;
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const toggle = (k) => setFilters((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const Row = (r) => {
    const draft = r.state === 'draft';
    return (
      <tr key={r.id} onClick={() => navigate(`${base}/${r.id}`)} className="hover:bg-gray-50 cursor-pointer">
        <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" className="rounded border-gray-300" />
        </td>
        <td className={`px-2 py-1.5 text-xs whitespace-nowrap ${draft ? 'text-blue-700' : 'text-gray-700'}`}>
          {fmtDate(r.paymentDate)}
        </td>
        <td className={`px-2 py-1.5 text-xs font-semibold whitespace-nowrap ${draft ? 'text-blue-700' : 'text-gray-900'}`}>
          {r.name}
        </td>
        <td className="px-2 py-1.5 text-xs text-gray-700 whitespace-nowrap">{r.journal}</td>
        <td className="px-2 py-1.5 text-xs text-gray-700 whitespace-nowrap">{r.paymentMethod}</td>
        <td className="px-2 py-1.5 text-xs text-gray-800 max-w-[14rem] truncate" title={r.partner}>{r.partner}</td>
        <td className="px-2 py-1.5 text-xs text-gray-700 max-w-[16rem] truncate"
          title={(r.invoiceNumbers || []).join(', ')}>
          {(r.invoiceNumbers || []).join(', ')}
        </td>
        <td className="px-2 py-1.5 text-xs text-right font-semibold text-gray-900 whitespace-nowrap">
          {money(r.amount, r.currency)}
        </td>
        <td className="px-2 py-1.5">
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${PSTATE_PILL[r.state]}`}>
            {PSTATE[r.state]}
          </span>
        </td>
      </tr>
    );
  };

  return (
    <div className="px-6 pb-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h2 className="text-base font-semibold text-gray-900">Payments</h2>
        <div className="flex items-center gap-2">
          {scope && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 border border-blue-200 text-xs text-blue-800">
              {vendor ? 'Vendor Payments' : 'Customer Payments'}
              <button onClick={() => setScope(false)} className="hover:text-blue-900"><X className="w-3 h-3" /></button>
            </span>
          )}
          <div className="relative">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..."
              className="w-[24rem] pl-3 pr-9 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <Search className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap mb-3 relative overflow-visible" ref={menuRef}>
        <div className="flex items-center gap-2">
          {can('account.payment', 'create') && (
            <button onClick={() => navigate(`${base}/create`)}
              className="flex items-center gap-2 px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded">
              <Plus className="w-4 h-4" /> Create
            </button>
          )}
          <button className="p-2 border border-gray-300 rounded text-gray-500 hover:bg-gray-50" title="Export">
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
                <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">Status</p>
                {(facets.states || []).map((s) => (
                  <label key={s.value} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300"
                      checked={filters.includes(`status=${s.value}`)} onChange={() => toggle(`status=${s.value}`)} />
                    {PSTATE[s.value] || s.value} <span className="text-gray-400 text-xs">({s.count})</span>
                  </label>
                ))}
                <p className="px-3 py-1 mt-1 text-[10px] font-bold uppercase tracking-wide text-gray-400 border-t border-gray-100">Payment Method</p>
                {(facets.methods || []).map((s) => (
                  <label key={s.value} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300"
                      checked={filters.includes(`method=${s.value}`)} onChange={() => toggle(`method=${s.value}`)} />
                    {s.value} <span className="text-gray-400 text-xs">({s.count})</span>
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
                {[{ key: '', label: 'None' }, { key: 'state', label: 'Status' },
                  { key: 'journal', label: 'Journal' }, { key: 'paymentMethod', label: 'Payment Method' },
                  { key: 'partner', label: vendor ? 'Vendor' : 'Customer' }].map((g) => (
                    <button key={g.key || 'none'} onClick={() => { setGroupBy(g.key); setOpenMenu(null); }}
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

          <div className="flex border border-gray-300 rounded overflow-hidden">
            {[['list', List], ['kanban', LayoutGrid], ['chart', BarChart3]].map(([k, Icon]) => (
              <button key={k} onClick={() => setView(k)} title={k}
                className={`px-2 py-1 ${view === k ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? <PageLoader /> : view === 'chart' ? (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-gray-800 mb-4">Payments by month</p>
          <div className="flex items-end gap-2 h-56">
            {chart.entries.map(([k, v]) => (
              <div key={k} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-[2rem]">
                <span className="text-[10px] text-gray-500">{Math.round(v).toLocaleString('en-US')}</span>
                <div className="w-full bg-blue-600 rounded-t" style={{ height: `${(v / chart.peak) * 100}%` }} />
                <span className="text-[10px] text-gray-500 -rotate-45 origin-top-left whitespace-nowrap mt-1">{k}</span>
              </div>
            ))}
          </div>
        </div>
      ) : view === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {rows.map((r) => (
            <button key={r.id} onClick={() => navigate(`${base}/${r.id}`)}
              className="bg-white border border-gray-200 rounded-lg p-3 text-left hover:shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-gray-900 text-sm">{r.name}</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] ${PSTATE_PILL[r.state]}`}>{PSTATE[r.state]}</span>
              </div>
              <p className="text-sm text-gray-700 mt-1 truncate">{r.partner}</p>
              <p className="text-xs text-gray-500 mt-0.5">{fmtDate(r.paymentDate)} · {r.journal}</p>
              <p className="font-semibold text-gray-900 text-sm mt-2 text-right">{money(r.amount, r.currency)}</p>
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
                    <th key={h} className={`px-2 py-2 font-semibold text-gray-800 text-xs whitespace-nowrap ${h === 'Amount' ? 'text-right' : 'text-left'}`}>{h}</th>
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
                    <td className="px-2 py-2 text-xs text-right font-semibold text-gray-900 whitespace-nowrap">
                      {Number(meta.totals?.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td />
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

export default PaymentList;
