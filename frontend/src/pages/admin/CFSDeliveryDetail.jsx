import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Save, X, ChevronLeft, ChevronRight, MoreHorizontal, Printer, Trash2, FileText,
} from 'lucide-react';
import { cfsDeliveriesAPI } from '../../services/api';
import { PageLoader } from '../../common/LoadingSpinner';
import toast from 'react-hot-toast';
import {
  TRANSPORT_MODES, CARGO_TYPES, PACK_UNITS, WEIGHT_UNITS, VOLUME_UNITS,
  SHIPMENT_TYPES, SERVICE_MODES, inputClass, labelClass,
} from './houseShipment/constants';

const STATUSES = ['created', 'delivered', 'cancelled'];
const STATUS_LABELS = { created: 'Created', delivered: 'Delivered', cancelled: 'Cancelled' };

const emptyForm = {
  cfsLocation: '',
  gateOutDate: '',
  direction: 'EXPORT',
  transportMode: 'SEA',
  cargoType: 'LCL',
  serviceMode: '',
  supplierRefNo: '',
  origin: '',
  destination: '',
  shipper: '',
  consignee: '',
  containerNumber: '',
  vehicleNumber: '',
  driverName: '',
  packages: '',
  packUnit: 'PKG',
  grossWeight: '',
  weightUnit: 'kg',
  volume: '',
  volumeUnit: 'm3',
  remarks: '',
  status: 'created',
};

const CFSDeliveryDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'create';

  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [recordList, setRecordList] = useState([]);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusModalValue, setStatusModalValue] = useState('created');

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (isNew) {
      setLoading(false);
      return;
    }
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const res = await cfsDeliveriesAPI.getById(id);
        const data = res.data?.data;
        setForm((f) => ({ ...emptyForm, ...data }));
      } catch {
        toast.error('Failed to load CFS delivery');
      } finally {
        setLoading(false);
      }
    };
    fetchRecord();
  }, [id, isNew]);

  useEffect(() => {
    cfsDeliveriesAPI.getAll({ limit: 1000, sortBy: 'createdAt', sortOrder: 'DESC' })
      .then((res) => setRecordList((res.data?.data || []).map((r) => r.id)))
      .catch(() => {});
  }, []);

  const recordIndex = recordList.indexOf(id);
  const recordTotal = recordList.length;

  const goToRecord = (direction) => {
    if (recordIndex === -1) return;
    const newIndex = recordIndex + direction;
    if (newIndex < 0 || newIndex >= recordTotal) return;
    navigate(`/admin/cfs-deliveries/${recordList[newIndex]}`);
  };

  const handleStatusChange = async (status) => {
    if (isNew) {
      setField('status', status);
      return;
    }
    try {
      await cfsDeliveriesAPI.updateStatus(id, status);
      setField('status', status);
      toast.success(`Status updated to ${STATUS_LABELS[status] || status}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const openStatusModal = () => {
    if (isNew) {
      toast('Save the delivery first', { icon: 'ℹ️' });
      return;
    }
    setStatusModalValue(form.status);
    setShowStatusModal(true);
  };

  const handleConfirmStatusChange = async () => {
    await handleStatusChange(statusModalValue);
    setShowStatusModal(false);
  };

  const handleDelete = async () => {
    setShowActionMenu(false);
    if (isNew) return;
    if (form.status !== 'created') {
      toast.error('Only deliveries in Created status can be deleted');
      return;
    }
    if (!window.confirm('Delete this CFS delivery? This cannot be undone.')) return;
    try {
      await cfsDeliveriesAPI.delete(id);
      toast.success('CFS Delivery deleted');
      navigate('/admin/cfs-deliveries');
    } catch {
      toast.error('Failed to delete delivery');
    }
  };

  const handlePrint = () => {
    setShowActionMenu(false);
    toast('Print – coming soon', { icon: '🖨️' });
  };

  const buildPayload = () => {
    const payload = { ...form };
    ['packages', 'grossWeight', 'volume'].forEach((k) => {
      if (payload[k] === '' || payload[k] === undefined) payload[k] = null;
      else payload[k] = parseFloat(payload[k]);
    });
    delete payload.id;
    delete payload.deliveryNumber;
    delete payload.createdAt;
    delete payload.updatedAt;
    delete payload.createdBy;
    delete payload.ffJobId;
    return payload;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = buildPayload();
      if (isNew) {
        const res = await cfsDeliveriesAPI.create(payload);
        const created = res.data?.data;
        toast.success('CFS Delivery created');
        navigate(`/admin/cfs-deliveries/${created.id}`);
      } else {
        await cfsDeliveriesAPI.update(id, payload);
        toast.success('CFS Delivery updated');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save CFS delivery');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => navigate('/admin/cfs-deliveries');

  if (loading) return <PageLoader />;

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto">
      {/* Top toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleDiscard}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg"
          >
            <X className="w-4 h-4" /> Discard
          </button>

          <div className="relative">
            <button
              onClick={() => setShowActionMenu((s) => !s)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg"
            >
              <MoreHorizontal className="w-4 h-4" /> Action
            </button>
            {showActionMenu && (
              <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-30">
                <button onClick={handlePrint} className="w-full flex items-center gap-2 text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  <Printer className="w-4 h-4" /> Print
                </button>
                <button onClick={handleDelete} className="w-full flex items-center gap-2 text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50">
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={openStatusModal}
          className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg"
        >
          Change Status
        </button>
      </div>

      {/* Breadcrumb + record nav */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-gray-500">
          CFS / Delivery Entry / {isNew ? 'New' : (form.deliveryNumber || 'New')}
        </div>
        {!isNew && recordIndex !== -1 && (
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <span>{recordIndex + 1} / {recordTotal}</span>
            <button
              onClick={() => goToRecord(-1)}
              disabled={recordIndex <= 0}
              className="p-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => goToRecord(1)}
              disabled={recordIndex >= recordTotal - 1}
              className="p-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Status stepper */}
      {!isNew && (
        <div className="flex items-center rounded-lg border border-gray-300 overflow-hidden bg-white overflow-x-auto">
          {STATUSES.map((s, idx) => (
            <div
              key={s}
              className={`px-3 py-2 text-xs font-semibold whitespace-nowrap ${
                form.status === s ? 'bg-blue-700 text-white' : 'text-gray-600'
              } ${idx > 0 ? 'border-l border-gray-300' : ''}`}
            >
              {STATUS_LABELS[s]}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">Delivery No</p>
          <p className="text-2xl font-bold text-gray-900 font-mono">{isNew ? 'New' : (form.deliveryNumber || 'New')}</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
          <FileText className="w-4 h-4" /> 0 Documents
        </div>
      </div>

      {/* General Details */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="font-bold text-gray-900">General Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Company</label>
              <input className={inputClass} value="SearatesERP (Dubai)" disabled />
            </div>
            <div>
              <label className={labelClass}>Shipment Type</label>
              <select className={inputClass} value={form.direction || 'EXPORT'} onChange={(e) => setField('direction', e.target.value)}>
                {SHIPMENT_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>CFS Location</label>
              <input className={inputClass} value={form.cfsLocation || ''} onChange={(e) => setField('cfsLocation', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Supplier Ref No.</label>
              <input className={inputClass} value={form.supplierRefNo || ''} onChange={(e) => setField('supplierRefNo', e.target.value)} />
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Delivery Date</label>
              <input type="date" className={inputClass} value={form.gateOutDate ? String(form.gateOutDate).slice(0, 10) : ''} onChange={(e) => setField('gateOutDate', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Transport Mode</label>
              <select className={inputClass} value={form.transportMode || ''} onChange={(e) => setField('transportMode', e.target.value)}>
                {TRANSPORT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Cargo Type</label>
              <select className={inputClass} value={form.cargoType || ''} onChange={(e) => setField('cargoType', e.target.value)}>
                {CARGO_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Service Mode</label>
              <select className={inputClass} value={form.serviceMode || ''} onChange={(e) => setField('serviceMode', e.target.value)}>
                <option value="">—</option>
                {SERVICE_MODES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Gate-Out / Vehicle Details */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="font-bold text-gray-900">Gate-Out Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Container Number</label>
              <input className={inputClass} value={form.containerNumber || ''} onChange={(e) => setField('containerNumber', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Truck Number</label>
              <input className={inputClass} value={form.vehicleNumber || ''} onChange={(e) => setField('vehicleNumber', e.target.value)} />
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Driver</label>
              <input className={inputClass} value={form.driverName || ''} onChange={(e) => setField('driverName', e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* Locations */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="font-bold text-gray-900">Locations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <label className={labelClass}>Origin</label>
            <input className={inputClass} value={form.origin || ''} onChange={(e) => setField('origin', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Destination</label>
            <input className={inputClass} value={form.destination || ''} onChange={(e) => setField('destination', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Shipper / Consignee */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="font-bold text-gray-900">Shipper &amp; Consignee</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <label className={labelClass}>Shipper</label>
            <input className={inputClass} value={form.shipper || ''} onChange={(e) => setField('shipper', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Consignee</label>
            <input className={inputClass} value={form.consignee || ''} onChange={(e) => setField('consignee', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Cargo Details */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="font-bold text-gray-900">Cargo Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className={labelClass}>Packages</label>
              <input type="number" className={inputClass} value={form.packages ?? ''} onChange={(e) => setField('packages', e.target.value)} />
            </div>
            <div className="w-24">
              <label className={labelClass}>Unit</label>
              <select className={inputClass} value={form.packUnit || ''} onChange={(e) => setField('packUnit', e.target.value)}>
                {PACK_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className={labelClass}>Gross Weight</label>
              <input type="number" className={inputClass} value={form.grossWeight ?? ''} onChange={(e) => setField('grossWeight', e.target.value)} />
            </div>
            <div className="w-20">
              <label className={labelClass}>Unit</label>
              <select className={inputClass} value={form.weightUnit || ''} onChange={(e) => setField('weightUnit', e.target.value)}>
                {WEIGHT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className={labelClass}>Volume</label>
              <input type="number" className={inputClass} value={form.volume ?? ''} onChange={(e) => setField('volume', e.target.value)} />
            </div>
            <div className="w-20">
              <label className={labelClass}>Unit</label>
              <select className={inputClass} value={form.volumeUnit || ''} onChange={(e) => setField('volumeUnit', e.target.value)}>
                {VOLUME_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Item Details / House Shipments */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="font-bold text-gray-900">Item Details</h2>
        {form.ffJobId ? (
          <button
            onClick={() => navigate(`/admin/house-shipments/${form.ffJobId}`)}
            className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-mono font-semibold rounded-lg hover:bg-blue-100"
          >
            View linked House Shipment
          </button>
        ) : (
          <p className="text-sm text-gray-400">No house shipments linked to this entry.</p>
        )}
      </div>

      {/* CFS Notes */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="font-bold text-gray-900">CFS Notes</h2>
        <textarea className={inputClass} rows={3} value={form.remarks || ''} onChange={(e) => setField('remarks', e.target.value)} />
      </div>

      {/* Activity log */}
      {!isNew && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
          <h2 className="font-bold text-gray-900">Activity</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center justify-between">
              <span>Delivery Entry created</span>
              <span className="text-gray-400">{form.createdAt ? new Date(form.createdAt).toLocaleString('en-GB') : '—'}</span>
            </div>
            {form.updatedAt && form.updatedAt !== form.createdAt && (
              <div className="flex items-center justify-between">
                <span>Last updated — status: {STATUS_LABELS[form.status] || form.status}</span>
                <span className="text-gray-400">{new Date(form.updatedAt).toLocaleString('en-GB')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Change Status modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Change Status</h3>
              <button onClick={() => setShowStatusModal(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={labelClass}>New Status</label>
                <select className={inputClass} value={statusModalValue} onChange={(e) => setStatusModalValue(e.target.value)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowStatusModal(false)} className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg">
                Cancel
              </button>
              <button onClick={handleConfirmStatusChange} className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg">
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CFSDeliveryDetail;
