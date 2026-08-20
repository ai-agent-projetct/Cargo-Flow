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
import { exportCsv, parseCsv } from '../../../utils/exportCsv';
import toast from 'react-hot-toast';

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
  // The vendor side drops the shipment columns the customer views carry and
  // labels the partner as Vendor.
  bills: ['Number', 'Vendor', 'Bill Date', 'Due Date', 'Reference', 'Next Activity',
    'Company Currency', 'Tax Excluded', 'Total', 'Payment Status', 'Status'],
  refunds: ['Number', 'Vendor', 'Bill Date', 'Due Date', 'Reference', 'Next Activity',
    'Company Currency', 'Tax Excluded', 'Total', 'Payment Status', 'Status'],
  'vendor-debit-notes': ['Number', 'Vendor', 'Bill Date', 'Due Date', 'Reference', 'Next Activity',
    'Company Currency', 'Tax Excluded', 'Total', 'Payment Status', 'Status'],
};

const VENDOR_MENUS = new Set(['bills', 'refunds', 'vendor-debit-notes']);

// The menu key and the URL segment differ for vendor debit notes: the backend
// distinguishes them from the customer ones, the URL is already namespaced by
// /vendors and doesn't need to.
const SEGMENT_BY_MENU = { 'vendor-debit-notes': 'debit-notes' };

const TITLE_BY_MENU = {
  invoices: 'Invoices', 'credit-notes': 'Credit Notes', 'debit-notes': 'Debit Notes',
  bills: 'Bills', refunds: 'Refunds', 'vendor-debit-notes': 'Vendor Debit Notes',
};

const Chip = ({ children }) => (
  <span className="inline-block px-2 py-0.5 rounded-full border border-gray-300 text-[11px] text-gray-700 max-w-[9rem] truncate align-middle">
    {children}
  </span>
);

const MoveList = ({ menu = 'invoices', title, moveType }) => {
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
  // Vendor menus live under /vendors and drop the shipment + foreign-currency
  // columns, so both the row layout and the detail link differ.
  const vendorSide = VENDOR_MENUS.has(menu);
  const section = vendorSide ? 'vendors' : 'customers';
  const segment = SEGMENT_BY_MENU[menu] || menu;
  // Columns the user has switched off, remembered per menu.
  const [hidden, setHidden] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`cargoflo.cols.${menu}`)) || []; } catch { return []; }
  });
  const shownColumns = columns.filter((c) => !hidden.includes(c));
  useEffect(() => {
    localStorage.setItem(`cargoflo.cols.${menu}`, JSON.stringify(hidden));
  }, [hidden, menu]);

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
    // A Journals screen overrides the menu's default move type.
    if (moveType) q.moveType = moveType;
    filters.forEach((f) => { const [k, v] = f.split('='); q[k] = q[k] ? `${q[k]},${v}` : v; });
    const res = await guard(() => accountingAPI.list(q));
    if (res) {
      setRows(res.data.data || []);
      setMeta(res.data.pagination || { total: 0, totals: { untaxed: 0, total: 0 } });
    } else { setRows([]); }
    setLoading(false);
  }, [menu, page, search, filters, preset, moveType, guard]);

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

  // Export what is on screen, so the file reflects the filters in force.
  const onExport = () => {
    const spec = [
      { key: 'name', label: 'Number' },
      { key: 'partner', label: vendorSide ? 'Vendor' : 'Customer' },
      { key: 'invoiceDate', label: vendorSide ? 'Bill Date' : 'Invoice Date' },
      { key: 'invoiceDateDue', label: 'Due Date' },
      { key: 'companyCurrency', label: 'Company Currency' },
      { key: 'amountUntaxed', label: 'Tax Excluded' },
      { key: 'amountTax', label: 'Tax' },
      { key: 'amountTotal', label: 'Total' },
      { key: 'amountResidual', label: 'Amount Due' },
      { key: 'paymentState', label: 'Payment Status', format: (v) => PAYMENT[v] || v },
      { key: 'state', label: 'Status', format: (v) => STATE[v] || v },
      { key: 'houseShipmentRefs', label: 'House Shipment' },
      { key: 'serviceJobRefs', label: 'Service Jobs' },
    ];
    if (exportCsv(rows, spec, menu)) toast.success(`Exported ${rows.length} rows`);
    else toast.error('Nothing to export');
  };

  // Bring a CSV back in as draft documents. Only the columns the export writes
  // are understood, so a round-trip works without extra mapping.
  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!can('invoice', 'create')) { toast.error('You are not allowed to create records here'); return; }
    try {
      const { rows: parsed } = await parseCsv(file);
      if (!parsed.length) { toast.error('No rows found in that file'); return; }
      let made = 0;
      for (const r of parsed) {
        const partner = r.Customer || r.Vendor || r.Partner;
        if (!partner) continue;
        const ok = await guard(() => accountingAPI.create({
          partner,
          invoiceDate: r['Invoice Date'] || r['Bill Date'] || null,
          invoiceDateDue: r['Due Date'] || null,
          amountUntaxed: Number(r['Tax Excluded'] || 0),
          amountTax: Number(r.Tax || 0),
          amountTotal: Number(r.Total || 0),
        }, menu));
        if (ok) made += 1;
      }
      toast.success(`Imported ${made} draft ${made === 1 ? 'record' : 'records'}`);
      load();
    } catch (err) {
      toast.error('Could not read that file — export a list first to see the expected format');
    }
  };

  // Favourites are per-menu and remembered locally, the way the demo keeps a
  // starred filter set between visits.
  const favKey = `cargoflo.fav.${menu}`;
  const [favorite, setFavorite] = useState(() => !!localStorage.getItem(favKey));
  const toggleFavorite = () => {
    if (favorite) { localStorage.removeItem(favKey); setFavorite(false); toast('Removed from favourites'); return; }
    localStorage.setItem(favKey, JSON.stringify({ filters, search, groupBy }));
    setFavorite(true);
    toast.success('Saved current filters to favourites');
  };

  // Restore a saved favourite when the menu changes.
  useEffect(() => {
    const saved = localStorage.getItem(`cargoflo.fav.${menu}`);
    setFavorite(!!saved);
    if (saved) {
      try {
        const v = JSON.parse(saved);
        setFilters(v.filters || []);
        setSearch(v.search || '');
        setGroupBy(v.groupBy || '');
      } catch { /* a corrupt entry just means no favourite */ }
    }
  }, [menu]);

  // Cells are keyed by their column label so the column toggle can drop them
  // and the header without the two drifting out of alignment.
  const cellsFor = (r) => {
    const overdue = isOverdue(r.invoiceDateDue, r.paymentState);
    const draft = r.state === 'draft';
    const txt = draft ? 'text-blue-700' : 'text-gray-700';
    const partnerLabel = vendorSide ? 'Vendor' : 'Customer';
    const dateLabel = vendorSide ? 'Bill Date' : 'Invoice Date';
    const curLabel = menu === 'invoices' ? 'Invoice Currency' : 'Credit Note Currency';

    const map = {
      Number: (
        <span className="inline-flex items-center gap-1">
          <ExternalLink className="w-3 h-3 text-blue-700" />
          <span className={`font-semibold text-xs ${draft ? 'text-blue-700' : 'text-gray-900'}`}>{r.name}</span>
        </span>
      ),
      [partnerLabel]: <span className={`text-xs ${draft ? 'text-blue-700' : 'text-gray-800'}`} title={r.partner}>{r.partner}</span>,
      'Service Jobs': (r.serviceJobRefs || []).map((s) => <Chip key={s}>{s}</Chip>),
      'House Shipment': (r.houseShipmentRefs || []).map((s) => <Chip key={s}>{s}</Chip>),
      'Master Shipment': (r.masterShipmentRefs || []).map((s) => <Chip key={s}>{s}</Chip>),
      Reference: <span className="text-xs text-gray-700" title={r.ref || ''}>{r.ref || ''}</span>,
      [dateLabel]: <span className={`text-xs ${txt}`}>{fmtDate(r.invoiceDate)}</span>,
      'Due Date': <span className={`text-xs ${overdue ? 'text-red-600 font-medium' : 'text-gray-700'}`}>{fmtDate(r.invoiceDateDue)}</span>,
      'Next Activity': <span className="text-gray-300">○</span>,
      'Company Currency': <span className={`text-xs ${txt}`}>{r.companyCurrency}</span>,
      'Tax Excluded': <span className={`text-xs ${draft ? 'text-blue-700' : 'text-gray-800'}`}>{money(r.amountUntaxed, r.companyCurrency)}</span>,
      Total: <span className={`text-xs font-semibold ${draft ? 'text-blue-700' : 'text-gray-900'}`}>{money(r.amountTotal, r.companyCurrency)}</span>,
      [curLabel]: <span className={`text-xs ${txt}`}>{r.currency}</span>,
      'Total in Currency': <span className={`text-xs ${draft ? 'text-blue-700' : 'text-gray-800'}`}>{money(r.amountTotalCurrency, r.currency)}</span>,
      'Payment Status': (
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${PAYMENT_PILL[r.paymentState]}`}>
          {PAYMENT[r.paymentState]}
        </span>
      ),
      Status: (
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATE_PILL[r.state]}`}>
          {STATE[r.state]}
        </span>
      ),
    };
    return map;
  };

  const RIGHT_ALIGNED = new Set(['Tax Excluded', 'Total', 'Total in Currency']);

  const Row = (r) => {
    const map = cellsFor(r);
    return (
      <tr key={r.id} onClick={() => navigate(`/admin/accounting/${section}/${segment}/${r.id}`)}
        className="hover:bg-gray-50 cursor-pointer">
        <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" className="rounded border-gray-300" />
        </td>
        {shownColumns.map((c) => (
          <td key={c}
            className={`px-2 py-1.5 max-w-[12rem] truncate whitespace-nowrap ${RIGHT_ALIGNED.has(c) ? 'text-right' : ''}`}>
            {map[c] ?? ''}
          </td>
        ))}
      </tr>
    );
  };

  return (
    <div className="px-6 pb-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h2 className="text-base font-semibold text-gray-900">{title || TITLE_BY_MENU[menu] || 'Invoices'}</h2>
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
          <label className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
            <Upload className="w-4 h-4" /> Upload
            <input type="file" accept=".csv" className="hidden" onChange={onUpload} />
          </label>
          <button onClick={onExport}
            className="p-2 border border-gray-300 rounded text-gray-500 hover:bg-gray-50" title="Export">
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

          <button onClick={toggleFavorite}
            className={`flex items-center gap-1 hover:text-gray-900 ${favorite ? 'text-amber-500' : ''}`}>
            <Star className={`w-3.5 h-3.5 ${favorite ? 'fill-amber-400' : ''}`} /> Favorites
          </button>
          <div className="relative">
            <button onClick={() => setOpenMenu(openMenu === 'cols' ? null : 'cols')}
              className="hover:text-gray-900" title="Toggle columns"><SlidersHorizontal className="w-3.5 h-3.5" /></button>
            {openMenu === 'cols' && (
              <div className="absolute right-0 top-7 z-20 w-56 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-gray-500 uppercase">Columns</div>
                {columns.map((c) => (
                  <label key={c} className="flex items-center gap-2 px-3 py-1 text-xs hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300"
                      checked={!hidden.includes(c)}
                      onChange={() => setHidden((h) => (h.includes(c) ? h.filter((x) => x !== c) : [...h, c]))} />
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
                  {shownColumns.map((h) => (
                    <th key={h} className="text-left px-2 py-2 font-semibold text-gray-800 text-xs whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 ? (
                  <tr><td colSpan={shownColumns.length + 1} className="text-center py-10 text-gray-400">No records found</td></tr>
                ) : groups ? groups.map(([label, gr]) => (
                  <React.Fragment key={label}>
                    <tr className="bg-gray-100 cursor-pointer"
                      onClick={() => setCollapsed((c) => ({ ...c, [label]: !c[label] }))}>
                      <td colSpan={shownColumns.length + 1} className="px-3 py-2 font-semibold text-gray-700 text-xs">
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
                    {/* Totals sit under Tax Excluded and Total, so the leading
                        span is however many columns precede them (+1 for the
                        checkbox), and the trailing span is whatever follows. */}
                    <td colSpan={shownColumns.indexOf('Tax Excluded') + 1} />
                    <td className="px-2 py-2 text-xs text-right font-semibold text-gray-900 whitespace-nowrap">
                      {Number(meta.totals?.untaxed || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-2 text-xs text-right font-semibold text-gray-900 whitespace-nowrap">
                      {Number(meta.totals?.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td colSpan={shownColumns.length - shownColumns.indexOf('Total') - 1} />
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
