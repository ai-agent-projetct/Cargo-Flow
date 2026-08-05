import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Briefcase, User, Calendar, Package } from 'lucide-react';
import { jobsAPI } from '../../services/api';
import StatusBadge from '../../common/StatusBadge';
import { formatDate, capitalize } from '../../utils/helpers';
import { PageLoader } from '../../common/LoadingSpinner';
import toast from 'react-hot-toast';

const mockJob = {
  id: 1,
  jobNumber: 'JOB-2024-0024',
  shipment: { shipmentNumber: 'CF-2024-0248' },
  type: 'pickup',
  title: 'Origin Services',
  customer: { companyName: 'Acme Corp' },
  status: 'in_progress',
  assignedUser: { name: 'John Smith' },
  dueDate: '2024-12-20T00:00:00Z',
  createdAt: '2024-12-10T10:00:00Z',
  description: 'Handle all origin port services including pickup, CFS, and documentation.',
};

const AdminJobDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const response = await jobsAPI.getById(id);
        setJob(response.data.data);
      } catch {
        setJob({ ...mockJob, id });
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  if (loading) return <PageLoader />;
  if (!job) return <div className="text-center py-16 text-slate-400">Job not found</div>;

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/jobs')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900">{job.jobNumber}</h2>
              <StatusBadge status={job.status} />
            </div>
            <p className="text-sm text-slate-400">{job.title || (job.type ? job.type.replace(/_/g, ' ') : '-')}</p>
          </div>
        </div>
        <button onClick={() => navigate(`/admin/jobs/${id}/edit`)} className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
          <Edit className="w-4 h-4" /> Edit
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-primary-600" /> Job Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Reference', job.jobNumber],
                ['Shipment', job.shipment?.shipmentNumber || '-'],
                ['Customer', job.customer?.companyName || '-'],
                ['Type', job.type ? job.type.replace(/_/g, ' ') : '-'],
                ['Assigned To', job.assignedUser?.name || '-'],
                ['Due Date', formatDate(job.dueDate)],
                ['Created', formatDate(job.createdAt)],
                ['Status', capitalize(job.status)],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-slate-500 mb-0.5">{label}</p>
                  <p className="text-sm font-medium text-slate-800">{value}</p>
                </div>
              ))}
            </div>
            {job.description && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-1">Description</p>
                <p className="text-sm text-slate-700">{job.description}</p>
              </div>
            )}
          </div>

        </div>

        <div className="space-y-5">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary-600" /> Timeline
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Created</span>
                <span className="font-medium">{formatDate(job.createdAt)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Due Date</span>
                <span className="font-medium text-orange-600">{formatDate(job.dueDate)}</span>
              </div>
              {job.completedAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Completed</span>
                  <span className="font-medium">{formatDate(job.completedAt)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminJobDetail;
