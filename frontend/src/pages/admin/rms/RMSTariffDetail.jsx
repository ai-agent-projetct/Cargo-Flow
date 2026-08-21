import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Save, X, Settings, ChevronLeft, ChevronRight, FileText, Trash2, Copy,
} from 'lucide-react';
import { rmsTariffsAPI } from '../../../services/api';
import { PageLoader } from '../../../common/LoadingSpinner';
import toast from 'react-hot-toast';
import { inputClass } from '../houseShipment/constants';
import OrganizationChatter from '../organization/OrganizationChatter';
import {
  SERVICES, TRADES, CARGO_TYPES, SERVICE_LABELS, TRADE_LABELS, CARGO_LABELS,
  CHARGE_COLUMNS, NUMERIC_CHARGE_FIELDS, CHARGE_TABS, fmtAmount, fmtRate,
} from './constants';

const emptyRow = {
  charge: '', unit: '', currency: '', ssp: 0, msp: 0, cost: 0,
  minimum: 0, tos: '', carrier: '', agent: '',
};

const emptyForm = {
  tariffNumber: '', tariffDate: '', expiryDate: '',
  service: 'SEA', trade: 'EXP', cargoType: 'FCL',
  originCountry: '', originPort: '', destinationCountry: '', destinationPort: '',
  isHazardous: false,
  originCharges: [], freightCharges: [], destinationCharges: [],
  documentCount: 0, activityLog: [], followerCount: 1,
};

const Toggle = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
  >
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
  </button>
);

const Field = ({ label, children }) => (
  <div className="flex items-start gap-4">
    <span className="w-44 text-sm font-medium text-gray-700 flex-shrink-0 pt-2">{label}</span>
    <div className="flex-1">{children}</div>
  </div>
);

const RMSTariffDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'create';

  const [form, setForm] = useState(emptyForm);
  const [lumpSum, setLumpSum] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(isNew);
  const [activeTab, setActiveTab] = useState(CHARGE_TABS[0].key);
  const [actionOpen, setActionOpen] = useState(false);
  // The list this tariff belongs to, so the header arrows can step through it.
  const [siblings, setSiblings] = useState([]);

  useEffect(() => {
    if (isNew) return;
    rmsTariffsAPI.getAll({ limit: 200 })
      .then((r) => setSiblings(r.data?.data || []))
      .catch(() => setSiblings([]));
  }, [isNew]);
  const actionRef = useRef(null);

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    const onClick = (e) => { if (actionRef.current && !actionRef.current.contains(e.target)) setActionOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const load = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const res = await rmsTariffsAPI.getById(id);
      const data = res.data.data;
      setForm({ ...emptyForm, ...data });
      setLumpSum(data.lumpSum);
    } catch {
      toast.error('Failed to load tariff');
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { activityLog, lumpSum: _ls, ...payload } = form;
      if (isNew) {
        const res = await rmsTariffsAPI.create(payload);
        toast.success('Tariff created');
        navigate(`/admin/rms/tariffs/${res.data.data.id}`, { replace: true });
      } else {
        const res = await rmsTariffsAPI.update(id, payload);
        setLumpSum(res.data.data.lumpSum);
        setEditing(false);
        toast.success('Tariff saved');
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async () => {
    setActionOpen(false);
    try {
      const res = await rmsTariffsAPI.duplicate(id);
      toast.success(`Duplicated as ${res.data.data.tariffNumber}`);
      navigate(`/admin/rms/tariffs/${res.data.data.id}`);
    } catch {
      toast.error('Duplicate failed');
    }
  };

  const handleDelete = async () => {
    setActionOpen(false);
    if (!window.confirm(`Delete ${form.tariffNumber}? This cannot be undone.`)) return;
    try {
      await rmsTariffsAPI.delete(id);
      toast.success('Tariff deleted');
      navigate('/admin/rms/tariffs');
    } catch {
      toast.error('Delete failed');
    }
  };

  const updateLine = (tabKey, idx, key, value) => setForm((p) => ({
    ...p,
    [tabKey]: p[tabKey].map((row, i) => (i === idx ? { ...row, [key]: value } : row)),
  }));

  const addLine = (tabKey) => setForm((p) => ({ ...p, [tabKey]: [...(p[tabKey] || []), { ...emptyRow }] }));
  const removeLine = (tabKey, idx) => setForm((p) => ({ ...p, [tabKey]: p[tabKey].filter((_, i) => i !== idx) }));

  if (loading) return <PageLoader />;

  const lines = form[activeTab] || [];

  // The record pager reads the same list the tariff came from.
  const sibIndex = siblings.findIndex((x) => String(x.id) === String(id));
  const step = (delta) => {
    const next = siblings[sibIndex + delta];
    if (next) navigate(`/admin/rms/tariffs/${next.id}`);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="text-sm text-gray-500">
        <button onClick={() => navigate('/admin/rms/tariffs')} className="text-blue-700 hover:underline">Tariff</button>
        {' / '}{isNew ? 'New' : form.tariffNumber}
      </div>

      {/* Toolbar: Edit/Save + Action ▾ + pager */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-sm font-semibold rounded">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => { if (isNew) navigate('/admin/rms/tariffs'); else { setEditing(false); load(); } }}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded">
                <X className="w-4 h-4" /> Discard
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)}
              className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded">
              Edit
            </button>
          )}
        </div>

        {!isNew && (
          <div ref={actionRef} className="relative">
            <button
              onClick={() => setActionOpen((v) => !v)}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded"
            >
              <Settings className="w-4 h-4" /> Action
            </button>
            {actionOpen && (
              <div className="absolute left-0 top-full mt-1 w-40 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-30">
                <button onClick={handleDuplicate} className="w-full flex items-center gap-2 text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  <Copy className="w-4 h-4" /> Duplicate
                </button>
                <button onClick={handleDelete} className="w-full flex items-center gap-2 text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 text-sm text-gray-500">
          {/* Step through the tariff list without going back to it. */}
          <button onClick={() => step(-1)} disabled={sibIndex <= 0}
            title={sibIndex <= 0 ? 'This is the first tariff' : 'Previous tariff'}
            className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:hover:bg-transparent">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => step(1)} disabled={sibIndex < 0 || sibIndex >= siblings.length - 1}
            title={sibIndex >= siblings.length - 1 ? 'This is the last tariff' : 'Next tariff'}
            className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:hover:bg-transparent">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl">
        {/* Documents stat button */}
        <div className="flex justify-end border-b border-gray-200">
          <div className="flex items-center gap-2 px-6 py-4 border-l border-gray-200">
            <FileText className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm font-semibold text-blue-700 leading-none">{form.documentCount || 0}</p>
              <p className="text-xs text-gray-500 mt-0.5">Documents</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <p className="text-xs text-gray-500">Tariff Number</p>
            <p className="text-2xl font-bold text-gray-900">{isNew ? 'New' : form.tariffNumber}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-4">
            <div className="space-y-4">
              <Field label="Tariff Date">
                {editing ? <input type="date" className={inputClass} value={form.tariffDate || ''} onChange={(e) => setField('tariffDate', e.target.value)} />
                  : <span className="text-sm text-gray-800">{form.tariffDate || '-'}</span>}
              </Field>
              <Field label="Trade">
                {editing ? (
                  <select className={inputClass} value={form.trade} onChange={(e) => setField('trade', e.target.value)}>
                    {TRADES.map((t) => <option key={t} value={t}>{TRADE_LABELS[t]}</option>)}
                  </select>
                ) : <span className="text-sm text-blue-700">{TRADE_LABELS[form.trade] || form.trade}</span>}
              </Field>
              <Field label="Origin Country">
                {editing ? <input className={inputClass} value={form.originCountry || ''} onChange={(e) => setField('originCountry', e.target.value)} />
                  : <span className="text-sm text-blue-700">{form.originCountry || '-'}</span>}
              </Field>
              <Field label="Destination Country">
                {editing ? <input className={inputClass} value={form.destinationCountry || ''} onChange={(e) => setField('destinationCountry', e.target.value)} />
                  : <span className="text-sm text-blue-700">{form.destinationCountry || '-'}</span>}
              </Field>
              <Field label="Is Hazardous">
                <Toggle checked={!!form.isHazardous} onChange={() => editing && setField('isHazardous', !form.isHazardous)} />
              </Field>
            </div>

            <div className="space-y-4">
              <Field label="Service">
                {editing ? (
                  <select className={inputClass} value={form.service} onChange={(e) => setField('service', e.target.value)}>
                    {SERVICES.map((s) => <option key={s} value={s}>{SERVICE_LABELS[s]}</option>)}
                  </select>
                ) : <span className="text-sm text-blue-700">{SERVICE_LABELS[form.service] || form.service}</span>}
              </Field>
              <Field label="Cargo Type">
                {editing ? (
                  <select className={inputClass} value={form.cargoType} onChange={(e) => setField('cargoType', e.target.value)}>
                    {CARGO_TYPES.map((c) => <option key={c} value={c}>{CARGO_LABELS[c]}</option>)}
                  </select>
                ) : <span className="text-sm text-blue-700">{CARGO_LABELS[form.cargoType] || form.cargoType}</span>}
              </Field>
              <Field label="Origin Port">
                {editing ? <input className={inputClass} value={form.originPort || ''} onChange={(e) => setField('originPort', e.target.value)} />
                  : <span className="text-sm text-blue-700">{form.originPort || '-'}</span>}
              </Field>
              <Field label="Destination Port">
                {editing ? <input className={inputClass} value={form.destinationPort || ''} onChange={(e) => setField('destinationPort', e.target.value)} />
                  : <span className="text-sm text-blue-700">{form.destinationPort || '-'}</span>}
              </Field>
              <Field label="Expiry Date">
                {editing ? <input type="date" className={inputClass} value={form.expiryDate || ''} onChange={(e) => setField('expiryDate', e.target.value)} />
                  : <span className="text-sm text-gray-800">{form.expiryDate || '-'}</span>}
              </Field>
            </div>
          </div>

          {/* Charge tabs */}
          <div>
            <div className="border-b border-gray-200 flex flex-wrap gap-1">
              {CHARGE_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === t.key ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto mt-3">
              <table className="w-full text-sm border border-gray-200">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {CHARGE_COLUMNS.map(([key, label]) => (
                      <th key={key} className={`px-3 py-2 font-semibold text-gray-700 text-xs whitespace-nowrap ${NUMERIC_CHARGE_FIELDS.has(key) ? 'text-right' : 'text-left'}`}>{label}</th>
                    ))}
                    {editing && <th className="w-10" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lines.length === 0 ? (
                    <tr><td colSpan={CHARGE_COLUMNS.length + 1} className="text-center py-6 text-gray-400 text-xs">No charge lines</td></tr>
                  ) : lines.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      {CHARGE_COLUMNS.map(([key]) => (
                        <td key={key} className={`px-3 py-2 whitespace-nowrap ${NUMERIC_CHARGE_FIELDS.has(key) ? 'text-right' : ''}`}>
                          {editing ? (
                            <input
                              type={NUMERIC_CHARGE_FIELDS.has(key) ? 'number' : 'text'}
                              value={row[key] ?? ''}
                              onChange={(e) => updateLine(activeTab, idx, key, NUMERIC_CHARGE_FIELDS.has(key) ? Number(e.target.value) : e.target.value)}
                              className={`w-full min-w-[6rem] px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${NUMERIC_CHARGE_FIELDS.has(key) ? 'text-right' : ''}`}
                            />
                          ) : (
                            <span className="text-gray-700">
                              {NUMERIC_CHARGE_FIELDS.has(key) ? fmtRate(row[key]) : (row[key] || '-')}
                            </span>
                          )}
                        </td>
                      ))}
                      {editing && (
                        <td className="px-2">
                          <button onClick={() => removeLine(activeTab, idx)} className="p-1 text-gray-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {editing && (
              <button onClick={() => addLine(activeTab)} className="mt-2 text-sm text-blue-700 hover:underline">
                Add a line
              </button>
            )}
          </div>

          {/* Lump sum Amount */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-3">Lump sum Amount</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cyan-50 text-gray-700">
                  <th className="text-left px-4 py-3 font-medium" />
                  <th className="text-left px-4 py-3 font-medium">Total SSP</th>
                  <th className="text-left px-4 py-3 font-medium">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {(lumpSum?.sections || CHARGE_TABS.map((t) => ({ label: t.label, totalSsp: 0, totalCost: 0 }))).map((s) => (
                  <tr key={s.label} className="bg-cyan-50/60 border-t border-white">
                    <td className="px-4 py-3 text-gray-700">{s.label}</td>
                    <td className="px-4 py-3 text-gray-700">{fmtAmount(s.totalSsp)}</td>
                    <td className="px-4 py-3 text-gray-700">{fmtAmount(s.totalCost)}</td>
                  </tr>
                ))}
                <tr className="bg-cyan-100 border-t border-white font-medium">
                  <td className="px-4 py-3 text-gray-800">Total</td>
                  <td className="px-4 py-3 text-gray-800">{fmtAmount(lumpSum?.total?.totalSsp)}</td>
                  <td className="px-4 py-3 text-gray-800">{fmtAmount(lumpSum?.total?.totalCost)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {!isNew && (
        <OrganizationChatter
          organizationId={id}
          entries={form.activityLog || []}
          followerCount={form.followerCount || 1}
          api={rmsTariffsAPI}
          onPosted={(entry) => setForm((p) => ({ ...p, activityLog: [entry, ...(p.activityLog || [])] }))}
        />
      )}
    </div>
  );
};

export default RMSTariffDetail;
