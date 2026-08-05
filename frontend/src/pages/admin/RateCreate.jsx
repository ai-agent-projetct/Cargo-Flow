import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Save } from 'lucide-react';
import { ratesAPI, carriersAPI, portsAPI } from '../../services/api';
import { CONTAINER_TYPES, CURRENCIES } from '../../utils/helpers';
import toast from 'react-hot-toast';

const RATE_MODES = [
  { value: 'sea', label: 'Sea Freight' },
  { value: 'air', label: 'Air Freight' },
  { value: 'land', label: 'Land Freight' },
  { value: 'rail', label: 'Rail Freight' },
];

const AdminRateCreate = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [carriers, setCarriers] = useState([]);
  const [ports, setPorts] = useState([]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [carrierRes, portRes] = await Promise.all([
          carriersAPI.getAll({ page_size: 100 }),
          portsAPI.getAll({ page_size: 200 }),
        ]);
        setCarriers(carrierRes.data?.data || []);
        setPorts(portRes.data?.data || []);
      } catch {
        setCarriers([]);
        setPorts([]);
      }
    };
    fetchOptions();
  }, []);

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      name: '', originPortId: '', destinationPortId: '', mode: 'sea', carrierId: '',
      containerType: "40'GP", freightRate: '', currency: 'USD',
      validFrom: '', validTo: '', notes: '',
    },
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const payload = {
        ...data,
        freightRate: parseFloat(data.freightRate),
        carrierId: data.carrierId || undefined,
        originPortId: data.originPortId || undefined,
        destinationPortId: data.destinationPortId || undefined,
      };
      await ratesAPI.create(payload);
      toast.success('Rate created!');
      navigate('/admin/rates');
    } catch {
      toast.error('Failed to create rate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/rates')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><ArrowLeft className="w-4 h-4" /></button>
        <h2 className="text-xl font-bold text-slate-900">Add Freight Rate</h2>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Rate Name *</label>
            <input type="text" className="input-field w-full" placeholder="Shanghai - Rotterdam FCL" {...register('name', { required: 'Required' })} />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Origin Port *</label>
            <select className="input-field w-full" {...register('originPortId', { required: 'Required' })}>
              <option value="">Select origin port</option>
              {ports.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
            </select>
            {errors.originPortId && <p className="text-xs text-red-500 mt-1">{errors.originPortId.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Destination Port *</label>
            <select className="input-field w-full" {...register('destinationPortId', { required: 'Required' })}>
              <option value="">Select destination port</option>
              {ports.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
            </select>
            {errors.destinationPortId && <p className="text-xs text-red-500 mt-1">{errors.destinationPortId.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Mode *</label>
            <select className="input-field w-full" {...register('mode')}>
              {RATE_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Carrier</label>
            <select className="input-field w-full" {...register('carrierId')}>
              <option value="">Select carrier</option>
              {carriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Container Type</label>
            <select className="input-field w-full" {...register('containerType')}>
              {CONTAINER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              <option value="Per KG">Per KG (Air)</option>
              <option value="Per CBM">Per CBM (LCL)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Currency</label>
            <select className="input-field w-full" {...register('currency')}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Freight Rate *</label>
            <input type="number" step="0.01" className="input-field w-full" placeholder="0.00" {...register('freightRate', { required: 'Required', min: 0 })} />
            {errors.freightRate && <p className="text-xs text-red-500 mt-1">{errors.freightRate.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Transit Days</label>
            <input type="number" min="0" className="input-field w-full" placeholder="0" {...register('transitDays')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Valid From *</label>
            <input type="date" className="input-field w-full" {...register('validFrom', { required: 'Required' })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Valid To *</label>
            <input type="date" className="input-field w-full" {...register('validTo', { required: 'Required' })} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
          <textarea rows={2} className="input-field w-full resize-none" {...register('notes')} placeholder="Additional notes..." />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => navigate('/admin/rates')} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={loading} className="flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium">
            <Save className="w-4 h-4" /> {loading ? 'Saving...' : 'Save Rate'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminRateCreate;
