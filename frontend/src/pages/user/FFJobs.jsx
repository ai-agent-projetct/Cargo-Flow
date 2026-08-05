import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, MapPin, Calendar, User, Eye, Package } from 'lucide-react';
import { ffJobsAPI } from '../../services/api';
import {
  getTransportModeLabel, getCargoTypeLabel, getDirectionLabel, getFFJobStatusColor,
} from '../../utils/helpers';
import { PageLoader } from '../../common/LoadingSpinner';

const mockFFJobs = [
  {
    id: 1,
    jobNumber: 'SEA-E-FCL-H-N-2025-00911',
    customer: { companyName: 'Singapore Trade Co' },
    transportMode: 'SEA',
    direction: 'EXPORT',
    cargoType: 'FCL',
    origin: 'Port Klang, MY',
    destination: 'Singapore, SG',
    status: 'confirmed',
    etd: '2025-09-11T14:30:00Z',
    eta: '2025-09-13T08:00:00Z',
  },
  {
    id: 2,
    jobNumber: 'SEA-I-LCL-H-N-2025-00870',
    customer: { companyName: 'KL Imports Sdn Bhd' },
    transportMode: 'SEA',
    direction: 'IMPORT',
    cargoType: 'LCL',
    origin: 'Shanghai, CN',
    destination: 'Port Klang, MY',
    status: 'in_transit',
    etd: '2025-08-20T00:00:00Z',
    eta: '2025-08-28T00:00:00Z',
  },
  {
    id: 3,
    jobNumber: 'AIR-E-LSE-H-N-2025-00450',
    customer: { companyName: 'London Freight Ltd' },
    transportMode: 'AIR',
    direction: 'EXPORT',
    cargoType: 'LSE',
    origin: 'Penang, MY',
    destination: 'London, GB',
    status: 'delivered',
    etd: '2025-07-15T00:00:00Z',
    eta: '2025-07-16T00:00:00Z',
  },
];

const TABS = [
  { key: 'draft', label: 'Draft' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'in_transit', label: 'In-Transit' },
  { key: 'arrived', label: 'Arrived' },
  { key: 'delivered', label: 'Delivered' },
];

const modeColors = {
  SEA: 'bg-blue-100 text-blue-700',
  AIR: 'bg-purple-100 text-purple-700',
  ROAD: 'bg-orange-100 text-orange-700',
  RAIL: 'bg-green-100 text-green-700',
};

const FFJobCard = ({ job, onView }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
      {/* Job number */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-blue-700 font-mono">{job.jobNumber}</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {job.origin || '-'} <span className="mx-1">→</span> {job.destination || '-'}
          </p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getFFJobStatusColor(job.status)}`}>
          {job.status?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
        </span>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm mb-4">
        <div>
          <span className="text-gray-500">ETD: </span>
          <span className="font-medium text-gray-800">
            {job.etd ? new Date(job.etd).toLocaleDateString('en-GB') : '—'}
          </span>
        </div>
        <div>
          <span className="text-gray-500">ETA: </span>
          <span className="font-medium text-gray-800">
            {job.eta ? new Date(job.eta).toLocaleDateString('en-GB') : '—'}
          </span>
        </div>
        <div>
          <span className="text-gray-500">Customer: </span>
          <span className="font-medium text-gray-800">{job.customer?.companyName || '—'}</span>
        </div>
        <div>
          <span className="text-gray-500">Direction: </span>
          <span className="font-medium text-gray-800">
            {job.direction ? getDirectionLabel(job.direction) : '—'}
          </span>
        </div>
        <div>
          <span className="text-gray-500">Cargo Type: </span>
          <span className="font-medium text-gray-800">
            {job.cargoType ? getCargoTypeLabel(job.cargoType) : '—'}
          </span>
        </div>
        <div>
          <span className="text-gray-500">Transport Mode: </span>
          {job.transportMode && (
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ml-0.5 ${modeColors[job.transportMode] || 'bg-gray-100 text-gray-700'}`}>
              {getTransportModeLabel(job.transportMode)}
            </span>
          )}
        </div>
      </div>

      {/* View button */}
      <div className="flex justify-end pt-3 border-t border-gray-100">
        <button
          onClick={() => onView(job.id)}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
          View FF Job
        </button>
      </div>
    </div>
  );
};

const UserFFJobs = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('confirmed');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ffJobsAPI.getUserJobs({ status: activeTab });
      setJobs(res.data?.data || []);
    } catch {
      setJobs(mockFFJobs.filter((j) => j.status === activeTab));
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-xl font-bold text-gray-900">FF Jobs</h1>

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
            <Briefcase className="w-6 h-6" />
          </div>
          <p className="text-base font-medium">No FF jobs found</p>
          <p className="text-sm mt-1">No jobs in this status</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {jobs.map((job) => (
            <FFJobCard
              key={job.id}
              job={job}
              onView={(id) => navigate(`/user/ff-jobs/${id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default UserFFJobs;
