import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { serviceJobsAPI } from '../../services/api';
import { PageLoader } from '../../common/LoadingSpinner';

const mockJob = {
  id: 1,
  jobNumber: 'SVC-2025-00001',
  requestDate: '2025-09-05T00:00:00Z',
  customer: { companyName: 'Singapore Trade Co' },
  serviceType: 'CUSTOMS_CLEARANCE',
  status: 'pending',
  remarks: 'Customs clearance for FCL shipment arriving Port Klang',
  origin: 'Port Klang, MY',
  destination: 'Singapore, SG',
  createdAt: '2025-09-01T00:00:00Z',
};

const statusColors = {
  pending: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const UserServiceJobDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await serviceJobsAPI.getById(id);
        setJob(res.data.data);
      } catch {
        setJob({ ...mockJob, id: parseInt(id) });
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  if (loading) return <PageLoader />;
  if (!job) return <div className="p-6 text-gray-500">Service job not found.</div>;

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <button
        onClick={() => navigate('/user/service-jobs')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Service Jobs
      </button>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-blue-700 font-mono">{job.jobNumber}</h1>
            <p className="text-gray-500 text-sm mt-0.5">{job.serviceType?.replace(/_/g, ' ') || '-'}</p>
          </div>
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${statusColors[job.status] || 'bg-gray-100 text-gray-700'}`}>
            {job.status?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            { label: 'Request Date', value: job.requestDate ? new Date(job.requestDate).toLocaleDateString('en-GB') : '—' },
            { label: 'Completion Date', value: job.completionDate ? new Date(job.completionDate).toLocaleDateString('en-GB') : '—' },
            { label: 'Customer', value: job.customer?.companyName || '—' },
            { label: 'Origin', value: job.origin || '—' },
            { label: 'Destination', value: job.destination || '—' },
            { label: 'Total Amount', value: job.totalAmount != null ? `${job.currency || ''} ${job.totalAmount}`.trim() : '—' },
            { label: 'Created', value: job.createdAt ? new Date(job.createdAt).toLocaleDateString('en-GB') : '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-gray-500 text-xs">{label}</p>
              <p className="font-medium text-gray-800">{value}</p>
            </div>
          ))}
        </div>

        {job.remarks && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-gray-500 text-xs mb-1">Remarks</p>
            <p className="text-gray-800 text-sm">{job.remarks}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserServiceJobDetail;
