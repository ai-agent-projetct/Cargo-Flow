import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Download, Filter, Star, SlidersHorizontal,
  ChevronLeft, ChevronRight, List, LayoutGrid, X,
} from 'lucide-react';
import { accountingAPI } from '../../../services/api';
import { usePermissions } from '../../../context/PermissionContext';
import { PageLoader } from '../../../common/LoadingSpinner';

const PAGE_SIZE = 80;

const COLUMNS = ['Internal Reference', 'Name', 'Sales Price', 'Customer Taxes', 'Vendor Taxes'];

const Chip = ({ children }) => (
  <span className="inline-block px-2 py-0.5 rounded-full border border-gray-300 text-[11px] text-gray-700 mr-1">
    {children}
  </span>
);

const ProductList = ({ menu = 'products' }) => {
  const navigate = useNavigate();
  const { guard, can } = usePermissions();
  const vendor = menu === 'vendor-products';
  const base = vendor ? '/admin/accounting/vendors/products' : '/admin/accounting/customers/products';

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // The demo opens this list with the sold/purchased chip already applied.
  const [scope, setScope] = useState(true);
  const [view, setView] = useState('list');
  const [openMenu, setOpenMenu] = useState(null);
  const menuRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    const q = { menu, page, limit: PAGE_SIZE, search: search || undefined };
    // Dropping the chip widens the list to every product.
    if (!scope) { q.sold = '0'; q.purchased = '0'; }
    const res = await guard(() => accountingAPI.products(q));
    if (res) {
      setRows(res.data.data || []);
      setMeta(res.data.pagination || { total: 0 });
    } else { setRows([]); }
    setLoading(false);
  }, [menu, page, search, scope, guard]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, scope, menu]);

  useEffect(() => {
    const away = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const total = meta.total || 0;
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const dec = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="px-6 pb-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h2 className="text-base font-semibold text-gray-900">Products</h2>
        <div className="flex items-center gap-2">
          {scope && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 border border-blue-200 text-xs text-blue-800">
              {vendor ? 'Can be Purchased' : 'Can be Sold'}
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
          {can('product', 'create') && (
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
            </button>
            {openMenu === 'filter' && (
              <div className="absolute right-0 top-full mt-1 z-30 w-56 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                <label className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" className="rounded border-gray-300"
                    checked={scope} onChange={() => setScope((s) => !s)} />
                  {vendor ? 'Can be Purchased' : 'Can be Sold'}
                </label>
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
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {rows.map((r) => (
            <button key={r.id} onClick={() => navigate(`${base}/${r.id}`)}
              className="bg-white border border-gray-200 rounded-lg p-3 text-left hover:shadow-sm">
              <p className="font-semibold text-gray-900 text-sm truncate">{r.name}</p>
              <p className="text-xs text-gray-500">{r.internalReference}</p>
              <p className="text-sm text-gray-800 mt-2">{dec(r.salesPrice)} AED</p>
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
                    <th key={h} className={`px-2 py-2 font-semibold text-gray-800 text-xs whitespace-nowrap ${h === 'Sales Price' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 ? (
                  <tr><td colSpan={COLUMNS.length + 1} className="text-center py-10 text-gray-400">No records found</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.id} onClick={() => navigate(`${base}/${r.id}`)} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="rounded border-gray-300" />
                    </td>
                    <td className="px-2 py-1.5 text-xs text-gray-700 whitespace-nowrap">{r.internalReference}</td>
                    <td className="px-2 py-1.5 text-xs text-gray-900 font-medium max-w-[22rem] truncate" title={r.name}>{r.name}</td>
                    <td className="px-2 py-1.5 text-xs text-right text-gray-800 whitespace-nowrap">{dec(r.salesPrice)}</td>
                    <td className="px-2 py-1.5">{(r.customerTaxes || []).map((t) => <Chip key={t}>{t}</Chip>)}</td>
                    <td className="px-2 py-1.5">{(r.vendorTaxes || []).map((t) => <Chip key={t}>{t}</Chip>)}</td>
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

export default ProductList;
