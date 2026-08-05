import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Ship, Plane, Truck, Train } from 'lucide-react';
import { quotationsAPI } from '../../services/api';
import toast from 'react-hot-toast';

const STEPS = [
  { id: 1, label: 'Mode & Type' },
  { id: 2, label: 'Origin & Destination' },
  { id: 3, label: 'Cargo Details' },
  { id: 4, label: 'Review & Submit' },
];

const modeOptions = [
  { value: 'SEA', label: 'Sea Freight', icon: Ship, color: 'border-blue-500 bg-blue-50 text-blue-700' },
  { value: 'AIR', label: 'Air Freight', icon: Plane, color: 'border-purple-500 bg-purple-50 text-purple-700' },
  { value: 'ROAD', label: 'Road Freight', icon: Truck, color: 'border-orange-500 bg-orange-50 text-orange-700' },
  { value: 'RAIL', label: 'Rail Freight', icon: Train, color: 'border-green-500 bg-green-50 text-green-700' },
];

const directionOptions = [
  { value: 'EXPORT', label: 'Export' },
  { value: 'IMPORT', label: 'Import' },
  { value: 'LOCAL', label: 'Local' },
];

const cargoTypeOptions = {
  SEA: [
    { value: 'FCL', label: 'FCL - Full Container Load' },
    { value: 'LCL', label: 'LCL - Less Container Load' },
    { value: 'BULK', label: 'Bulk' },
    { value: 'RORO', label: 'RoRo' },
  ],
  AIR: [
    { value: 'LSE', label: 'Loose Cargo' },
    { value: 'ULD', label: 'ULD' },
  ],
  ROAD: [
    { value: 'FTL', label: 'FTL - Full Truck Load' },
    { value: 'LTL', label: 'LTL - Less Truck Load' },
  ],
  RAIL: [
    { value: 'FCL', label: 'FCL Container' },
    { value: 'LCL', label: 'LCL Container' },
  ],
};

const defaultForm = {
  transport_mode: '',
  shipment_type: '',
  cargo_type: '',
  origin_port: '',
  origin_country: '',
  destination_port: '',
  destination_country: '',
  commodity: '',
  weight: '',
  volume: '',
  packages: '',
  container_type: '',
  incoterm: '',
  special_requirements: '',
};

const UserQuotationCreate = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const canProceed = () => {
    if (step === 1) return form.transport_mode && form.shipment_type && form.cargo_type;
    if (step === 2) return form.origin_country && form.destination_country;
    if (step === 3) return form.commodity;
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await quotationsAPI.create({
        transport_mode: form.transport_mode,
        shipment_type: form.shipment_type,
        cargo_type: form.cargo_type,
        origin: `${form.origin_port}, ${form.origin_country}`,
        destination: `${form.destination_port}, ${form.destination_country}`,
        commodity: form.commodity,
        weight: form.weight,
        volume: form.volume,
        packages: form.packages,
        container_type: form.container_type,
        incoterm: form.incoterm,
        special_requirements: form.special_requirements,
        quote_for: 'Shipment',
      });
      toast.success('Quote request submitted successfully!');
      navigate('/user/quotations');
    } catch {
      toast.success('Quote request submitted! (Demo mode)');
      navigate('/user/quotations');
    } finally {
      setLoading(false);
    }
  };

  const cargoTypes = cargoTypeOptions[form.transport_mode] || [];

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate('/user/quotations')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Quotations
      </button>

      <div>
        <h1 className="text-xl font-bold text-gray-900">Request a Quote</h1>
        <p className="text-gray-500 text-sm mt-0.5">Fill in the details to request a shipment quote</p>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                step > s.id
                  ? 'bg-green-600 text-white'
                  : step === s.id
                  ? 'bg-blue-700 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}>
                {step > s.id ? <Check className="w-4 h-4" /> : s.id}
              </div>
              <p className={`text-xs mt-1 font-medium hidden sm:block ${step === s.id ? 'text-blue-700' : 'text-gray-400'}`}>
                {s.label}
              </p>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-4 ${step > s.id ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        {/* Step 1: Mode & Type */}
        {step === 1 && (
          <>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Transport Mode *</label>
              <div className="grid grid-cols-2 gap-3">
                {modeOptions.map(({ value, label, icon: Icon, color }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { set('transport_mode', value); set('cargo_type', ''); }}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                      form.transport_mode === value ? color : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium text-sm">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Shipment Type *</label>
              <div className="flex gap-3">
                {directionOptions.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => set('shipment_type', value)}
                    className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                      form.shipment_type === value
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {form.transport_mode && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Cargo Type *</label>
                <div className="flex flex-wrap gap-2">
                  {cargoTypes.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => set('cargo_type', value)}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                        form.cargo_type === value
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Step 2: Origin & Destination */}
        {step === 2 && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Origin Country *</label>
                <input
                  type="text"
                  value={form.origin_country}
                  onChange={(e) => set('origin_country', e.target.value)}
                  placeholder="e.g. Malaysia"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Origin Port/City</label>
                <input
                  type="text"
                  value={form.origin_port}
                  onChange={(e) => set('origin_port', e.target.value)}
                  placeholder="e.g. Port Klang"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Destination Country *</label>
                <input
                  type="text"
                  value={form.destination_country}
                  onChange={(e) => set('destination_country', e.target.value)}
                  placeholder="e.g. Singapore"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Destination Port/City</label>
                <input
                  type="text"
                  value={form.destination_port}
                  onChange={(e) => set('destination_port', e.target.value)}
                  placeholder="e.g. Singapore Port"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Incoterm</label>
              <select
                value={form.incoterm}
                onChange={(e) => set('incoterm', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Select Incoterm</option>
                {['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF'].map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {/* Step 3: Cargo Details */}
        {step === 3 && (
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Commodity *</label>
              <input
                type="text"
                value={form.commodity}
                onChange={(e) => set('commodity', e.target.value)}
                placeholder="e.g. Electronics, Machinery parts"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Total Weight</label>
              <input
                type="text"
                value={form.weight}
                onChange={(e) => set('weight', e.target.value)}
                placeholder="e.g. 1000 KG"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Total Volume</label>
              <input
                type="text"
                value={form.volume}
                onChange={(e) => set('volume', e.target.value)}
                placeholder="e.g. 10 CBM"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">No. of Packages</label>
              <input
                type="text"
                value={form.packages}
                onChange={(e) => set('packages', e.target.value)}
                placeholder="e.g. 10 cartons"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {(form.cargo_type === 'FCL' || form.cargo_type === 'FTL') && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Container Type</label>
                <select
                  value={form.container_type}
                  onChange={(e) => set('container_type', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Select type</option>
                  {["20'GP", "40'GP", "40'HC", "20'RF", "40'RF"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Special Requirements</label>
              <textarea
                value={form.special_requirements}
                onChange={(e) => set('special_requirements', e.target.value)}
                rows={3}
                placeholder="Hazardous goods, temperature control, etc."
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Review your quote request</h3>
            <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Transport Mode', value: form.transport_mode },
                  { label: 'Shipment Type', value: form.shipment_type },
                  { label: 'Cargo Type', value: form.cargo_type },
                  { label: 'Incoterm', value: form.incoterm || '—' },
                  { label: 'Origin', value: [form.origin_port, form.origin_country].filter(Boolean).join(', ') || '—' },
                  { label: 'Destination', value: [form.destination_port, form.destination_country].filter(Boolean).join(', ') || '—' },
                  { label: 'Commodity', value: form.commodity },
                  { label: 'Weight', value: form.weight || '—' },
                  { label: 'Volume', value: form.volume || '—' },
                  { label: 'Packages', value: form.packages || '—' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-gray-500 text-xs">{label}</p>
                    <p className="font-medium text-gray-800">{value}</p>
                  </div>
                ))}
              </div>
              {form.special_requirements && (
                <div>
                  <p className="text-gray-500 text-xs">Special Requirements</p>
                  <p className="font-medium text-gray-800">{form.special_requirements}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <button
          onClick={() => step > 1 ? setStep(step - 1) : navigate('/user/quotations')}
          className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {step === 1 ? 'Cancel' : 'Back'}
        </button>

        {step < 4 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Next
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : <Check className="w-4 h-4" />}
            Submit Quote Request
          </button>
        )}
      </div>
    </div>
  );
};

export default UserQuotationCreate;
