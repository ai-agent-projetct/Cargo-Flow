import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { exportCsv } from '../../utils/exportCsv';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Download, LayoutGrid, List, Building2, User, ChevronDown, ChevronRight } from 'lucide-react';
import { organizationsAPI } from '../../services/api';
import { PageLoader } from '../../common/LoadingSpinner';
import { partyTypeClass } from './organization/constants';

// Columns mirror the live CargoFlo Organizations list view.
const COLUMNS = ['Name', 'Phone', 'Email', 'Salesperson', 'Activities', 'City', 'State', 'Country', 'Identification Number', 'Tags', 'Company'];

// Search-view filters, matching the demo's Filters menu.
const FILTERS = [
  { key: '', label: 'All' },
  { key: 'person', label: 'Individuals' },
  { key: 'company', label: 'Companies' },
];

// Group By options. "Party Types" is the one the demo calls up when you look at
// clients — it buckets partners into Undefined / Customer / Shipper / Consignee.
const GROUP_BY = [
  { key: '', label: 'None' },
  { key: 'partyTypes', label: 'Party Types' },
  { key: 'country', label: 'Country' },
  { key: 'salesperson', label: 'Salesperson' },
  { key: 'company', label: 'Company' },
];

const UNDEFINED_GROUP = 'Undefined';

// The demo prefixes the display name with the customer code, e.g. "A-74: admin".
const displayName = (o) => (o.customerCode ? `${o.customerCode}: ${o.name}` : o.name);

const Row = ({ o, navigate }) => (
  <tr
    onClick={() => navigate(`/admin/organizations/${o.id}`)}
    className="hover:bg-gray-50 transition-colors cursor-pointer"
  >
    <td className="px-4 py-3 font-medium text-blue-700 whitespace-nowrap">{displayName(o)}</td>
    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{o.phone || '-'}</td>
    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{o.email || '-'}</td>
    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{o.salesperson || '-'}</td>
    <td className="px-4 py-3 text-gray-600 text-xs">{o.meetingCount || 0}</td>
    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{o.city || '-'}</td>
    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{o.state || '-'}</td>
    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{o.country || '-'}</td>
    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{o.identificationNumber || o.vat || '-'}</td>
    <td className="px-4 py-3 whitespace-nowrap">
      {(o.partyTypes || []).length === 0 ? <span className="text-gray-600 text-xs">-</span> : (
        <span className="flex flex-wrap gap-1">
          {o.partyTypes.map((p) => (
            <span key={p} className={`text-[10px] font-semibold px-2 py-0.5 rounded ${partyTypeClass(p)}`}>{p}</span>
          ))}
        </span>
      )}
    </td>
    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{o.company || '-'}</td>
  </tr>
);

// A partner can carry several party types, so it appears under each of them —
// and under "Undefined" when it has none, exactly like the demo.
const buildGroups = (rows, key) => {
  if (!key) return null;
  const buckets = new Map();
  const push = (name, row) => {
    if (!buckets.has(name)) buckets.set(name, []);
    buckets.get(name).push(row);
  };
  for (const row of rows) {
    if (key === 'partyTypes') {
      const types = row.partyTypes || [];
      if (types.length === 0) push(UNDEFINED_GROUP, row);
      else types.forEach((t) => push(t, row));
    } else {
      push(row[key] || UNDEFINED_GROUP, row);
    }
  }
  // Undefined sorts first, the rest alphabetically — same order as the demo.
  return [...buckets.entries()].sort(([a], [b]) => {
    if (a === UNDEFINED_GROUP) return -1;
    if (b === UNDEFINED_GROUP) return 1;
    return a.localeCompare(b);
  });
};

const AdminOrganizations = () => {
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [companyType, setCompanyType] = useState('');
  const [groupBy, setGroupBy] = useState('');
  const [collapsed, setCollapsed] = useState({});
  const [viewMode, setViewMode] = useState('list');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await organizationsAPI.getAll({ search, companyType, limit: 200 });
      setOrgs(res.data?.data || []);
    } catch {
      setOrgs([]);
    } finally {
      setLoading(false);
    }
  }, [search, companyType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const groups = buildGroups(orgs, groupBy);

  // Export the organizations currently listed.
  const handleExport = () => {
    if (exportCsv(orgs, null, 'organizations')) toast.success(`Exported ${orgs.length} rows`);
    else toast.error('Nothing to export');
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">Organizations</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
            {[{ key: 'kanban', Icon: LayoutGrid }, { key: 'list', Icon: List }].map(({ key, Icon }) => (
              <button
                key={key}
                onClick={() => setViewMode(key)}
                title={key === 'kanban' ? 'Kanban view' : 'List view'}
                className={`p-2 transition-colors ${viewMode === key ? 'bg-blue-700 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
          <button
            onClick={() => navigate('/admin/organizations/create')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Create
          </button>
          <button onClick={handleExport} className="p-2 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50" title="Export">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key || 'all'}
                onClick={() => setCompanyType(f.key)}
                className={`px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors ${
                  companyType === f.key ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-600">
            Group By
            <select
              value={groupBy}
              onChange={(e) => { setGroupBy(e.target.value); setCollapsed({}); }}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {GROUP_BY.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-72"
            />
          </div>
          <p className="text-xs text-gray-500">1-{orgs.length}/{orgs.length}</p>
        </div>
      </div>

      {loading ? <PageLoader /> : viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {orgs.map((o) => (
            <button
              key={o.id}
              onClick={() => navigate(`/admin/organizations/${o.id}`)}
              className="text-left bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0">
                  {o.companyType === 'company' ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-blue-700 text-sm truncate">{displayName(o)}</p>
                  {o.email && <p className="text-xs text-gray-500 truncate">{o.email}</p>}
                  {o.phone && <p className="text-xs text-gray-500">{o.phone}</p>}
                  {(o.city || o.country) && (
                    <p className="text-xs text-gray-400 mt-1">{[o.city, o.country].filter(Boolean).join(', ')}</p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {COLUMNS.map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 text-xs whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orgs.length === 0 ? (
                  <tr><td colSpan={COLUMNS.length} className="text-center py-10 text-gray-400">No organizations found</td></tr>
                ) : groups ? (
                  groups.map(([name, rows]) => (
                    <React.Fragment key={name}>
                      <tr
                        onClick={() => setCollapsed((p) => ({ ...p, [name]: !p[name] }))}
                        className="bg-slate-50 hover:bg-slate-100 cursor-pointer"
                      >
                        <td colSpan={COLUMNS.length} className="px-4 py-2">
                          <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            {collapsed[name] ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            {name}
                            <span className="text-slate-400 font-normal">({rows.length})</span>
                          </span>
                        </td>
                      </tr>
                      {!collapsed[name] && rows.map((o) => <Row key={`${name}-${o.id}`} o={o} navigate={navigate} />)}
                    </React.Fragment>
                  ))
                ) : orgs.map((o) => <Row key={o.id} o={o} navigate={navigate} />)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrganizations;
