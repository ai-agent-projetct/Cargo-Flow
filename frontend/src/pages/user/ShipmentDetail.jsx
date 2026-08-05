import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, Download, FileText, Ship } from 'lucide-react';
import { shipmentsAPI, trackingAPI } from '../../services/api';
import StatusBadge from '../../common/StatusBadge';
import { formatDate, formatDateTime, getModeIcon, capitalize } from '../../utils/helpers';
import { PageLoader } from '../../common/LoadingSpinner';

const mockShipment = {
  id: 1, shipmentNumber: 'CF-2024-0248', houseBL: 'MSKU1234567',
  mode: 'sea', carrier: { name: 'Maersk Line' }, vesselName: 'MV Maersk Edinburgh',
  status: 'in_transit', shipmentType: 'FCL', origin: 'Shanghai, China', destination: 'Rotterdam, Netherlands',
  originPort: { name: 'Shanghai', code: 'CNSHA' }, destinationPort: { name: 'Rotterdam', code: 'NLRTM' },
  estimatedDeparture: '2024-11-20T00:00:00Z', estimatedArrival: '2024-12-25T00:00:00Z',
  containerCount: 2, containerType: "40'HC",
  incoterms: 'FOB',
  documents: [
    { id: 1, name: 'Bill of Lading', type: 'BL', uploaded_at: '2024-11-20T10:00:00Z', size: '245 KB' },
    { id: 2, name: 'Commercial Invoice', type: 'Invoice', uploaded_at: '2024-11-18T14:00:00Z', size: '128 KB' },
  ],
};

const mockTracking = [
  { id: 1, title: 'Shipment Booked', location: 'Shanghai, China', description: 'Booking confirmed', timestamp: '2024-11-15T10:00:00Z', completed: true },
  { id: 2, title: 'Cargo Picked Up', location: 'Shanghai Port', description: 'Cargo delivered to terminal', timestamp: '2024-11-18T14:00:00Z', completed: true },
  { id: 3, title: 'Vessel Departed', location: 'Shanghai, China', description: 'Vessel departed from port', timestamp: '2024-11-20T06:00:00Z', completed: true },
  { id: 4, title: 'In Transit', location: 'Indian Ocean', description: 'Vessel en route to destination', timestamp: '2024-11-25T00:00:00Z', completed: true },
  { id: 5, title: 'Customs Clearance', location: 'Rotterdam, Netherlands', description: 'Pending customs inspection', timestamp: null, completed: false },
  { id: 6, title: 'Delivered', location: 'Rotterdam, Netherlands', description: 'Final delivery to consignee', timestamp: null, completed: false },
];

const UserShipmentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [shipment, setShipment] = useState(null);
  const [tracking, setTracking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tracking');

  useEffect(() => {
    const fetch = async () => {
      try {
        const [sRes, tRes] = await Promise.all([shipmentsAPI.getById(id), trackingAPI.getByShipment(id)]);
        setShipment(sRes.data.data);
        setTracking(tRes.data?.data || []);
      } catch {
        setShipment({ ...mockShipment, id });
        setTracking(mockTracking);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  if (loading) return <PageLoader />;
  if (!shipment) return <div className="text-center py-16 text-slate-400">Shipment not found</div>;

  const s = shipment;
  const completedCount = tracking.filter((t) => t.completed).length;
  const progress = tracking.length > 0 ? (completedCount / tracking.length) * 100 : 0;

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/user/shipments')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><ArrowLeft className="w-4 h-4" /></button>
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900">{s.shipmentNumber}</h2>
            <StatusBadge status={s.status} />
          </div>
          <p className="text-sm text-slate-400">{s.houseBL || s.masterBL || '-'} · {getModeIcon(s.mode)} {capitalize(s.mode)}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-slate-700">Shipment Progress</p>
          <span className="text-sm font-bold text-primary-600">{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-xs text-slate-400">{s.origin || '-'}</span>
          <span className="text-xs text-slate-400">{s.destination || '-'}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-slate-100 w-fit">
        {['tracking', 'details', 'documents'].map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${activeTab === tab ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'tracking' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-900 mb-6">Tracking Timeline</h3>
          <div className="relative">
            {tracking.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No tracking events yet</p>
            ) : tracking.map((event, idx) => {
              const isLast = idx === tracking.length - 1;
              const completed = event.completed ?? true;
              const isCurrent = !completed && (idx === 0 || tracking[idx - 1]?.completed);
              const title = event.title || (event.eventType ? event.eventType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : event.status);
              const timestamp = event.timestamp || event.eventDate;
              return (
                <div key={event.id} className="flex gap-4 pb-8 last:pb-0 relative">
                  {!isLast && (
                    <div className={`absolute left-4 top-8 bottom-0 w-0.5 ${completed ? 'bg-green-300' : 'bg-slate-200'}`} />
                  )}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${completed ? 'bg-green-500' : isCurrent ? 'bg-primary-600 ring-4 ring-primary-100' : 'bg-slate-200'}`}>
                    {completed ? <CheckCircle2 className="w-4 h-4 text-white" /> : <Circle className={`w-4 h-4 ${isCurrent ? 'text-white' : 'text-slate-400'}`} />}
                  </div>
                  <div className="flex-1 pt-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={`text-sm font-semibold ${completed ? 'text-slate-900' : isCurrent ? 'text-primary-700' : 'text-slate-400'}`}>{title}</p>
                        <p className="text-xs text-slate-500">{event.location || '-'}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{event.description}</p>
                      </div>
                      {timestamp && <span className="text-xs text-slate-400 whitespace-nowrap">{formatDateTime(timestamp)}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'details' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-900 mb-5 flex items-center gap-2">
            <Ship className="w-4 h-4 text-primary-600" /> Shipment Details
          </h3>
          <div className="grid grid-cols-2 gap-5">
            {[
              ['Origin', s.origin || '-'], ['Destination', s.destination || '-'],
              ['Origin Port', s.originPort ? `${s.originPort.name} (${s.originPort.code})` : '—'],
              ['Destination Port', s.destinationPort ? `${s.destinationPort.name} (${s.destinationPort.code})` : '—'],
              ['Carrier', s.carrier?.name || '—'], ['Vessel', s.vesselName || '—'],
              ['ETD', formatDate(s.estimatedDeparture)], ['ETA', formatDate(s.estimatedArrival)],
              ['Cargo Type', s.shipmentType || '—'], ['Incoterm', s.incoterms || '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-slate-500 mb-0.5">{label}</p>
                <p className="text-sm font-medium text-slate-800">{value}</p>
              </div>
            ))}
          </div>
          {s.containerCount > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-500 mb-2">Containers</p>
              <div className="flex gap-2">
                <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">
                  {s.containerCount}x {s.containerType || 'Container'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-900 mb-4">Documents</h3>
          {(s.documents || []).length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <FileText className="w-10 h-10 mx-auto mb-2 text-slate-200" />
              <p className="text-sm">No documents available</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(s.documents || []).map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{doc.name}</p>
                      <p className="text-xs text-slate-400">{doc.type} · {doc.size}</p>
                    </div>
                  </div>
                  <button className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-slate-600">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserShipmentDetail;
