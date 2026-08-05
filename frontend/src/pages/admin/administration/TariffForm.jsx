import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, X, Download, Upload, RefreshCw, Trash2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { tariffsAPI, companiesAPI, customersAPI, incotermsAPI } from '../../../services/api';
import LoadingSpinner from '../../../common/LoadingSpinner';
import {
  TARIFF_JOB_TYPES, SHIPMENT_TYPES, SERVICE_JOB_TYPES, TRANSPORT_MODES, CARGO_TYPES,
  CURRENCIES, MEASUREMENT_BASIS, COUNTRIES, emptyCharge,
} from './tariffData';

const fieldLabel = 'text-xs font-medium text-slate-500 mb-1';
const selectCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white';
const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500';

// Create/Edit form for Sell Tariff & Buy Tariff (Administration > Tariff),
// matching SeaRates ERP's "Buy Tariff / New" screen layout exactly:
// header Tariff Name, Type radio, dropdowns, General + Location sections,
// and a Charges tab with an editable grid + import note.
const TariffForm = ({ tariffType, basePath }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const title = tariffType === 'sell' ? 'Sell Tariff' : 'Buy Tariff';
  const partyLabel = tariffType === 'sell' ? 'Customer' : 'Vendor/Agent';

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [parties, setParties] = useState([]);
  const [incoterms, setIncoterms] = useState([]);
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    tariffName: '',
    jobType: 'shipment',
    shipmentType: '',
    serviceJobType: '',
    transportMode: '',
    cargoType: '',
    companyId: '',
    incotermId: '',
    partyId: '',
    currency: 'USD',
    originCountry: '',
    origin: '',
    destinationCountry: '',
    destination: '',
    charges: [],
  });

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const loadOptions = useCallback(async () => {
    try {
      const [companiesRes, partiesRes, incotermsRes] = await Promise.all([
        companiesAPI.getAll({ limit: 1000 }),
        customersAPI.getAll({ limit: 1000 }),
        incotermsAPI.getAll(),
      ]);
      const companyList = companiesRes.data.data || [];
      setCompanies(companyList);
      setParties(partiesRes.data.data || []);
      setIncoterms(incotermsRes.data.data || []);
      if (!isEdit && companyList.length > 0) {
        setForm((prev) => ({ ...prev, companyId: prev.companyId || companyList[0].id }));
      }
    } catch {
      // ignore – dropdowns will just be empty
    }
  }, [isEdit]);

  const loadTariff = useCallback(async () => {
    if (!isEdit) return;
    setLoading(true);
    try {
      const res = await tariffsAPI.getById(id);
      const t = res.data.data;
      setForm({
        tariffName: t.tariffName || '',
        jobType: t.jobType || 'shipment',
        shipmentType: t.shipmentType || '',
        serviceJobType: t.serviceJobType || '',
        transportMode: t.transportMode || '',
        cargoType: t.cargoType || '',
        companyId: t.companyId || '',
        incotermId: t.incotermId || '',
        partyId: t.partyId || '',
        currency: t.currency || 'USD',
        originCountry: t.originCountry || '',
        origin: t.origin || '',
        destinationCountry: t.destinationCountry || '',
        destination: t.destination || '',
        charges: Array.isArray(t.charges) ? t.charges : [],
      });
    } catch {
      toast.error('Failed to load tariff');
    } finally {
      setLoading(false);
    }
  }, [id, isEdit]);

  useEffect(() => { loadOptions(); }, [loadOptions]);
  useEffect(() => { loadTariff(); }, [loadTariff]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, tariffType };
      if (isEdit) {
        await tariffsAPI.update(id, payload);
        toast.success('Tariff updated');
      } else {
        const res = await tariffsAPI.create(payload);
        toast.success('Tariff created');
        navigate(`${basePath}/${res.data.data.id}`, { replace: true });
        return;
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to save tariff');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => navigate(basePath);

  // ── Charges grid ──────────────────────────────────────────────────────────
  const addChargeLine = () => set('charges', [...form.charges, emptyCharge()]);

  const updateChargeLine = (index, key, value) => {
    const next = [...form.charges];
    next[index] = { ...next[index], [key]: value };
    set('charges', next);
  };

  const removeChargeLine = (index) => {
    set('charges', form.charges.filter((_, i) => i !== index));
  };

  const handleRemoveAll = async () => {
    if (form.charges.length === 0) return;
    set('charges', []);
    if (isEdit) {
      try {
        await tariffsAPI.removeAllCharges(id);
        toast.success('All charges removed');
      } catch {
        toast.error('Failed to remove charges');
      }
    }
  };

  const handleFetchChargeMaster = () => {
    // Pulls a representative set of standard charges, similar to SeaRates'
    // "Fetch Charge Master" action.
    const masterCharges = [
      { chargeName: 'Ocean Freight', unitPrice: '0', currency: form.currency, measurementBasis: 'Per Container', validFrom: '', validTo: '' },
      { chargeName: 'Documentation Fee', unitPrice: '0', currency: form.currency, measurementBasis: 'Per BL', validFrom: '', validTo: '' },
      { chargeName: 'Terminal Handling Charges', unitPrice: '0', currency: form.currency, measurementBasis: 'Per Container', validFrom: '', validTo: '' },
    ];
    const merged = [...form.charges];
    masterCharges.forEach((row) => {
      const idx = merged.findIndex((c) => c.chargeName === row.chargeName);
      if (idx >= 0) merged[idx] = row;
      else merged.push(row);
    });
    set('charges', merged);
    toast.success('Charges fetched from master');
  };

  const handleUploadFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = String(ev.target.result || '');
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        const rows = lines.slice(1).map((line) => {
          const cols = line.split(',');
          return {
            chargeName: (cols[0] || '').trim(),
            unitPrice: (cols[1] || '').trim(),
            currency: (cols[2] || form.currency).trim(),
            measurementBasis: (cols[3] || '').trim(),
            validFrom: (cols[4] || '').trim(),
            validTo: (cols[5] || '').trim(),
          };
        }).filter((r) => r.chargeName);

        // "In case of same Charge Name found from Uploaded Charges file, Only
        // Last valid row entry will be considered for import."
        const merged = [...form.charges];
        rows.forEach((row) => {
          const idx = merged.findIndex((c) => c.chargeName === row.chargeName);
          if (idx >= 0) merged[idx] = row;
          else merged.push(row);
        });
        set('charges', merged);
        toast.success(`${rows.length} charge row(s) imported`);
      } catch {
        toast.error('Failed to parse file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDownloadTemplate = () => {
    const csv = 'Charge Name,Unit Price,Currency,Measurement Basis,Valid From,Valid To\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Charges Template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="py-16"><LoadingSpinner /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm text-slate-500">
          {title} / {isEdit ? 'Edit' : 'New'}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium disabled:opacity-60"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleDiscard}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <X className="w-4 h-4" /> Discard
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-6">
        {/* Tariff Name header */}
        <div>
          <input
            type="text"
            value={form.tariffName}
            onChange={(e) => set('tariffName', e.target.value)}
            placeholder="-"
            className="text-2xl font-bold text-slate-900 w-full border-0 border-b-2 border-transparent focus:border-primary-500 focus:outline-none placeholder:text-slate-300 px-0 py-1"
          />
        </div>

        {/* Type radio */}
        <div>
          <p className={fieldLabel}>Type</p>
          <div className="flex items-center gap-6">
            {TARIFF_JOB_TYPES.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="jobType"
                  checked={form.jobType === opt.value}
                  onChange={() => set('jobType', opt.value)}
                  className="text-primary-600"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {form.jobType === 'service_job' ? (
            <div>
              <p className={fieldLabel}>Service Job Type</p>
              <select className={selectCls} value={form.serviceJobType} onChange={(e) => set('serviceJobType', e.target.value)}>
                <option value="">Select...</option>
                {SERVICE_JOB_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <p className={fieldLabel}>Shipment Type</p>
              <select className={selectCls} value={form.shipmentType} onChange={(e) => set('shipmentType', e.target.value)}>
                <option value="">Select...</option>
                {SHIPMENT_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          <div>
            <p className={fieldLabel}>Transport Mode</p>
            <select className={selectCls} value={form.transportMode} onChange={(e) => set('transportMode', e.target.value)}>
              <option value="">Select...</option>
              {TRANSPORT_MODES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <p className={fieldLabel}>Cargo Type</p>
            <select className={selectCls} value={form.cargoType} onChange={(e) => set('cargoType', e.target.value)}>
              <option value="">Select...</option>
              {CARGO_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <p className={fieldLabel}>Company</p>
            <select className={selectCls} value={form.companyId} onChange={(e) => set('companyId', e.target.value)}>
              <option value="">Select...</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <p className={fieldLabel}>Incoterms</p>
            <select className={selectCls} value={form.incotermId} onChange={(e) => set('incotermId', e.target.value)}>
              <option value="">Select...</option>
              {incoterms.map((i) => <option key={i.id} value={i.id}>{i.code} - {i.name}</option>)}
            </select>
          </div>
        </div>

        {/* General section */}
        <div className="border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">General</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className={fieldLabel}>{partyLabel}</p>
              <select className={selectCls} value={form.partyId} onChange={(e) => set('partyId', e.target.value)}>
                <option value="">Select...</option>
                {parties.map((p) => <option key={p.id} value={p.id}>{p.companyName}</option>)}
              </select>
            </div>
            <div>
              <p className={fieldLabel}>Currency</p>
              <select className={selectCls} value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Location section */}
        <div className="border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Location</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className={fieldLabel}>Origin Country</p>
              <select className={selectCls} value={form.originCountry} onChange={(e) => set('originCountry', e.target.value)}>
                <option value="">Select...</option>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <p className={fieldLabel}>Origin</p>
              <input type="text" className={inputCls} value={form.origin} onChange={(e) => set('origin', e.target.value)} placeholder="Origin port / city" />
            </div>
            <div>
              <p className={fieldLabel}>Destination Country</p>
              <select className={selectCls} value={form.destinationCountry} onChange={(e) => set('destinationCountry', e.target.value)}>
                <option value="">Select...</option>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <p className={fieldLabel}>Destination</p>
              <input type="text" className={inputCls} value={form.destination} onChange={(e) => set('destination', e.target.value)} placeholder="Destination port / city" />
            </div>
          </div>
        </div>

        {/* Charges tab */}
        <div className="border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Charges</h3>

          <div className="flex items-center gap-2 mb-3">
            <button onClick={handleDownloadTemplate} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 border border-slate-200" title="Download template">
              <Download className="w-4 h-4" />
            </button>
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleUploadFile} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
              <Upload className="w-3.5 h-3.5" /> Upload Charges
            </button>
            <button onClick={handleFetchChargeMaster} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
              <RefreshCw className="w-3.5 h-3.5" /> Fetch Charge Master
            </button>
            <button onClick={handleRemoveAll} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-red-200 rounded-lg text-red-600 hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5" /> Remove All
            </button>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Charge Name</th>
                  <th className="text-left px-3 py-2">Unit Price</th>
                  <th className="text-left px-3 py-2">Currency</th>
                  <th className="text-left px-3 py-2">Measurement Basis</th>
                  <th className="text-left px-3 py-2">Valid From</th>
                  <th className="text-left px-3 py-2">Valid To</th>
                  <th className="px-2 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {form.charges.map((charge, index) => (
                  <tr key={index}>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={charge.chargeName}
                        onChange={(e) => updateChargeLine(index, 'chargeName', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Charge Name"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        value={charge.unitPrice}
                        onChange={(e) => updateChargeLine(index, 'unitPrice', e.target.value)}
                        className="w-24 px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={charge.currency}
                        onChange={(e) => updateChargeLine(index, 'currency', e.target.value)}
                        className="px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={charge.measurementBasis}
                        onChange={(e) => updateChargeLine(index, 'measurementBasis', e.target.value)}
                        className="px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">Select...</option>
                        {MEASUREMENT_BASIS.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="date"
                        value={charge.validFrom}
                        onChange={(e) => updateChargeLine(index, 'validFrom', e.target.value)}
                        className="px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="date"
                        value={charge.validTo}
                        onChange={(e) => updateChargeLine(index, 'validTo', e.target.value)}
                        className="px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button onClick={() => removeChargeLine(index)} className="p-1 text-slate-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {form.charges.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-400">No charges added</td>
                  </tr>
                )}
              </tbody>
            </table>
            <button onClick={addChargeLine} className="flex items-center gap-1.5 px-3 py-2 text-sm text-primary-600 hover:bg-primary-50 w-full">
              <Plus className="w-3.5 h-3.5" /> Add a line
            </button>
          </div>

          <p className="mt-2 text-xs text-slate-400">
            ** In case of same Charge Name found from Uploaded Charges file, Only Last valid row entry will be considered for import.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TariffForm;
