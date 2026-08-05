import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import { shipmentsAPI } from '../../services/api';
import { SHIPMENT_MODES, INCOTERMS, CONTAINER_TYPES, CURRENCIES } from '../../utils/helpers';
import toast from 'react-hot-toast';

const AdminShipmentCreate = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, control, formState: { errors } } = useForm({
    defaultValues: {
      reference: '',
      bl_number: '',
      customer_name: '',
      customer_email: '',
      mode: 'sea',
      carrier_name: '',
      vessel_name: '',
      voyage_number: '',
      origin: '',
      destination: '',
      origin_port: '',
      destination_port: '',
      etd: '',
      eta: '',
      incoterm: 'FOB',
      cargo_type: 'FCL',
      containers: [{ type: "40'GP", quantity: 1 }],
      currency: 'USD',
      total_amount: '',
      notes: '',
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'containers' });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const response = await shipmentsAPI.create(data);
      toast.success('Shipment created successfully!');
      navigate(`/admin/shipments/${response.data.data.id}`);
    } catch {
      toast.error('Failed to create shipment');
    } finally {
      setLoading(false);
    }
  };

  const InputField = ({ label, name, required, ...props }) => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}{required && ' *'}</label>
      <input className="input-field w-full" {...register(name, required ? { required: 'Required' } : {})} {...props} />
      {errors[name] && <p className="text-xs text-red-500 mt-1">{errors[name].message}</p>}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/shipments')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-xl font-bold text-slate-900">Create Shipment</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Basic Info */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-900 mb-4">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Reference Number" name="reference" placeholder="CF-2024-XXXX" />
            <InputField label="BL / AWB Number" name="bl_number" placeholder="MSKU1234567" />
            <InputField label="Customer Name" name="customer_name" required placeholder="Company Name" />
            <InputField label="Customer Email" name="customer_email" type="email" placeholder="contact@company.com" />
          </div>
        </div>

        {/* Route */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-900 mb-4">Route Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Origin" name="origin" required placeholder="Shanghai, China" />
            <InputField label="Destination" name="destination" required placeholder="Rotterdam, Netherlands" />
            <InputField label="Origin Port/Airport" name="origin_port" placeholder="Shanghai CNSHA" />
            <InputField label="Destination Port/Airport" name="destination_port" placeholder="Rotterdam NLRTM" />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Transport Mode *</label>
              <select className="input-field w-full" {...register('mode')}>
                {SHIPMENT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Incoterm</label>
              <select className="input-field w-full" {...register('incoterm')}>
                {INCOTERMS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <InputField label="ETD" name="etd" type="date" />
            <InputField label="ETA" name="eta" type="date" />
          </div>
        </div>

        {/* Carrier */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-900 mb-4">Carrier Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InputField label="Carrier Name" name="carrier_name" placeholder="Maersk Line" />
            <InputField label="Vessel/Flight Name" name="vessel_name" placeholder="MV Maersk Edinburgh" />
            <InputField label="Voyage/Flight Number" name="voyage_number" placeholder="VOY-2024-448" />
          </div>
        </div>

        {/* Cargo */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-900 mb-4">Cargo Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Cargo Type</label>
              <select className="input-field w-full" {...register('cargo_type')}>
                <option value="FCL">FCL</option>
                <option value="LCL">LCL</option>
                <option value="General">General</option>
                <option value="Hazardous">Hazardous</option>
                <option value="Perishable">Perishable</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Currency</label>
              <select className="input-field w-full" {...register('currency')}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <InputField label="Total Value" name="total_amount" type="number" step="0.01" placeholder="0.00" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-slate-700">Containers</label>
              <button type="button" onClick={() => append({ type: "40'GP", quantity: 1 })}
                className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            {fields.map((field, idx) => (
              <div key={field.id} className="flex items-center gap-3 mb-2">
                <select className="input-field flex-1" {...register(`containers.${idx}.type`)}>
                  {CONTAINER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input type="number" min="1" className="input-field w-20" {...register(`containers.${idx}.quantity`, { valueAsNumber: true })} />
                <span className="text-xs text-slate-500">units</span>
                {fields.length > 1 && (
                  <button type="button" onClick={() => remove(idx)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
            <textarea rows={3} className="input-field w-full resize-none" {...register('notes')} placeholder="Special instructions..." />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/admin/shipments')} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium disabled:bg-primary-400">
            <Save className="w-4 h-4" />
            {loading ? 'Creating...' : 'Create Shipment'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminShipmentCreate;
