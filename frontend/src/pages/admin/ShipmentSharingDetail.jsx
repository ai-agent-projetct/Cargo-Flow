import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, X, ChevronDown, ArrowRightLeft } from 'lucide-react';
import { shipmentSharingsAPI } from '../../services/api';
import { PageLoader } from '../../common/LoadingSpinner';
import toast from 'react-hot-toast';
import { TRANSPORT_MODES, CARGO_TYPES, inputClass, labelClass } from './houseShipment/constants';

const DIRECTIONS = [
  { value: 'import_to_export', label: 'Import → Export' },
  { value: 'export_to_import', label: 'Export → Import' },
];

const SHIPMENT_TYPES = [
  { value: 'EXP', label: 'Export' },
  { value: 'IMP', label: 'Import' },
];

const STATUSES = ['created', 'booked', 'confirmed', 'nomination_generated', 'in_transit', 'arrived', 'completed', 'cancelled'];

const emptyForm = {
  direction: 'import_to_export',
  company: '',
  shipmentType: 'EXP',
  transportMode: 'SEA',
  cargoType: 'FCL',
  bookingId: '',
  shipmentDate: '',
  shipper: '',
  consignee: '',
  originPort: '',
  destinationPort: '',
  remarks: '',
  status: 'created',
  converted: false,
};

const ShipmentSharingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'create';

  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (isNew) {
      setLoading(false);
      return;
    }
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const res = await shipmentSharingsAPI.getById(id);
        setForm((f) => ({ ...emptyForm, ...res.data?.data }));
      } catch {
        toast.error('Failed to load shipment sharing');
      } finally {
        setLoading(false);
      }
    };
    fetchRecord();
  }, [id, isNew]);

  const handleStatusChange = async (status) => {
    if (isNew) {
      setField('status', status);
      return;
    }
    try {
      await shipmentSharingsAPI.updateStatus(id, status);
      setField('status', status);
      if (status === 'nomination_generated') setField('converted', true);
      toast.success(`Status updated to ${status.replace('_', ' ')}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update status');
    }
  };

  const handleConvert = async () => {
    setConverting(true);
    try {
      await shipmentSharingsAPI.convert(id);
      setForm((f) => ({ ...f, converted: true, status: 'nomination_generated' }));
      toast.success('Nomination generated and shipment converted');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to convert');
    } finally {
      setConverting(false);
    }
  };

  const buildPayload = () => {
    const payload = { ...form };
    delete payload.id;
    delete payload.sharingNumber;
    delete payload.createdAt;
    delete payload.updatedAt;
    delete payload.createdBy;
    return payload;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = buildPayload();
      if (isNew) {
        const res = await shipmentSharingsAPI.create(payload);
        const created = res.data?.data;
        toast.success('Shipment sharing created');
        navigate(`/admin/shipment-sharings/${created.id}`);
      } else {
        await shipmentSharingsAPI.update(id, payload);
        toast.success('Shipment sharing updated');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save shipment sharing');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => navigate('/admin/shipment-sharings');

  if (loading) return <PageLoader />;

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
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
          {!isNew && !form.converted && (
            <button
              onClick={handleConvert}
              disabled={converting}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
            >
              <ArrowRightLeft className="w-4 h-4" /> {converting ? 'Converting...' : 'Convert / Generate Nomination'}
            </button>
          )}
        </div>
        <div className="relative">
          <select
            value={form.status || 'created'}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="appearance-none text-sm font-semibold pl-3 pr-8 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="text-sm text-gray-500">
        Shipment Sharing / {isNew ? 'New' : (form.sharingNumber || 'New')}
      </div>

      <div>
        <p className="text-xs text-gray-500">Sharing No</p>
        <p className="text-2xl font-bold text-gray-900 font-mono">{isNew ? 'New' : (form.sharingNumber || 'New')}</p>
        {form.converted && (
          <span className="inline-block mt-1 bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded-full">
            Converted
          </span>
        )}
      </div>

      {/* General Details */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="font-bold text-gray-900">General Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Direction</label>
              <select className={inputClass} value={form.direction || ''} onChange={(e) => setField('direction', e.target.value)}>
                {DIRECTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Company</label>
              <input className={inputClass} value={form.company || ''} onChange={(e) => setField('company', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Transport Mode</label>
              <select className={inputClass} value={form.transportMode || ''} onChange={(e) => setField('transportMode', e.target.value)}>
                {TRANSPORT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Shipment Type</label>
              <select className={inputClass} value={form.shipmentType || ''} onChange={(e) => setField('shipmentType', e.target.value)}>
                {SHIPMENT_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Cargo Type</label>
              <select className={inputClass} value={form.cargoType || ''} onChange={(e) => setField('cargoType', e.target.value)}>
                {CARGO_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Booking ID</label>
              <input className={inputClass} value={form.bookingId || ''} onChange={(e) => setField('bookingId', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Shipment Date</label>
              <input type="date" className={inputClass} value={form.shipmentDate || ''} onChange={(e) => setField('shipmentDate', e.target.value)} />
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Shipper</label>
              <input className={inputClass} value={form.shipper || ''} onChange={(e) => setField('shipper', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Consignee</label>
              <input className={inputClass} value={form.consignee || ''} onChange={(e) => setField('consignee', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Origin Port</label>
              <input className={inputClass} value={form.originPort || ''} onChange={(e) => setField('originPort', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Destination Port</label>
              <input className={inputClass} value={form.destinationPort || ''} onChange={(e) => setField('destinationPort', e.target.value)} />
            </div>
          </div>
        </div>
        <div>
          <label className={labelClass}>Remarks</label>
          <textarea className={inputClass} rows={3} value={form.remarks || ''} onChange={(e) => setField('remarks', e.target.value)} />
        </div>
      </div>
    </div>
  );
};

export default ShipmentSharingDetail;
