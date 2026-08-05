import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import {
  ArrowLeft, ArrowRight, Check, MapPin, Package, DollarSign,
  ClipboardList, Plus, Trash2, Ship,
} from 'lucide-react';
import { quotationsAPI } from '../../services/api';
import { SHIPMENT_MODES, INCOTERMS, CONTAINER_TYPES, CURRENCIES } from '../../utils/helpers';
import toast from 'react-hot-toast';

const STEPS = ['Route & Customer', 'Cargo Details', 'Pricing', 'Review'];

const AdminQuotationCreate = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, watch, control, getValues, formState: { errors } } = useForm({
    defaultValues: {
      customer_name: '',
      customer_email: '',
      origin: '',
      destination: '',
      origin_port: '',
      destination_port: '',
      mode: 'sea',
      incoterm: 'FOB',
      cargo_type: 'FCL',
      etd: '',
      eta: '',
      valid_until: '',
      notes: '',
      containers: [{ type: "40'GP", quantity: 1 }],
      currency: 'USD',
      line_items: [
        { description: 'Ocean Freight', quantity: 1, unit: 'Shipment', unit_price: 0 },
      ],
    },
  });

  const { fields: containerFields, append: appendContainer, remove: removeContainer } = useFieldArray({ control, name: 'containers' });
  const { fields: lineFields, append: appendLine, remove: removeLine } = useFieldArray({ control, name: 'line_items' });

  const watchLineItems = watch('line_items');
  const total = watchLineItems?.reduce((sum, item) => sum + (Number(item.unit_price) * Number(item.quantity) || 0), 0) || 0;
  const currency = watch('currency');

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const payload = {
        ...data,
        line_items: data.line_items.map((item) => ({
          ...item,
          total: Number(item.unit_price) * Number(item.quantity),
        })),
        total_amount: total,
      };
      await quotationsAPI.create(payload);
      toast.success('Quotation created successfully!');
      navigate('/admin/quotations');
    } catch {
      toast.error('Failed to create quotation');
    } finally {
      setLoading(false);
    }
  };

  const StepIcon = ({ index }) => {
    if (index < step) return <Check className="w-4 h-4" />;
    return <span className="text-sm font-semibold">{index + 1}</span>;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/quotations')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-xl font-bold text-slate-900">Create Quotation</h2>
      </div>

      {/* Stepper */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between">
          {STEPS.map((label, idx) => (
            <React.Fragment key={idx}>
              <div className="flex flex-col items-center gap-1.5">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  idx < step ? 'bg-green-500 text-white' :
                  idx === step ? 'bg-primary-600 text-white' :
                  'bg-slate-100 text-slate-400'
                }`}>
                  <StepIcon index={idx} />
                </div>
                <span className={`text-xs font-medium hidden sm:block ${idx === step ? 'text-primary-600' : idx < step ? 'text-green-600' : 'text-slate-400'}`}>
                  {label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 transition-colors ${idx < step ? 'bg-green-400' : 'bg-slate-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Step 0: Route & Customer */}
        {step === 0 && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 space-y-5">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2"><MapPin className="w-4 h-4 text-primary-600" /> Route & Customer</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Customer Name *</label>
                <input type="text" className="input-field w-full" placeholder="Acme Corporation" {...register('customer_name', { required: 'Required' })} />
                {errors.customer_name && <p className="text-xs text-red-500 mt-1">{errors.customer_name.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Customer Email *</label>
                <input type="email" className="input-field w-full" placeholder="contact@company.com" {...register('customer_email', { required: 'Required' })} />
                {errors.customer_email && <p className="text-xs text-red-500 mt-1">{errors.customer_email.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Origin *</label>
                <input type="text" className="input-field w-full" placeholder="City, Country" {...register('origin', { required: 'Required' })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Destination *</label>
                <input type="text" className="input-field w-full" placeholder="City, Country" {...register('destination', { required: 'Required' })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Origin Port/Airport</label>
                <input type="text" className="input-field w-full" placeholder="Shanghai CNSHA" {...register('origin_port')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Destination Port/Airport</label>
                <input type="text" className="input-field w-full" placeholder="Rotterdam NLRTM" {...register('destination_port')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Transport Mode *</label>
                <select className="input-field w-full" {...register('mode', { required: 'Required' })}>
                  {SHIPMENT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Incoterm</label>
                <select className="input-field w-full" {...register('incoterm')}>
                  {INCOTERMS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">ETD (Est. Departure)</label>
                <input type="date" className="input-field w-full" {...register('etd')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">ETA (Est. Arrival)</label>
                <input type="date" className="input-field w-full" {...register('eta')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Valid Until *</label>
                <input type="date" className="input-field w-full" {...register('valid_until', { required: 'Required' })} />
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Cargo */}
        {step === 1 && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 space-y-5">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Package className="w-4 h-4 text-primary-600" /> Cargo Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Cargo Type</label>
                <select className="input-field w-full" {...register('cargo_type')}>
                  <option value="FCL">FCL (Full Container Load)</option>
                  <option value="LCL">LCL (Less than Container Load)</option>
                  <option value="General">General Cargo</option>
                  <option value="Hazardous">Hazardous Material</option>
                  <option value="Perishable">Perishable</option>
                  <option value="Oversized">Oversized</option>
                </select>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-slate-700">Containers</label>
                <button type="button" onClick={() => appendContainer({ type: "40'GP", quantity: 1 })}
                  className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add Container
                </button>
              </div>
              {containerFields.map((field, idx) => (
                <div key={field.id} className="flex items-center gap-3 mb-2">
                  <select className="input-field flex-1" {...register(`containers.${idx}.type`)}>
                    {CONTAINER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <div className="flex items-center gap-2">
                    <input type="number" min="1" className="input-field w-20" {...register(`containers.${idx}.quantity`, { min: 1 })} />
                    <span className="text-xs text-slate-500">units</span>
                  </div>
                  {containerFields.length > 1 && (
                    <button type="button" onClick={() => removeContainer(idx)} className="text-red-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes / Special Requirements</label>
              <textarea rows={3} className="input-field w-full resize-none" placeholder="Special handling, temperature requirements, etc." {...register('notes')} />
            </div>
          </div>
        )}

        {/* Step 2: Pricing */}
        {step === 2 && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 space-y-5">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2"><DollarSign className="w-4 h-4 text-primary-600" /> Pricing</h3>
            <div className="w-40">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Currency</label>
              <select className="input-field w-full" {...register('currency')}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-slate-700">Line Items</label>
                <button type="button" onClick={() => appendLine({ description: '', quantity: 1, unit: 'Shipment', unit_price: 0 })}
                  className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
              </div>
              <div className="space-y-2">
                {lineFields.map((field, idx) => (
                  <div key={field.id} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      {idx === 0 && <label className="text-xs text-slate-500 block mb-1">Description</label>}
                      <input type="text" className="input-field w-full" placeholder="Freight charge" {...register(`line_items.${idx}.description`)} />
                    </div>
                    <div className="col-span-2">
                      {idx === 0 && <label className="text-xs text-slate-500 block mb-1">Qty</label>}
                      <input type="number" min="1" className="input-field w-full" {...register(`line_items.${idx}.quantity`, { valueAsNumber: true })} />
                    </div>
                    <div className="col-span-2">
                      {idx === 0 && <label className="text-xs text-slate-500 block mb-1">Unit</label>}
                      <input type="text" className="input-field w-full" placeholder="Container" {...register(`line_items.${idx}.unit`)} />
                    </div>
                    <div className="col-span-2">
                      {idx === 0 && <label className="text-xs text-slate-500 block mb-1">Unit Price</label>}
                      <input type="number" min="0" step="0.01" className="input-field w-full" {...register(`line_items.${idx}.unit_price`, { valueAsNumber: true })} />
                    </div>
                    <div className="col-span-1 flex justify-end pb-0.5">
                      {lineFields.length > 1 && (
                        <button type="button" onClick={() => removeLine(idx)} className="text-red-400 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                <div className="text-right">
                  <p className="text-sm text-slate-500">Total Amount</p>
                  <p className="text-2xl font-bold text-primary-700">{currency} {total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 space-y-5">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2"><ClipboardList className="w-4 h-4 text-primary-600" /> Review & Submit</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-xs text-slate-500">Customer</p><p className="font-medium text-slate-900">{watch('customer_name')}</p></div>
              <div><p className="text-xs text-slate-500">Email</p><p className="font-medium text-slate-900">{watch('customer_email')}</p></div>
              <div><p className="text-xs text-slate-500">Origin</p><p className="font-medium text-slate-900">{watch('origin')}</p></div>
              <div><p className="text-xs text-slate-500">Destination</p><p className="font-medium text-slate-900">{watch('destination')}</p></div>
              <div><p className="text-xs text-slate-500">Mode</p><p className="font-medium text-slate-900">{watch('mode')?.toUpperCase()}</p></div>
              <div><p className="text-xs text-slate-500">Cargo Type</p><p className="font-medium text-slate-900">{watch('cargo_type')}</p></div>
              <div><p className="text-xs text-slate-500">Valid Until</p><p className="font-medium text-slate-900">{watch('valid_until')}</p></div>
              <div><p className="text-xs text-slate-500">Currency</p><p className="font-medium text-slate-900">{watch('currency')}</p></div>
            </div>
            <div className="pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-500 mb-2">Line Items ({watch('line_items')?.length})</p>
              {watch('line_items')?.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm py-1 border-b border-slate-50">
                  <span className="text-slate-600">{item.description} ({item.quantity}x {item.unit})</span>
                  <span className="font-medium">{currency} {(item.unit_price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between mt-3 font-bold text-base">
                <span>Total</span>
                <span className="text-primary-700">{currency} {total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Previous
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:bg-green-400"
            >
              <Check className="w-4 h-4" />
              {loading ? 'Creating...' : 'Create Quotation'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default AdminQuotationCreate;
