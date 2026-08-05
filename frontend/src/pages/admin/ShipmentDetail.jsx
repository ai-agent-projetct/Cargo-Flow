import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Package, Ship, FileText,
  CheckCircle2, Circle, Upload, Download, User, Edit,
  AlertCircle,
} from 'lucide-react';
import { shipmentsAPI, trackingAPI } from '../../services/api';
import StatusBadge from '../../common/StatusBadge';
import Modal from '../../common/Modal';
import { formatDate, formatDateTime, formatCurrency, getModeIcon, capitalize } from '../../utils/helpers';
import { PageLoader } from '../../common/LoadingSpinner';
import toast from 'react-hot-toast';

const mockShipment = {
  id: 1,
  shipmentNumber: 'CF-2024-0248',
  houseBL: 'MSKU1234567',
  customer: { companyName: 'Acme Corp', email: 'shipping@acmecorp.com' },
  mode: 'sea',
  carrier: { name: 'Maersk Line' },
  vesselName: 'MV MAERSK EDINBURGH',
  voyageNumber: 'VOY-2024-448',
  status: 'in_transit',
  shipmentType: 'FCL',
  origin: 'Shanghai, China',
  destination: 'Rotterdam, Netherlands',
  originPort: { name: 'Shanghai', code: 'CNSHA' },
  destinationPort: { name: 'Rotterdam', code: 'NLRTM' },
  estimatedDeparture: '2024-11-20T00:00:00Z',
  estimatedArrival: '2024-12-25T00:00:00Z',
  actualDeparture: '2024-11-20T06:00:00Z',
  containerCount: 2,
  containerType: "40'HC",
  incoterms: 'FOB',
  declaredValue: 4850,
  currency: 'USD',
  notes: 'Temperature-controlled cargo. Handle with care.',
  createdAt: '2024-11-15T10:00:00Z',
  documents: [
    { id: 1, name: 'Bill of Lading', type: 'BL', uploaded_at: '2024-11-20T10:00:00Z', size: '245 KB' },
    { id: 2, name: 'Commercial Invoice', type: 'Invoice', uploaded_at: '2024-11-18T14:00:00Z', size: '128 KB' },
    { id: 3, name: 'Packing List', type: 'PL', uploaded_at: '2024-11-18T14:30:00Z', size: '98 KB' },
  ],
};

const mockTracking = [
  { id: 1, status: 'booked', title: 'Shipment Booked', location: 'Shanghai, China', description: 'Booking confirmed with Maersk Line', timestamp: '2024-11-15T10:00:00Z', completed: true },
  { id: 2, status: 'at_origin', title: 'Cargo Received at Origin', location: 'Shanghai Port, China', description: 'Cargo picked up and delivered to port terminal', timestamp: '2024-11-18T14:00:00Z', completed: true },
  { id: 3, status: 'in_transit', title: 'Vessel Departed', location: 'Shanghai, China', description: 'MV Maersk Edinburgh departed. Voyage VOY-2024-448', timestamp: '2024-11-20T06:00:00Z', completed: true },
  { id: 4, status: 'customs', title: 'Customs Clearance', location: 'Rotterdam, Netherlands', description: 'Pending customs inspection', timestamp: null, completed: false, current: false },
  { id: 5, status: 'at_destination', title: 'Arrived at Destination', location: 'Rotterdam Port, Netherlands', description: 'Cargo at destination port', timestamp: null, completed: false },
  { id: 6, status: 'delivered', title: 'Delivered', location: 'Rotterdam, Netherlands', description: 'Final delivery to consignee', timestamp: null, completed: false },
];

const AdminShipmentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [shipment, setShipment] = useState(null);
  const [tracking, setTracking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusModal, setStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [updating, setUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const fetch = async () => {
      try {
        const [sRes, tRes] = await Promise.all([
          shipmentsAPI.getById(id),
          trackingAPI.getByShipment(id),
        ]);
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

  const handleUpdateStatus = async () => {
    if (!newStatus) { toast.error('Select a status'); return; }
    setUpdating(true);
    try {
      await shipmentsAPI.updateStatus(id, { status: newStatus, note: statusNote });
      toast.success('Status updated');
      setShipment((s) => ({ ...s, status: newStatus }));
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdating(false);
      setStatusModal(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!shipment) return <div className="text-center py-16 text-slate-400">Shipment not found</div>;

  const s = shipment;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/shipments')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900">{s.shipmentNumber}</h2>
              <StatusBadge status={s.status} />
            </div>
            <p className="text-sm text-slate-400 mt-0.5">{s.houseBL || s.masterBL || 'No BL'} · {getModeIcon(s.mode)} {capitalize(s.mode)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setStatusModal(true)} className="flex items-center gap-2 px-4 py-2 border border-primary-200 text-primary-600 rounded-lg text-sm hover:bg-primary-50 font-medium">
            <Edit className="w-4 h-4" /> Update Status
          </button>
          <button onClick={() => navigate(`/admin/shipments/${id}/edit`)} className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
            <Edit className="w-4 h-4" /> Edit
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-slate-100 w-fit">
        {['overview', 'tracking', 'documents'].map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${activeTab === tab ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            {/* Route */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Ship className="w-4 h-4 text-primary-600" /> Shipment Details
              </h3>
              <div className="grid grid-cols-2 gap-5">
                {[
                  ['Origin', `${s.origin || '-'}${s.originPort ? ` (${s.originPort.name} - ${s.originPort.code})` : ''}`],
                  ['Destination', `${s.destination || '-'}${s.destinationPort ? ` (${s.destinationPort.name} - ${s.destinationPort.code})` : ''}`],
                  ['Carrier', s.carrier?.name || '—'],
                  ['Vessel', s.vesselName || '—'],
                  ['Voyage', s.voyageNumber || '—'],
                  ['Incoterm', s.incoterms || '—'],
                  ['ETD', formatDate(s.estimatedDeparture)],
                  ['ETA', formatDate(s.estimatedArrival)],
                  ['ATD', s.actualDeparture ? formatDate(s.actualDeparture) : '—'],
                  ['Cargo Type', s.shipmentType || '—'],
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
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">
                      {s.containerCount}x {s.containerType || 'Container'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right */}
          <div className="space-y-5">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <User className="w-4 h-4 text-primary-600" /> Customer
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-500">Company</p>
                  <p className="text-sm font-semibold text-slate-900">{s.customer?.companyName || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Email</p>
                  <p className="text-sm text-slate-700">{s.customer?.email || '—'}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
              <h3 className="font-semibold text-slate-900 mb-4">Financials</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Shipment Value</span>
                  <span className="font-bold text-primary-700">{formatCurrency(s.declaredValue, s.currency)}</span>
                </div>
              </div>
            </div>
            {s.notes && (
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-700">Notes</span>
                </div>
                <p className="text-xs text-amber-700">{s.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'tracking' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-900 mb-6">Tracking Timeline</h3>
          <div className="relative">
            {tracking.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No tracking events yet</p>
            ) : tracking.map((event, idx) => {
              const isLast = idx === tracking.length - 1;
              const completed = event.completed ?? true;
              const isCurrent = event.current || false;
              const title = event.title || (event.eventType ? event.eventType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : event.status);
              const timestamp = event.timestamp || event.eventDate;
              return (
                <div key={event.id} className="flex gap-4 pb-8 last:pb-0 relative">
                  {!isLast && (
                    <div className={`absolute left-4 top-8 bottom-0 w-0.5 ${completed ? 'bg-green-300' : 'bg-slate-200'}`} />
                  )}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                    completed ? 'bg-green-500' : isCurrent ? 'bg-primary-600 ring-4 ring-primary-100' : 'bg-slate-200'
                  }`}>
                    {completed ? <CheckCircle2 className="w-4 h-4 text-white" /> : <Circle className={`w-4 h-4 ${isCurrent ? 'text-white' : 'text-slate-400'}`} />}
                  </div>
                  <div className="flex-1 pt-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={`text-sm font-semibold ${completed ? 'text-slate-900' : isCurrent ? 'text-primary-700' : 'text-slate-400'}`}>
                          {title}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{event.location || '-'}</p>
                        <p className="text-xs text-slate-500 mt-1">{event.description}</p>
                      </div>
                      {timestamp && (
                        <span className="text-xs text-slate-400 whitespace-nowrap">{formatDateTime(timestamp)}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-slate-900">Documents</h3>
            <button className="flex items-center gap-2 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium">
              <Upload className="w-4 h-4" /> Upload
            </button>
          </div>
          {(s.documents || []).length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <FileText className="w-10 h-10 mx-auto mb-2 text-slate-200" />
              <p className="text-sm">No documents uploaded</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(s.documents || []).map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-4.5 h-4.5 text-blue-600" size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{doc.name}</p>
                      <p className="text-xs text-slate-400">{doc.type} · {doc.size} · {formatDate(doc.uploaded_at)}</p>
                    </div>
                  </div>
                  <button className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Status update modal */}
      <Modal isOpen={statusModal} onClose={() => setStatusModal(false)} title="Update Shipment Status" size="sm"
        footer={
          <>
            <button onClick={() => setStatusModal(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            <button onClick={handleUpdateStatus} disabled={updating} className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium">
              {updating ? 'Updating...' : 'Update Status'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">New Status</label>
            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="input-field w-full">
              <option value="">Select status...</option>
              <option value="booking_confirmed">Booking Confirmed</option>
              <option value="cargo_received">Cargo Received</option>
              <option value="customs_clearance">Customs Clearance</option>
              <option value="loaded">Loaded</option>
              <option value="departed">Departed</option>
              <option value="in_transit">In Transit</option>
              <option value="arrived">Arrived</option>
              <option value="delivered">Delivered</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Note (optional)</label>
            <textarea value={statusNote} onChange={(e) => setStatusNote(e.target.value)} rows={2}
              className="input-field w-full resize-none" placeholder="Add a note..." />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminShipmentDetail;
