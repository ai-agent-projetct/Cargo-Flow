import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Download, Filter, Layers, Star, SlidersHorizontal,
  ChevronLeft, ChevronRight, List, LayoutGrid, Building2, User, X, Mail,
} from 'lucide-react';
import { organizationsAPI } from '../../../services/api';
import { usePermissions } from '../../../context/PermissionContext';
import { PageLoader } from '../../../common/LoadingSpinner';
import { partyTypeClass } from '../organization/constants';

const PAGE_SIZE = 80;

// Accounting's Customers and Vendors menus are the same res.partner list with
// a party-type filter — the records are the Organizations built in an earlier
// wave, so a partner edited here is the same record everywhere else.
const COLUMNS = ['Name', 'Phone', 'Email', 'Salesperson', 'City', 'Country',
  'Identification Number', 'Tags', 'Company'];

const displayName = (o) => (o.customerCode ? `${o.customerCode}: ${o.name}` : o.name);

const initials = (name = '') => name.trim().slice(0, 2).toUpperCase();

const PartnerList = ({ kind = 'customer' }) => {
  const navigate = useNavigate();
  const { guard, can } = usePermissions();
  const vendor = kind === 'vendor';
  const partyType = vendor ? 'Vendor' : 'Customer';

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // The demo arrives with the "Customer Invoices" / "Vendor Bills" chip set.
  const [scope, setScope] = useState(true);
  const [companyType, setCompanyType] = useState('');
  const [view, setView] = useState('kanban');
  const [openMenu, setOpenMenu] = useState(null);
  const menuRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await guard(() => organizationsAPI.getAll({
      page, limit: PAGE_SIZE,
      search: search || undefined,
      companyType: companyType || undefined,
      partyType: scope ? partyType : undefined,
    }));
    if (res) {
      setRows(res.data.data || []);
      setMeta(res.data.pagination || { total: 0 });
    } else { setRows([]); }
    setLoading(false);
  }, [page, search, companyType, scope, partyType, guard]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, companyType, scope, kind]);

  useEffect(() => {
    const away = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const total = meta.total || 0;
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const open = (o) => navigate(`/admin/organizations/${o.id}`);

  return (
    <div className="px-6 pb-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h2 className="text-base font-semibold text-gray-900">{vendor ? 'Vendors' : 'Customers'}</h2>
        <div className="flex items-center gap-2">
          {scope && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 border border-blue-200 text-xs text-blue-800">
              {vendor ? 'Vendor Bills' : 'Customer Invoices'}
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
          {can('organization', 'create') && (
            <button onClick={() => navigate('/admin/organizations')}
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
                  {vendor ? 'Vendor Bills' : 'Customer Invoices'}
                </label>
                <p className="px-3 py-1 mt-1 text-[10px] font-bold uppercase tracking-wide text-gray-400 border-t border-gray-100">Type</p>
                {[['', 'All'], ['person', 'Individuals'], ['company', 'Companies']].map(([k, label]) => (
                  <button key={k || 'all'} onClick={() => { setCompanyType(k); setOpenMenu(null); }}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 ${companyType === k ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button className="flex items-center gap-1 hover:text-gray-900"><Layers className="w-3.5 h-3.5" /> Group By</button>
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
            {[['kanban', LayoutGrid], ['list', List]].map(([k, Icon]) => (
              <button key={k} onClick={() => setView(k)} title={k}
                className={`px-2 py-1 ${view === k ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? <PageLoader /> : view === 'kanban' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {rows.length === 0 ? (
            <p className="col-span-full text-center py-10 text-gray-400">No records found</p>
          ) : rows.map((o) => (
            <button key={o.id} onClick={() => open(o)}
              className="bg-white border border-gray-200 rounded-lg p-3 text-left hover:shadow-sm flex gap-3">
              <div className="w-11 h-11 rounded bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-500 text-xs font-semibold">
                {o.image ? <img src={o.image} alt="" className="w-11 h-11 rounded object-cover" />
                  : (o.companyType === 'person' ? <User className="w-5 h-5" /> : initials(o.name) || <Building2 className="w-5 h-5" />)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 text-sm truncate">{displayName(o)}</p>
                <p className="text-xs text-gray-500 truncate">
                  {[o.city, o.state, o.country].filter(Boolean).join(', ') || ' '}
                </p>
                {o.email && (
                  <p className="text-xs text-blue-700 truncate flex items-center gap-1 mt-0.5">
                    <Mail className="w-3 h-3 flex-shrink-0" /> {o.email}
                  </p>
                )}
                {/* Party types render as the demo's coloured dots. */}
                {(o.partyTypes || []).length > 0 && (
                  <span className="flex flex-wrap gap-1 mt-1.5">
                    {o.partyTypes.map((p) => (
                      <span key={p} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${partyTypeClass(p)}`}>{p}</span>
                    ))}
                  </span>
                )}
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
                  {COLUMNS.map((h) => (
                    <th key={h} className="text-left px-2 py-2 font-semibold text-gray-800 text-xs whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 ? (
                  <tr><td colSpan={COLUMNS.length + 1} className="text-center py-10 text-gray-400">No records found</td></tr>
                ) : rows.map((o) => (
                  <tr key={o.id} onClick={() => open(o)} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="rounded border-gray-300" />
                    </td>
                    <td className="px-2 py-1.5 text-xs font-medium text-blue-700 whitespace-nowrap">{displayName(o)}</td>
                    <td className="px-2 py-1.5 text-xs text-gray-600 whitespace-nowrap">{o.phone || '-'}</td>
                    <td className="px-2 py-1.5 text-xs text-gray-600 max-w-[14rem] truncate">{o.email || '-'}</td>
                    <td className="px-2 py-1.5 text-xs text-gray-600 whitespace-nowrap">{o.salesperson || '-'}</td>
                    <td className="px-2 py-1.5 text-xs text-gray-600 whitespace-nowrap">{o.city || '-'}</td>
                    <td className="px-2 py-1.5 text-xs text-gray-600 whitespace-nowrap">{o.country || '-'}</td>
                    <td className="px-2 py-1.5 text-xs text-gray-600 whitespace-nowrap">{o.identificationNumber || o.vat || '-'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {(o.partyTypes || []).length === 0 ? <span className="text-gray-600 text-xs">-</span> : (
                        <span className="flex flex-wrap gap-1">
                          {o.partyTypes.map((p) => (
                            <span key={p} className={`text-[10px] font-semibold px-2 py-0.5 rounded ${partyTypeClass(p)}`}>{p}</span>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-xs text-gray-600 whitespace-nowrap">{o.company || '-'}</td>
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

export default PartnerList;
