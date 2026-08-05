import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Search } from 'lucide-react';
import { serviceJobsAPI } from '../../services/api';
import { PageLoader } from '../../common/LoadingSpinner';

const mockJobs = [
  { id: 1, jobNumber: 'SVC-2025-00001', customer: { companyName: 'Acme Logistics' }, serviceType: 'CUSTOMS_CLEARANCE', requestDate: '2025-09-05', status: 'pending' },
  { id: 2, jobNumber: 'SVC-2025-00002', customer: { companyName: 'Johor Freight' }, serviceType: 'WAREHOUSING', requestDate: '2025-08-10', status: 'completed' },
  { id: 3, jobNumber: 'SVC-2025-00003', customer: { companyName: 'Penang Manufacturing' }, serviceType: 'DOCUMENTATION', requestDate: '2025-07-20', status: 'cancelled' },
];

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const statusColors = {
  pending: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const AdminServiceJobs = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = activeTab !== 'all' ? { status: activeTab } : {};
      if (search) params.search = search;
      const res = await serviceJobsAPI.getAll(params);
      setJobs(res.data?.data || []);
    } catch {
      const all = mockJobs;
      setJobs(activeTab === 'all' ? all : all.filter((j) => j.status === activeTab));
    } finally {
      setLoading(false);
    }
  }, [activeTab, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const displayJobs = jobs.filter((j) => {
    if (activeTab !== 'all' && j.status !== activeTab) return false;
    if (search) {
      const term = search.toLowerCase();
      const jobNumber = String(j.jobNumber || '').toLowerCase();
      const customerName = String(j.customer?.companyName || '').toLowerCase();
      if (!jobNumber.includes(term) && !customerName.includes(term)) return false;
    }
    return true;
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Service Jobs</h1>
        <button
          className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors"
          onClick={() => navigate('/admin/service-jobs/create')}
        >
          <Plus className="w-4 h-4" /> Create New
        </button>
      </div>

      {/* Search */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search job / customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              activeTab === tab.key ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? <PageLoader /> : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Job Number', 'Customer', 'Origin', 'Destination', 'Service Type', 'Request Date', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayJobs.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">No service jobs found</td></tr>
              ) : displayJobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-semibold text-blue-700 text-xs">{job.jobNumber}</td>
                  <td className="px-4 py-3 text-gray-700">{job.customer?.companyName || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{job.origin || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{job.destination || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{job.serviceType?.replace(/_/g, ' ') || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{job.requestDate ? new Date(job.requestDate).toLocaleDateString('en-GB') : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[job.status] || 'bg-gray-100 text-gray-600'}`}>
                      {job.status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => navigate(`/admin/service-jobs/${job.id}`)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminServiceJobs;
