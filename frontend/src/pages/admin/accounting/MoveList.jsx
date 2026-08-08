import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Search, Download, Upload, Filter, Layers, Star, SlidersHorizontal,
  ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevRight, List, LayoutGrid, ExternalLink,
} from 'lucide-react';
import { accountingAPI } from '../../../services/api';
import { usePermissions } from '../../../context/PermissionContext';
import { PageLoader } from '../../../common/LoadingSpinner';
import { STATE, STATE_PILL, PAYMENT, PAYMENT_PILL, fmtDate, isOverdue, money } from './constants';

const PAGE_SIZE = 80;

// Column set per menu. Credit/Debit Notes lead with a Number column and an
// open-in-new icon, exactly as the demo does.
const COLUMNS_BY_MENU = {
  invoices: ['Customer', 'Service Jobs', 'House Shipment', 'Master Shipment', 'Invoice Date',
    'Due Date', 'Next Activity', 'Company Currency', 'Tax Excluded', 'Total',
    'Invoice Currency', 'Total in Currency', 'Payment Status', 'Status'],
  'credit-notes': ['Number', 'Customer', 'Service Jobs', 'House Shipment', 'Master Shipment',
    'Invoice Date', 'Due Date', 'Next Activity', 'Company Currency', 'Tax Excluded', 'Total',
    'Credit Note Currency', 'Total in Currency', 'Payment Status', 'Status'],
  'debit-notes': ['Number', 'Customer', 'Service Jobs', 'House Shipment', 'Master Shipment',
    'Invoice Date', 'Due Date', 'Next Activity', 'Company Currency', 'Tax Excluded', 'Total',
    'Credit Note Currency', 'Total in Currency', 'Payment Status', 'Status'],
};

const TITLE_BY_MENU = {
  invoices: 'Invoices', 'credit-notes': 'Credit Notes', 'debit-notes': 'Debit Notes',
  bills: 'Bills', refunds: 'Refunds', 'vendor-debit-notes': 'Vendor Debit Notes',
};

const Chip = ({ children }) => (
  <span className="inline-block px-2 py-0.5 rounded-full border border-gray-300 text-[11px] text-gray-700 max-w-[9rem] truncate align-middle">
    {children}
  </span>
);

const MoveList = ({ menu = 'invoices' }) => {
  const navigate = useNavigate();
  const { guard, can } = usePermissions();
  const [params] = useSearchParams();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, totals: { untaxed: 0, total: 0 } });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [facets, setFacets] = useState({ partners: [], journals: [], states: [], paymentStates: [] });
  const [filters, setFilters] = useState([]);
  const [groupBy, setGroupBy] = useState('');
  const [view, setView] = useState('list');
  const [openMenu, setOpenMenu] = useState(null);
  const [collapsed, setCollapsed] = useState({});
  const menuRef = useRef(null);

  const columns = COLUMNS_BY_MENU[menu] || COLUMNS_BY_MENU.invoices;
  const showNumber = columns[0] === 'Number';

  // The dashboard's counter links arrive as query params.
  const preset = useMemo(() => ({
    journal: params.get('journal') || undefined,
    status: params.get('status') || undefined,
    payment: params.get('payment') || undefined,
    overdue: params.get('overdue') || undefined,
    to_check: params.get('to_check') || undefined,
  }), [params]);

  const load = useCallback(async () => {
    setLoading(true);
    const q = { menu, page, limit: PAGE_SIZE, search: search || undefined, ...preset };
    filters.forEach((f) => { const [k, v] = f.split('='); q[k] = q[k] ? `${q[k]},${v}` : v; });
    const res = await guard(() => accountingAPI.list(q));
    if (res) {
      setRows(res.data.data || []);
      setMeta(res.data.pagination || { total: 0, totals: { untaxed: 0, total: 0 } });
    } else { setRows([]); }
    setLoading(false);
  }, [menu, page, search, filters, preset, guard]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, filters, menu]);

  useEffect(() => {
    accountingAPI.facets(menu).then((r) => setFacets(r.data.data)).catch(() => {});
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
      const label = groupBy === 'state' ? STATE[r.state]
        : groupBy === 'paymentState' ? PAYMENT[r.paymentState]
          : (r[groupBy] || 'Undefined');
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(r);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows, groupBy]);

  const total = meta.total || 0;
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const toggle = (k) => setFilters((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const Row = (r) => {
    const overdue = isOverdue(r.invoiceDateDue, r.paymentState);
    const draft = r.state === 'draft';
    return (
      <tr key={r.id} onClick={() => navigate(`/admin/accounting/customers/${menu}/${r.id}`)}
        className="hover:bg-gray-50 cursor-pointer">
        <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" className="rounded border-gray-300" />
        </td>
        {showNumber && (
          <td className="px-2 py-1.5 whitespace-nowrap">
            <span className="inline-flex items-center gap-1">
              <ExternalLink className="w-3 h-3 text-blue-700" />
              <span className={`font-semibold text-xs ${draft ? 'text-blue-700' : 'text-gray-900'}`}>{r.name}</span>
            </span>
          </td>
        )}
        <td className={`px-2 py-1.5 text-xs max-w-[10rem] truncate ${draft ? 'text-blue-700' : 'text-gray-800'}`}
          title={r.partner}>{r.partner}</td>
        <td className="px-2 py-1.5">{(r.serviceJobRefs || []).map((s) => <Chip key={s}>{s}</Chip>)}</td>
        <td className="px-2 py-1.5">{(r.houseShipmentRefs || []).map((s) => <Chip key={s}>{s}</Chip>)}</td>
        <td className="px-2 py-1.5">{(r.masterShipmentRefs || []).map((s) => <Chip key={s}>{s}</Chip>)}</td>
        <td className={`px-2 py-1.5 text-xs whitespace-nowrap ${draft ? 'text-blue-700' : 'text-gray-700'}`}>
          {fmtDate(r.invoiceDate)}
        </td>
        <td className={`px-2 py-1.5 text-xs whitespace-nowrap ${overdue ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
          {fmtDate(r.invoiceDateDue)}
        </td>
        <td className="px-2 py-1.5 text-gray-300 text-center">○</td>
        <td className={`px-2 py-1.5 text-xs ${draft ? 'text-blue-700' : 'text-gray-700'}`}>{r.companyCurrency}</td>
        <td className={`px-2 py-1.5 text-xs text-right whitespace-nowrap ${draft ? 'text-blue-700' : 'text-gray-800'}`}>
          {money(r.amountUntaxed, r.companyCurrency)}
        </td>
        <td className={`px-2 py-1.5 text-xs text-right whitespace-nowrap font-semibold ${draft ? 'text-blue-700' : 'text-gray-900'}`}>
          {money(r.amountTotal, r.companyCurrency)}
        </td>
        <td className={`px-2 py-1.5 text-xs ${draft ? 'text-blue-700' : 'text-gray-700'}`}>{r.currency}</td>
        <td className={`px-2 py-1.5 text-xs text-right whitespace-nowrap ${draft ? 'text-blue-700' : 'text-gray-800'}`}>
          {money(r.amountTotalCurrency, r.currency)}
        </td>
        <td className="px-2 py-1.5">
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${PAYMENT_PILL[r.paymentState]}`}>
            {PAYMENT[r.paymentState]}
          </span>
        </td>
        <td className="px-2 py-1.5">
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATE_PILL[r.state]}`}>
            {STATE[r.state]}
          </span>
        </td>
      </tr>
    );
  };

  return (
    <div className="px-6 pb-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h2 className="text-base font-semibold text-gray-900">{TITLE_BY_MENU[menu] || 'Invoices'}</h2>
        <div className="relative">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..."
            className="w-[26rem] pl-3 pr-9 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <Search className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap mb-3 relative overflow-visible" ref={menuRef}>
        <div className="flex items-center gap-2">
          {can('invoice', 'create') && (
            <button onClick={() => navigate(`/admin/accounting/customers/${menu}/create`)}
              className="flex items-center gap-2 px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded">
              <Plus className="w-4 h-4" /> Create
            </button>
          )}
          <button className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50">
            <Upload className="w-4 h-4" /> Upload
          </button>
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
                  <label key={s.key} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300"
                      checked={filters.includes(`status=${s.key}`)} onChange={() => toggle(`status=${s.key}`)} />
                    {s.label}
                  </label>
                ))}
                <p className="px-3 py-1 mt-1 text-[10px] font-bold uppercase tracking-wide text-gray-400 border-t border-gray-100">Payment Status</p>
                {(facets.paymentStates || []).map((s) => (
                  <label key={s.key} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300"
                      checked={filters.includes(`payment=${s.key}`)} onChange={() => toggle(`payment=${s.key}`)} />
                    {s.label}
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
                  { key: 'paymentState', label: 'Payment Status' }, { key: 'partner', label: 'Customer' },
                  { key: 'journal', label: 'Journal' }, { key: 'currency', label: 'Currency' }].map((g) => (
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
            <button onClick={() => setView('list')} title="List"
              className={`px-2 py-1 ${view === 'list' ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              <List className="w-4 h-4" />
            </button>
            <button onClick={() => setView('kanban')} title="Kanban"
              className={`px-2 py-1 ${view === 'kanban' ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {loading ? <PageLoader /> : view === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {rows.map((r) => (
            <button key={r.id} onClick={() => navigate(`/admin/accounting/customers/${menu}/${r.id}`)}
              className="bg-white border border-gray-200 rounded-lg p-3 text-left hover:shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-gray-900 text-sm">{r.name === '/' ? 'Draft' : r.name}</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] ${STATE_PILL[r.state]}`}>{STATE[r.state]}</span>
              </div>
              <p className="text-sm text-gray-700 mt-1 truncate">{r.partner}</p>
              <p className="text-xs text-gray-500 mt-0.5">{fmtDate(r.invoiceDate)}</p>
              <div className="flex items-center justify-between mt-2">
                <span className={`px-2 py-0.5 rounded-full text-[11px] ${PAYMENT_PILL[r.paymentState]}`}>
                  {PAYMENT[r.paymentState]}
                </span>
                <span className="font-semibold text-gray-900 text-sm">{money(r.amountTotal, r.companyCurrency)}</span>
              </div>
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
                  {columns.map((h) => (
                    <th key={h} className="text-left px-2 py-2 font-semibold text-gray-800 text-xs whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 ? (
                  <tr><td colSpan={columns.length + 1} className="text-center py-10 text-gray-400">No records found</td></tr>
                ) : groups ? groups.map(([label, gr]) => (
                  <React.Fragment key={label}>
                    <tr className="bg-gray-100 cursor-pointer"
                      onClick={() => setCollapsed((c) => ({ ...c, [label]: !c[label] }))}>
                      <td colSpan={columns.length + 1} className="px-3 py-2 font-semibold text-gray-700 text-xs">
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
                    <td colSpan={showNumber ? 10 : 9} />
                    <td className="px-2 py-2 text-xs text-right font-semibold text-gray-900 whitespace-nowrap">
                      {Number(meta.totals?.untaxed || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-2 text-xs text-right font-semibold text-gray-900 whitespace-nowrap">
                      {Number(meta.totals?.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td colSpan={4} />
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

export default MoveList;
