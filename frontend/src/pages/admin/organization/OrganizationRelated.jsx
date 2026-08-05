import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Search, Download } from 'lucide-react';
import { organizationsAPI } from '../../../services/api';
import { PageLoader } from '../../../common/LoadingSpinner';
import WorkflowRibbon from './WorkflowRibbon';
import { RELATED_COLUMNS } from './constants';

// One workflow-step drill-down: "Organizations / A-17: Atharva / Opportunity".
// The ribbon stays on the page so you can hop between steps without going back.
const fmt = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  if (Array.isArray(value)) return value.length;
  if (typeof value === 'object') return '-';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value).toLocaleDateString('en-GB');
  }
  return String(value);
};

const OrganizationRelated = () => {
  const { id, type } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [workflow, setWorkflow] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [related, wf] = await Promise.all([
        organizationsAPI.related(id, type),
        organizationsAPI.workflow(id).catch(() => null),
      ]);
      setData(related.data.data);
      setWorkflow(wf?.data?.data?.steps || []);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id, type]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageLoader />;
  if (!data) return <div className="p-6 text-gray-500">Nothing to show for this step.</div>;

  const columns = RELATED_COLUMNS[type] || [];
  const org = data.organization;
  const orgLabel = org.customerCode ? `${org.customerCode}: ${org.name}` : org.name;

  const rows = search
    ? data.rows.filter((r) => JSON.stringify(r).toLowerCase().includes(search.toLowerCase()))
    : data.rows;

  return (
    <div className="p-6 space-y-4">
      <div className="text-sm text-gray-500">
        <button onClick={() => navigate('/admin/organizations')} className="text-blue-700 hover:underline">Organizations</button>
        {' / '}
        <button onClick={() => navigate(`/admin/organizations/${id}`)} className="text-blue-700 hover:underline">{orgLabel}</button>
        {' / '}{data.step.label}
      </div>

      <WorkflowRibbon steps={workflow} organizationId={id} currentStep={type} />

      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <button className="p-2 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50" title="Export">
          <Download className="w-4 h-4" />
        </button>
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
          <p className="text-xs text-gray-500">1-{rows.length}/{rows.length}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {columns.map(([, label]) => (
                  <th key={label} className="text-left px-4 py-3 font-semibold text-gray-600 text-xs whitespace-nowrap">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 ? (
                <tr><td colSpan={Math.max(columns.length, 1)} className="text-center py-10 text-gray-400">
                  No {data.step.label.toLowerCase()} records for this organization
                </td></tr>
              ) : rows.map((r, i) => (
                <tr key={r.id || i} className="hover:bg-gray-50">
                  {columns.map(([key], ci) => (
                    <td key={key} className={`px-4 py-3 whitespace-nowrap ${ci === 0 ? 'font-medium text-blue-700' : 'text-gray-600 text-xs'}`}>
                      {fmt(r[key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OrganizationRelated;
