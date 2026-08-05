import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, X, ChevronDown, Plus, Trash2, Package, Scale, Home, Box, Upload, Link2 } from 'lucide-react';
import { consolidationsAPI, ffJobsAPI } from '../../services/api';
import { PageLoader } from '../../common/LoadingSpinner';
import toast from 'react-hot-toast';
import {
  TRANSPORT_MODES, CARGO_TYPES, inputClass, labelClass,
} from './houseShipment/constants';

const DIRECTIONS = [
  { value: 'EXPORT', label: 'Export' },
  { value: 'IMPORT', label: 'Import' },
  { value: 'LOCAL', label: 'Local' },
];

const STATUSES = ['draft', 'confirmed', 'in_transit', 'arrived', 'completed', 'cancelled'];

// The live demo's status bar runs Created > Cancelled > Completed.
const STATUS_STEPS = [
  { key: 'draft', label: 'Created' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'completed', label: 'Completed' },
];

const SHIPMENT_TYPES = ['EXP', 'IMP'];
const SERVICE_MODES = ['', 'CY/CY', 'CY/CFS', 'CFS/CY', 'CFS/CFS', 'DOOR/DOOR'];
const CONSOLIDATION_TYPES = ['', 'Direct', 'Co-Load', 'Buyer Consol', 'Agent Consol'];
const INCOTERMS = ['', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'DAP', 'DDP', 'EXW'];

const emptyForm = {
  transportMode: 'SEA',
  direction: 'EXPORT',
  cargoType: 'FCL',
  shipmentType: 'EXP',
  serviceMode: '',
  consolidationDate: '',
  consolidationType: '',
  tags: '',
  sailingSchedule: '',
  company: '',
  agent: '',
  coLoader: '',
  origin: '',
  destination: '',
  por: '',
  pod: '',
  pol: '',
  fpd: '',
  carrier: '',
  shippingLine: '',
  vesselName: '',
  voyageNumber: '',
  carrierRefNumber: '',
  incoterm: '',
  mblNumber: '',
  etd: '',
  eta: '',
  atd: '',
  packs: 0,
  totalVolume: 0,
  totalWeight: 0,
  containerNumbers: [],
  houseShipmentIds: [],
  packageLines: [],
  commodityLines: [],
  remarks: '',
  status: 'draft',
};

const PACKAGE_COLUMNS = ['ID', 'House Shipment', 'Container Type', 'Container #', 'Package Type', 'Is HAZ', 'HAZ Class', 'Stuffing Date', 'Seal Number', 'Customs Seal No', 'Cut Off Date'];
const COMMODITY_COLUMNS = ['House Shipment', 'No Of Packages', 'Weight', 'Weight UOM', 'Package Type', 'Length', 'Width', 'Height', 'Dimension UOM', 'Volume', 'Volume UOM', 'Color'];

const ConsolidationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'create';

  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [houseShipments, setHouseShipments] = useState([]);
  const [newContainer, setNewContainer] = useState('');

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    ffJobsAPI.getAll({ limit: 200 }).then((res) => setHouseShipments(res.data?.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (isNew) {
      setLoading(false);
      return;
    }
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const res = await consolidationsAPI.getById(id);
        const data = res.data?.data;
        setForm((f) => ({
          ...emptyForm,
          ...data,
          containerNumbers: data.containerNumbers || [],
          houseShipmentIds: data.houseShipmentIds || [],
        }));
      } catch {
        toast.error('Failed to load consolidation');
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
      await consolidationsAPI.updateStatus(id, status);
      setField('status', status);
      toast.success(`Status updated to ${status.replace('_', ' ')}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update status');
    }
  };

  const toggleHouseShipment = (ffJobId) => {
    setForm((f) => {
      const exists = f.houseShipmentIds.includes(ffJobId);
      return {
        ...f,
        houseShipmentIds: exists
          ? f.houseShipmentIds.filter((x) => x !== ffJobId)
          : [...f.houseShipmentIds, ffJobId],
      };
    });
  };

  const addContainer = () => {
    if (!newContainer.trim()) return;
    setForm((f) => ({ ...f, containerNumbers: [...f.containerNumbers, newContainer.trim()] }));
    setNewContainer('');
  };

  const removeContainer = (idx) => {
    setForm((f) => ({ ...f, containerNumbers: f.containerNumbers.filter((_, i) => i !== idx) }));
  };

  const buildPayload = () => {
    const payload = { ...form };
    delete payload.id;
    delete payload.consolidationNumber;
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
        const res = await consolidationsAPI.create(payload);
        const created = res.data?.data;
        toast.success('Consolidation created');
        navigate(`/admin/consolidations/${created.id}`);
      } else {
        await consolidationsAPI.update(id, payload);
        toast.success('Consolidation updated');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save consolidation');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => navigate('/admin/consolidations');

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
        </div>
        <div className="relative">
          <select
            value={form.status || 'draft'}
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
        Export Console Generation / {isNew ? 'New' : (form.consolidationNumber || 'New')}
      </div>

      {/* Action bar + status stepper */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => toast('Select house shipments to attach')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded"
          >
            <Link2 className="w-3.5 h-3.5" /> Attach Houses
          </button>
          <button
            onClick={() => toast('Change the status from the selector above')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded"
          >
            Change Status
          </button>
          <button
            onClick={() => toast('3D container view coming soon')}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded"
          >
            <Box className="w-3.5 h-3.5" /> View 3D Container
          </button>
        </div>
        <div className="flex items-center">
          {STATUS_STEPS.map((s, i) => (
            <span
              key={s.key}
              className={`px-4 py-1.5 text-xs font-semibold border border-gray-200 ${
                form.status === s.key ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-500'
              } ${i === 0 ? 'rounded-l' : ''} ${i === STATUS_STEPS.length - 1 ? 'rounded-r' : ''}`}
            >
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Summary strip */}
      <div className="bg-white border border-gray-200 rounded-xl px-6 py-4 flex flex-wrap items-center justify-end gap-8">
        {[
          { Icon: Package, value: form.packs || 0, label: 'Packs' },
          { Icon: Scale, value: `${Number(form.totalVolume || 0).toFixed(2)}m³`, label: 'Total Volume' },
          { Icon: Scale, value: `${Number(form.totalWeight || 0).toFixed(2)}kg`, label: 'Total Weight' },
          { Icon: Home, value: (form.houseShipmentIds || []).length, label: 'Houses' },
        ].map(({ Icon, value, label }) => (
          <div key={label} className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm font-semibold text-blue-700 leading-none">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Header fields */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-500">Consolidation Job No.</p>
            <p className="text-2xl font-bold text-gray-900 font-mono">{isNew ? 'New' : (form.consolidationNumber || 'New')}</p>
          </div>
          <div>
            <label className={labelClass}>Company</label>
            <input className={inputClass} value={form.company || ''} onChange={(e) => setField('company', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Consolidation Type</label>
            <select className={inputClass} value={form.consolidationType || ''} onChange={(e) => setField('consolidationType', e.target.value)}>
              {CONSOLIDATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>MBL</label>
            <input className={inputClass} value={form.mblNumber || ''} onChange={(e) => setField('mblNumber', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Consolidation Date</label>
            <input type="date" className={inputClass} value={form.consolidationDate ? String(form.consolidationDate).slice(0, 10) : ''} onChange={(e) => setField('consolidationDate', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Tags</label>
            <input className={inputClass} value={form.tags || ''} onChange={(e) => setField('tags', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Sailing Schedule</label>
            <input className={inputClass} value={form.sailingSchedule || ''} onChange={(e) => setField('sailingSchedule', e.target.value)} />
          </div>
        </div>
      </div>

      {/* General Details */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="font-bold text-blue-700">General Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Shipment Type</label>
              <select className={inputClass} value={form.shipmentType || ''} onChange={(e) => setField('shipmentType', e.target.value)}>
                {SHIPMENT_TYPES.map((t) => <option key={t} value={t}>{t === 'EXP' ? '[EXP] Export' : '[IMP] Import'}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Cargos</label>
              <select className={inputClass} value={form.cargoType || ''} onChange={(e) => setField('cargoType', e.target.value)}>
                {CARGO_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Transport Mode</label>
              <select className={inputClass} value={form.transportMode || ''} onChange={(e) => setField('transportMode', e.target.value)}>
                {TRANSPORT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Service Mode</label>
              <select className={inputClass} value={form.serviceMode || ''} onChange={(e) => setField('serviceMode', e.target.value)}>
                {SERVICE_MODES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Party */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="font-bold text-blue-700">Party</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <label className={labelClass}>Agent</label>
            <input className={inputClass} value={form.agent || ''} onChange={(e) => setField('agent', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Co Loader</label>
            <input className={inputClass} value={form.coLoader || ''} onChange={(e) => setField('coLoader', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Locations */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="font-bold text-blue-700">Locations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          {[
            ['origin', 'Origin'], ['destination', 'Destination'],
            ['por', 'POR'], ['pod', 'POD'],
            ['pol', 'POL'], ['fpd', 'FPD'],
          ].map(([key, label]) => (
            <div key={key}>
              <label className={labelClass}>{label}</label>
              <input className={inputClass} value={form[key] || ''} onChange={(e) => setField(key, e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      {/* Vessel Info */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="font-bold text-blue-700">Vessel Info</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Shipping Line</label>
              <input className={inputClass} value={form.shippingLine || ''} onChange={(e) => setField('shippingLine', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Vessel</label>
              <input className={inputClass} value={form.vesselName || ''} onChange={(e) => setField('vesselName', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Voyage No</label>
              <input className={inputClass} value={form.voyageNumber || ''} onChange={(e) => setField('voyageNumber', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Carrier Ref Number</label>
              <input className={inputClass} value={form.carrierRefNumber || ''} onChange={(e) => setField('carrierRefNumber', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Remarks</label>
              <textarea rows={3} className={inputClass} value={form.remarks || ''} onChange={(e) => setField('remarks', e.target.value)} />
            </div>
          </div>
          <div className="space-y-4">
            {[['etd', 'ETD'], ['eta', 'ETA'], ['atd', 'ATD']].map(([key, label]) => (
              <div key={key}>
                <label className={labelClass}>{label}</label>
                <input type="date" className={inputClass} value={form[key] ? String(form[key]).slice(0, 10) : ''} onChange={(e) => setField(key, e.target.value)} />
              </div>
            ))}
            <div>
              <label className={labelClass}>Incoterms</label>
              <select className={inputClass} value={form.incoterm || ''} onChange={(e) => setField('incoterm', e.target.value)}>
                {INCOTERMS.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Container Numbers */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="font-bold text-gray-900">Container Numbers</h2>
        <div className="flex gap-2">
          <input
            className={inputClass}
            placeholder="Enter container number"
            value={newContainer}
            onChange={(e) => setNewContainer(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addContainer(); } }}
          />
          <button
            onClick={addContainer}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
        {form.containerNumbers.length === 0 ? (
          <p className="text-sm text-gray-400">No container numbers added</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {form.containerNumbers.map((c, idx) => (
              <span key={idx} className="flex items-center gap-2 bg-gray-100 text-gray-700 text-xs font-mono px-3 py-1.5 rounded-lg">
                {c}
                <button onClick={() => removeContainer(idx)} className="text-gray-400 hover:text-red-600">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Package Detail + Commodity - line tables carried over from the
          attached house shipments on the live demo. */}
      {[
        { title: 'Package Detail', columns: PACKAGE_COLUMNS, lines: form.packageLines, upload: true },
        { title: 'Commodity', columns: COMMODITY_COLUMNS, lines: form.commodityLines, upload: false },
      ].map(({ title, columns, lines, upload }) => (
        <div key={title} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold text-blue-700">{title}</h2>
            {upload && (
              <button
                onClick={() => toast('Package upload coming soon')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded"
              >
                <Upload className="w-3.5 h-3.5" /> Upload Package
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {columns.map((h) => (
                    <th key={h} className="text-left px-3 py-2 font-semibold text-gray-600 text-xs whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(lines || []).length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="text-center py-8 text-gray-400 text-xs">
                      No lines — attach house shipments to populate this table
                    </td>
                  </tr>
                ) : lines.map((line, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    {columns.map((h) => (
                      <td key={h} className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{line[h] ?? '-'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* House Detail */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="font-bold text-blue-700">House Detail</h2>
        {houseShipments.length === 0 ? (
          <p className="text-sm text-gray-400">No house shipments available</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs w-10"></th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs">Job No</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs">Origin</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs">Destination</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {houseShipments.map((hs) => (
                  <tr key={hs.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={form.houseShipmentIds.includes(hs.id)}
                        onChange={() => toggleHouseShipment(hs.id)}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-blue-700 text-xs">{hs.jobNumber || hs.ffJobNumber || hs.id}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{hs.origin || '-'}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{hs.destination || '-'}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{hs.status || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Remarks */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="font-bold text-gray-900">Remarks</h2>
        <textarea className={inputClass} rows={3} value={form.remarks || ''} onChange={(e) => setField('remarks', e.target.value)} />
      </div>
    </div>
  );
};

export default ConsolidationDetail;
