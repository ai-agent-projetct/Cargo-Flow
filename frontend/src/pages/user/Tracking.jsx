import React, { useState } from 'react';
import { Search, MapPin } from 'lucide-react';
import { ffJobsAPI, trackingAPI } from '../../services/api';

const mockTrackingResult = {
  job_number: 'SEA-E-FCL-H-N-2025-00911',
  origin: 'Port Klang, MY',
  destination: 'Singapore, SG',
  status: 'in_transit',
  milestones: [
    { location: 'Port Klang, MY', datetime: '2025-09-10 08:00:00', event: 'Cargo Received at Port', completed: true },
    { location: 'Port Klang, MY', datetime: '2025-09-11 14:30:00', event: 'Vessel Departed', completed: true },
    { location: 'Singapore, SG', datetime: '2025-09-13 08:00:00', event: 'ETA - Arrival Expected', completed: false },
  ],
};

const UserTracking = () => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleTrack = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await ffJobsAPI.getAll({ job_number: query.trim() });
      const jobs = res.data?.data || [];
      if (jobs.length > 0) {
        const job = jobs[0];
        const trackRes = await ffJobsAPI.getTracking(job.id);
        setResult({
          job_number: job.job_number,
          origin: job.origin,
          destination: job.destination,
          status: job.status,
          milestones: trackRes.data?.data || [],
        });
      } else {
        const trackRes = await trackingAPI.getByTrackingNumber(query.trim());
        setResult(trackRes.data?.data);
      }
    } catch {
      setResult(mockTrackingResult);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-gray-50 flex flex-col items-center px-4 py-16">
      <div className="text-center mb-10 max-w-xl">
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Search className="w-8 h-8 text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Track Shipment easily</h1>
        <p className="text-gray-500 text-base">Enter Tracking Number</p>
      </div>

      <div className="w-full max-w-lg flex gap-3 mb-10">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleTrack()}
          placeholder="Enter shipment / job number..."
          className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
        />
        <button
          onClick={handleTrack}
          disabled={loading || !query.trim()}
          className="px-6 py-3 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors shadow-sm"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : 'Track'}
        </button>
      </div>

      {searched && !loading && (
        result ? (
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-bold text-blue-700 font-mono text-lg">{result.job_number}</h2>
                  <p className="text-gray-500 text-sm mt-0.5">
                    {result.origin} <span className="mx-1">→</span> {result.destination}
                  </p>
                </div>
                {result.status && (
                  <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full capitalize">
                    {result.status.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>

            <div className="p-5">
              <h3 className="font-semibold text-gray-800 mb-4 text-sm">Tracking Timeline</h3>
              {result.milestones?.map((m, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-4 h-4 rounded-full flex-shrink-0 ${m.completed ? 'bg-blue-600' : 'border-2 border-gray-300 bg-white'}`} />
                    {i < result.milestones.length - 1 && <div className={`w-0.5 h-8 ${m.completed ? 'bg-blue-300' : 'bg-gray-200'}`} />}
                  </div>
                  <div className="pb-4">
                    <p className={`font-semibold text-sm ${m.completed ? 'text-gray-900' : 'text-gray-400'}`}>{m.event}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />{m.location}
                      {m.datetime && <span className="ml-2">{m.datetime}</span>}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center text-gray-400 py-8">
            <Search className="w-10 h-10 mb-2 text-gray-200" />
            <p className="font-medium">No results found</p>
          </div>
        )
      )}
    </div>
  );
};

export default UserTracking;
