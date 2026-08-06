import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Download, Star, Filter, Layers, ChevronDown, ChevronRight } from 'lucide-react';
import { purchaseOrdersAPI } from '../../../services/api';
import { PageLoader } from '../../../common/LoadingSpinner';
import { STATE_LABELS, STATE_BADGE, FILTERS, GROUP_BY, fmtDateTime } from './constants';

const COLUMNS = ['Purchase Order', 'PO Date', 'Vendor', 'Shipment Number', 'Status'];

// Group rows the way Odoo's Group By does: a header row per bucket, records
// nested beneath, undefined values first.
const buildGroups = (rows, key) => {
  if (!key) return null;
  const map = new Map();
  rows.forEach((row) => {
    const raw = row[key];
    const label = key === 'state' ? (STATE_LABELS[raw] || raw) : (raw || 'Undefined');
    if (!map.has(label)) map.set(label, []);
    map.get(label).push(row);
  });
  return [...map.entries()].sort(([a], [b]) => {
    if (a === 'Undefined') return -1;
    if (b === 'Undefined') return 1;
    return a.localeCompare(b);
  });
};

const PurchaseOrderList = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [states, setStates] = useState([]);
  const [groupBy, setGroupBy] = useState('');
  const [openMenu, setOpenMenu] = useState(null);
  const [collapsed, setCollapsed] = useState({});
  const menuRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await purchaseOrdersAPI.getAll({
        search: search || undefined,
        state: states.length ? states.join(',') : undefined,
        limit: 200,
      });
      setRows(res.data?.data || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [search, states]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onClickAway = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  // Optimistic star toggle — the list re-renders before the round trip lands.
  const toggleStar = async (po, e) => {
    e.stopPropagation();
    const next = po.priority ? 0 : 1;
    setRows((prev) => prev.map((r) => (r.id === po.id ? { ...r, priority: next } : r)));
    try {
      await purchaseOrdersAPI.setPriority(po.id, next);
    } catch {
      setRows((prev) => prev.map((r) => (r.id === po.id ? { ...r, priority: po.priority } : r)));
    }
  };

  const groups = useMemo(() => buildGroups(rows, groupBy), [rows, groupBy]);

  const renderRow = (po) => (
    <tr
      key={po.id}
      onClick={() => navigate(`/admin/procurement/purchase-orders/${po.id}`)}
      className="hover:bg-gray-50 cursor-pointer"
    >
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" className="rounded border-gray-300" />
      </td>
      <td className="px-2 py-3">
        <button onClick={(e) => toggleStar(po, e)} title="Favourite">
          <Star
            className={`w-4 h-4 ${po.priority ? 'text-amber-400 fill-amber-400' : 'text-gray-300 hover:text-amber-400'}`}
          />
        </button>
      </td>
      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{po.poNumber}</td>
      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{fmtDateTime(po.poDate)}</td>
      <td className="px-4 py-3 text-gray-700 text-xs max-w-[20rem] truncate" title={po.vendor}>{po.vendor || '-'}</td>
      <td className="px-4 py-3 text-gray-700 text-xs whitespace-nowrap">{po.shipmentNo || '-'}</td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATE_BADGE[po.state] || 'bg-gray-100 text-gray-700'}`}>
          {STATE_LABELS[po.state] || po.state}
        </span>
      </td>
    </tr>
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">Purchase Order</h1>
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

      <div className="flex items-center gap-2 relative overflow-visible" ref={menuRef}>
        <button
          onClick={() => navigate('/admin/procurement/purchase-orders/create')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg"
        >
          <Plus className="w-4 h-4" /> Create
        </button>

        <div className="relative">
          <button
            onClick={() => setOpenMenu(openMenu === 'filter' ? null : 'filter')}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
          >
            <Filter className="w-4 h-4" /> Filters
            {states.length > 0 && <span className="text-xs text-blue-700">({states.length})</span>}
          </button>
          {openMenu === 'filter' && (
            <div className="absolute left-0 top-full mt-1 z-30 w-56 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
              {FILTERS.map((f) => (
                <label key={f.key} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={states.includes(f.key)}
                    onChange={() => setStates((prev) =>
                      prev.includes(f.key) ? prev.filter((s) => s !== f.key) : [...prev, f.key]
                    )}
                  />
                  {f.label}
                </label>
              ))}
              {states.length > 0 && (
                <button
                  onClick={() => setStates([])}
                  className="w-full text-left px-3 py-2 text-xs text-blue-700 hover:bg-gray-50 border-t border-gray-100"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setOpenMenu(openMenu === 'group' ? null : 'group')}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
          >
            <Layers className="w-4 h-4" /> Group By
            {groupBy && <span className="text-xs text-blue-700">({GROUP_BY.find((g) => g.key === groupBy)?.label})</span>}
          </button>
          {openMenu === 'group' && (
            <div className="absolute left-0 top-full mt-1 z-30 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
              {GROUP_BY.map((g) => (
                <button
                  key={g.key || 'none'}
                  onClick={() => { setGroupBy(g.key); setOpenMenu(null); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${groupBy === g.key ? 'text-blue-700 font-medium' : 'text-gray-700'}`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          )}
        </div>

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
                  <th className="px-2 py-3 w-8" />
                  {COLUMNS.map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 text-xs whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 ? (
                  <tr><td colSpan={COLUMNS.length + 2} className="text-center py-10 text-gray-400">No purchase orders found</td></tr>
                ) : groups ? groups.map(([label, groupRows]) => (
                  <React.Fragment key={label}>
                    <tr
                      className="bg-gray-100 cursor-pointer"
                      onClick={() => setCollapsed((c) => ({ ...c, [label]: !c[label] }))}
                    >
                      <td colSpan={COLUMNS.length + 2} className="px-4 py-2 font-semibold text-gray-700 text-xs">
                        <span className="inline-flex items-center gap-1">
                          {collapsed[label] ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          {label} ({groupRows.length})
                        </span>
                      </td>
                    </tr>
                    {!collapsed[label] && groupRows.map(renderRow)}
                  </React.Fragment>
                )) : rows.map(renderRow)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrderList;
