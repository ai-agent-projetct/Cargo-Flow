import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Calendar, User, Package, Truck } from 'lucide-react';
import { ffJobsAPI } from '../../services/api';
import { getTransportModeLabel, getCargoTypeLabel, getDirectionLabel, getFFJobStatusColor } from '../../utils/helpers';
import { PageLoader } from '../../common/LoadingSpinner';

const mockJob = {
  id: 1,
  jobNumber: 'SEA-E-FCL-H-N-2025-00911',
  customer: { companyName: 'Singapore Trade Co' },
  transportMode: 'SEA',
  direction: 'EXPORT',
  cargoType: 'FCL',
  origin: 'Port Klang, MY',
  destination: 'Singapore, SG',
  status: 'confirmed',
  vesselName: 'EVER GIVEN',
  voyageNumber: 'EG2025-09',
  etd: '2025-09-11T14:30:00Z',
  eta: '2025-09-13T08:00:00Z',
  commodity: 'Electronics',
  grossWeight: '12000',
  volume: '25',
  events: [
    { id: 1, location: 'Port Klang, MY', eventDate: '2025-09-10T08:00:00Z', description: 'Cargo Received at Port' },
    { id: 2, location: 'Port Klang, MY', eventDate: '2025-09-11T14:30:00Z', description: 'Vessel Departed' },
    { id: 3, location: 'Singapore, SG', eventDate: '2025-09-13T08:00:00Z', description: 'ETA' },
  ],
};

const UserFFJobDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await ffJobsAPI.getById(id);
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
  if (!job) return <div className="p-6 text-gray-500">Job not found.</div>;

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      {/* Back */}
      <button
        onClick={() => navigate('/user/ff-jobs')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to FF Jobs
      </button>

      {/* Header card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-blue-700 font-mono">{job.jobNumber}</h1>
            <p className="text-gray-500 text-sm mt-1">
              {job.origin || '-'} <span className="mx-2">→</span> {job.destination || '-'}
            </p>
          </div>
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${getFFJobStatusColor(job.status)}`}>
            {job.status?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {[
            { label: 'Customer', value: job.customer?.companyName || '—' },
            { label: 'ETD', value: job.etd ? new Date(job.etd).toLocaleDateString('en-GB') : '—' },
            { label: 'ETA', value: job.eta ? new Date(job.eta).toLocaleDateString('en-GB') : '—' },
            { label: 'Transport Mode', value: job.transportMode ? getTransportModeLabel(job.transportMode) : '—' },
            { label: 'Direction', value: job.direction ? getDirectionLabel(job.direction) : '—' },
            { label: 'Cargo Type', value: job.cargoType ? getCargoTypeLabel(job.cargoType) : '—' },
            { label: 'Commodity', value: job.commodity || '—' },
            { label: 'Gross Weight', value: job.grossWeight ? `${job.grossWeight} KG` : '—' },
            { label: 'Volume', value: job.volume ? `${job.volume} CBM` : '—' },
            { label: 'Packages', value: job.packages ?? '—' },
            ...(job.vesselName ? [{ label: 'Vessel', value: job.vesselName }] : []),
            ...(job.voyageNumber ? [{ label: 'Voyage No.', value: job.voyageNumber }] : []),
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-gray-500 text-xs">{label}</p>
              <p className="font-medium text-gray-800 text-sm">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tracking Timeline */}
      {(job.events || job.tracking) && (job.events || job.tracking).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-bold text-gray-900 mb-4">Tracking Timeline</h2>
          <div className="space-y-4">
            {(job.events || job.tracking).map((t, i, arr) => (
              <div key={t.id || i} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full ${i === 0 ? 'bg-blue-600' : 'bg-gray-300'} flex-shrink-0`} />
                  {i < arr.length - 1 && <div className="w-0.5 bg-gray-200 flex-1 mt-1" />}
                </div>
                <div className="pb-4">
                  <p className="font-semibold text-gray-800 text-sm">{t.description || t.eventType || t.event}</p>
                  <p className="text-gray-500 text-xs flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />{t.location || '-'}
                    <span className="ml-2">{t.eventDate ? new Date(t.eventDate).toLocaleString('en-GB') : (t.datetime || '')}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserFFJobDetail;
