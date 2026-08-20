import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, X, Plus, Trash2, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { cfsTariffsAPI, companiesAPI, customersAPI, carriersAPI, portsAPI } from '../../../services/api';
import LoadingSpinner from '../../../common/LoadingSpinner';
import {
  CFS_OPERATIONS, CFS_TRANSPORT_MODES, CFS_CARGO_TYPES, CFS_TARIFF_BASES,
  CFS_MEASUREMENT_TYPES, CFS_CURRENCIES, COUNTRIES, emptyCFSCharge,
} from './cfsTariffData';

const fieldLabel = 'text-xs font-medium text-slate-500 mb-1';
const selectCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white';
const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500';
const roCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-600';

// "Administration > CFS Tariff > Charges Tariff" create/edit form, matching
// CargoFlo ERP's "CFS Tariff Charges / New" screen: Buy/Sell Tariff radio,
// Tariff Name, Operation / Transport Mode / Shipping Line / Cargo Type /
// Company / Valid From-To, General (Customer + Currency), Location
// (Origin/Destination Country, Origin/Destination, Origin/Destination Port),
// and a Charges grid.
const CFSTariffForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [parties, setParties] = useState([]);
  const [carriers, setCarriers] = useState([]);
  const [ports, setPorts] = useState([]);

  const [form, setForm] = useState({
    tariffType: 'sell',
    status: 'draft',
    tariffName: '',
    operation: '',
    transportMode: 'SEA',
    shippingLineId: '',
    cargoType: 'LCL',
    companyId: '',
    validFrom: '',
    validTo: '',
    partyId: '',
    currency: 'AED',
    originCountry: '',
    origin: '',
    originPortId: '',
    destinationCountry: '',
    destination: '',
    destinationPortId: '',
    charges: [],
  });

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const loadOptions = useCallback(async () => {
    try {
      const [companiesRes, partiesRes, carriersRes, portsRes] = await Promise.all([
        companiesAPI.getAll({ limit: 1000 }),
        customersAPI.getAll({ limit: 1000 }),
        carriersAPI.getAll({ limit: 1000 }),
        portsAPI.getAll({ limit: 1000 }),
      ]);
      const companyList = companiesRes.data.data || [];
      setCompanies(companyList);
      setParties(partiesRes.data.data || []);
      setCarriers(carriersRes.data.data || []);
      setPorts(portsRes.data.data || []);
      if (!isEdit && companyList.length > 0) {
        setForm((prev) => ({ ...prev, companyId: prev.companyId || companyList[0].id }));
      }
    } catch {
      // dropdowns will just be empty
    }
  }, [isEdit]);

  const loadTariff = useCallback(async () => {
    if (!isEdit) return;
    setLoading(true);
    try {
      const res = await cfsTariffsAPI.getById(id);
      const t = res.data.data;
      setForm({
        tariffType: t.tariffType || 'sell',
        status: t.status || 'draft',
        tariffName: t.tariffName || '',
        operation: t.operation || '',
        transportMode: t.transportMode || 'SEA',
        shippingLineId: t.shippingLineId || '',
        cargoType: t.cargoType || 'LCL',
        companyId: t.companyId || '',
        validFrom: t.validFrom || '',
        validTo: t.validTo || '',
        partyId: t.partyId || '',
        currency: t.currency || 'AED',
        originCountry: t.originCountry || '',
        origin: t.origin || '',
        originPortId: t.originPortId || '',
        destinationCountry: t.destinationCountry || '',
        destination: t.destination || '',
        destinationPortId: t.destinationPortId || '',
        charges: Array.isArray(t.charges) ? t.charges : [],
      });
    } catch {
      toast.error('Failed to load CFS tariff');
    } finally {
      setLoading(false);
    }
  }, [id, isEdit]);

  useEffect(() => { loadOptions(); }, [loadOptions]);
  useEffect(() => { loadTariff(); }, [loadTariff]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isEdit) {
        await cfsTariffsAPI.update(id, form);
        toast.success('CFS Tariff updated');
      } else {
        const res = await cfsTariffsAPI.create(form);
        toast.success('CFS Tariff created');
        navigate(`/admin/administration/cfs-tariff/charges/${res.data.data.id}`, { replace: true });
        return;
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to save CFS tariff');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => navigate('/admin/administration/cfs-tariff/charges');

  const setStatus = async (status) => {
    set('status', status);
    if (isEdit) {
      try {
        await cfsTariffsAPI.update(id, { status });
        toast.success(status === 'approved' ? 'Approved' : 'Unapproved');
      } catch {
        toast.error('Failed to update status');
      }
    }
  };

  // ── Charges grid ──────────────────────────────────────────────────────────
  const addChargeLine = () => set('charges', [...form.charges, emptyCFSCharge()]);

  const updateChargeLine = (index, key, value) => {
    const next = [...form.charges];
    next[index] = { ...next[index], [key]: value };
    set('charges', next);
  };

  const removeChargeLine = (index) => {
    set('charges', form.charges.filter((_, i) => i !== index));
  };

  if (loading) {
    return <div className="py-16"><LoadingSpinner /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm text-slate-500">
          CFS Tariff Charges / {isEdit ? 'Edit' : 'New'}
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

      {/* Approve / status bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-xl shadow-sm border border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStatus('approved')}
            className="flex items-center gap-2 px-4 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium"
          >
            <Check className="w-3.5 h-3.5" /> Approve
          </button>
          <button
            onClick={() => setStatus('unapproved')}
            className="flex items-center gap-2 px-4 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium"
          >
            UnApprove
          </button>
        </div>
        <div className="flex items-center gap-1 text-sm">
          {['draft', 'approved', 'unapproved'].map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <span className="text-slate-300">›</span>}
              <span
                className={`px-3 py-1 rounded-full font-medium capitalize ${
                  form.status === s ? 'bg-primary-600 text-white' : 'text-slate-400'
                }`}
              >
                {s === 'draft' ? 'Draft' : s === 'approved' ? 'Approved' : 'Unapproved'}
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-6">
        {/* Buy/Sell Tariff radio */}
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
            <input
              type="radio"
              name="cfsTariffType"
              checked={form.tariffType === 'buy'}
              onChange={() => set('tariffType', 'buy')}
              className="text-primary-600"
            />
            Buy Tariff
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
            <input
              type="radio"
              name="cfsTariffType"
              checked={form.tariffType === 'sell'}
              onChange={() => set('tariffType', 'sell')}
              className="text-primary-600"
            />
            Sell Tariff
          </label>
        </div>

        {/* Tariff Name */}
        <div>
          <p className={fieldLabel}>Tariff Name</p>
          <input
            type="text"
            value={form.tariffName}
            onChange={(e) => set('tariffName', e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white"
          />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className={fieldLabel}>Operation</p>
            <select className={selectCls} value={form.operation} onChange={(e) => set('operation', e.target.value)}>
              <option value="">Select...</option>
              {CFS_OPERATIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <p className={fieldLabel}>Cargo Type</p>
            <select className={selectCls} value={form.cargoType} onChange={(e) => set('cargoType', e.target.value)}>
              {CFS_CARGO_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <p className={fieldLabel}>Transport Mode</p>
            <select className={selectCls} value={form.transportMode} onChange={(e) => set('transportMode', e.target.value)}>
              {CFS_TRANSPORT_MODES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <p className={fieldLabel}>Company</p>
            <div className={roCls}>{companies.find((c) => c.id === form.companyId)?.name || 'CargoFlo (Dubai)'}</div>
          </div>

          <div>
            <p className={fieldLabel}>Shipping Line</p>
            <select className={selectCls} value={form.shippingLineId} onChange={(e) => set('shippingLineId', e.target.value)}>
              <option value="">Select...</option>
              {carriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <p className={fieldLabel}>Valid From</p>
            <div className="flex items-center gap-2">
              <input type="date" className={inputCls} value={form.validFrom || ''} onChange={(e) => set('validFrom', e.target.value)} />
              <span className="text-xs text-slate-400 shrink-0">TO</span>
              <input type="date" className={inputCls} value={form.validTo || ''} onChange={(e) => set('validTo', e.target.value)} />
            </div>
          </div>
        </div>

        {/* General section */}
        <div className="border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-primary-600 mb-3">General</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className={fieldLabel}>Customer</p>
              <select className={selectCls} value={form.partyId} onChange={(e) => set('partyId', e.target.value)}>
                <option value="">Select...</option>
                {parties.map((p) => <option key={p.id} value={p.id}>{p.companyName}</option>)}
              </select>
            </div>
            <div>
              <p className={fieldLabel}>Currency</p>
              <select className={selectCls} value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                {CFS_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Location section */}
        <div className="border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-primary-600 mb-3">Location</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className={fieldLabel}>Origin Country</p>
              <select className={selectCls} value={form.originCountry} onChange={(e) => set('originCountry', e.target.value)}>
                <option value="">Select...</option>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <p className={fieldLabel}>Destination Country</p>
              <select className={selectCls} value={form.destinationCountry} onChange={(e) => set('destinationCountry', e.target.value)}>
                <option value="">Select...</option>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <p className={fieldLabel}>Origin</p>
              <input type="text" className={inputCls} value={form.origin} onChange={(e) => set('origin', e.target.value)} placeholder="Origin city / location" />
            </div>
            <div>
              <p className={fieldLabel}>Destination</p>
              <input type="text" className={inputCls} value={form.destination} onChange={(e) => set('destination', e.target.value)} placeholder="Destination city / location" />
            </div>
            <div>
              <p className={fieldLabel}>Origin Port</p>
              <select className={selectCls} value={form.originPortId} onChange={(e) => set('originPortId', e.target.value)}>
                <option value="">Select...</option>
                {ports.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
              </select>
            </div>
            <div>
              <p className={fieldLabel}>Destination Port</p>
              <select className={selectCls} value={form.destinationPortId} onChange={(e) => set('destinationPortId', e.target.value)}>
                <option value="">Select...</option>
                {ports.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Charges tab */}
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center gap-4 border-b border-slate-100 mb-3">
            <span className="text-sm font-semibold text-primary-600 border-b-2 border-primary-600 pb-2">Charges</span>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Charges</th>
                  <th className="text-left px-3 py-2">Tariff Base</th>
                  <th className="text-left px-3 py-2">Measurement Type</th>
                  <th className="text-left px-3 py-2">Unit Price</th>
                  <th className="text-left px-3 py-2">Currency</th>
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
                      <select
                        value={charge.tariffBase}
                        onChange={(e) => updateChargeLine(index, 'tariffBase', e.target.value)}
                        className="px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">Select...</option>
                        {CFS_TARIFF_BASES.map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={charge.measurementType}
                        onChange={(e) => updateChargeLine(index, 'measurementType', e.target.value)}
                        className="px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">Select...</option>
                        {CFS_MEASUREMENT_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
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
                        {CFS_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
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
                    <td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-400">No charges added</td>
                  </tr>
                )}
              </tbody>
            </table>
            <button onClick={addChargeLine} className="flex items-center gap-1.5 px-3 py-2 text-sm text-primary-600 hover:bg-primary-50 w-full">
              <Plus className="w-3.5 h-3.5" /> Add a line
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CFSTariffForm;
