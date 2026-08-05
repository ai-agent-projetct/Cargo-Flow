import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, Eye, Calendar, User } from 'lucide-react';
import { serviceJobsAPI } from '../../services/api';
import { PageLoader } from '../../common/LoadingSpinner';

const mockServiceJobs = [
  {
    id: 1,
    jobNumber: 'SVC-2025-00001',
    requestDate: '2025-09-05T00:00:00Z',
    customer: { companyName: 'Singapore Trade Co' },
    serviceType: 'CUSTOMS_CLEARANCE',
    status: 'pending',
  },
  {
    id: 2,
    jobNumber: 'SVC-2025-00002',
    requestDate: '2025-08-10T00:00:00Z',
    customer: { companyName: 'Bangkok Distribution Co' },
    serviceType: 'WAREHOUSING',
    status: 'completed',
  },
];

const TABS = [
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

const ServiceJobCard = ({ job, onView }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between mb-3">
      <div>
        <h3 className="font-bold text-blue-700 font-mono text-base">{job.jobNumber}</h3>
        {job.serviceType && (
          <p className="text-sm text-gray-500 mt-0.5">{job.serviceType.replace(/_/g, ' ')}</p>
        )}
      </div>
      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColors[job.status] || 'bg-gray-100 text-gray-700'}`}>
        {job.status?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
      </span>
    </div>

    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm mb-4">
      <div>
        <span className="text-gray-500">Request Date: </span>
        <span className="font-medium text-gray-800">
          {job.requestDate ? new Date(job.requestDate).toLocaleDateString('en-GB') : '—'}
        </span>
      </div>
      <div>
        <span className="text-gray-500">Customer: </span>
        <span className="font-medium text-gray-800">{job.customer?.companyName || '—'}</span>
      </div>
      <div>
        <span className="text-gray-500">Origin: </span>
        <span className="font-medium text-gray-800">{job.origin || '—'}</span>
      </div>
      <div>
        <span className="text-gray-500">Destination: </span>
        <span className="font-medium text-gray-800">{job.destination || '—'}</span>
      </div>
    </div>

    <div className="flex justify-end pt-3 border-t border-gray-100">
      <button
        onClick={() => onView(job.id)}
        className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors"
      >
        <Eye className="w-3.5 h-3.5" />
        View Service Job
      </button>
    </div>
  </div>
);

const UserServiceJobs = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('pending');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await serviceJobsAPI.getUserJobs({ status: activeTab });
      setJobs(res.data?.data || []);
    } catch {
      setJobs(mockServiceJobs.filter((j) => j.status === activeTab));
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Service Jobs</h1>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-3">
            <Wrench className="w-6 h-6" />
          </div>
          <p className="text-base font-medium">No service jobs found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {jobs.map((job) => (
            <ServiceJobCard key={job.id} job={job} onView={(id) => navigate(`/user/service-jobs/${id}`)} />
          ))}
        </div>
      )}
    </div>
  );
};

export default UserServiceJobs;
