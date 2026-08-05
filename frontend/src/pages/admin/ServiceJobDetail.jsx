import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, X, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { serviceJobsAPI, customersAPI } from '../../services/api';
import { PageLoader } from '../../common/LoadingSpinner';
import toast from 'react-hot-toast';
import { inputClass, labelClass } from './houseShipment/constants';
import PartiesTab from './houseShipment/PartiesTab';
import RoutingTab from './houseShipment/RoutingTab';
import TermsTab from './houseShipment/TermsTab';

const SERVICE_TYPES = [
  'CUSTOMS_CLEARANCE',
  'TRUCKING',
  'WAREHOUSING',
  'INSURANCE',
  'INSPECTION',
  'FUMIGATION',
  'SURVEYING',
  'DOCUMENTATION',
];

const DIRECTIONS = [
  { value: 'EXPORT', label: 'Export' },
  { value: 'IMPORT', label: 'Import' },
  { value: 'LOCAL', label: 'Local' },
];

const STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'];

const CURRENCIES = ['USD', 'AED', 'EUR', 'MYR'];

const TABS = ['Charges', 'Parties', 'Routing', 'Documents', 'Activity Log', 'T&C', 'Remarks'];

const emptyForm = {
  customerId: '',
  serviceType: 'CUSTOMS_CLEARANCE',
  direction: 'LOCAL',
  origin: '',
  destination: '',
  requestDate: '',
  completionDate: '',
  currency: 'USD',
  charges: [],
  totalAmount: 0,
  documents: [],
  parties: [],
  routingLegs: [],
  activityLog: [],
  termsAndConditions: '',
  remarks: '',
  status: 'pending',
};

const emptyCharge = { service: '', description: '', amount: '', currency: 'USD' };
const emptyDocument = { type: '', name: '', url: '' };
const emptyActivity = { date: '', description: '' };

const ServiceJobDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'create';

  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [activeTab, setActiveTab] = useState(TABS[0]);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    customersAPI.getAll({ limit: 200 }).then((res) => setCustomers(res.data?.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (isNew) {
      setLoading(false);
      return;
    }
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const res = await serviceJobsAPI.getById(id);
        const data = res.data?.data;
        setForm((f) => ({
          ...emptyForm,
          ...data,
          customerId: data.customerId || data.customer?.id || '',
          charges: data.charges || [],
          documents: data.documents || [],
          parties: data.parties || [],
          routingLegs: data.routingLegs || [],
          activityLog: data.activityLog || [],
        }));
      } catch {
        toast.error('Failed to load service job');
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
      await serviceJobsAPI.updateStatus(id, status);
      setField('status', status);
      toast.success(`Status updated to ${status.replace('_', ' ')}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update status');
    }
  };

  // Charges
  const updateCharge = (idx, key, value) => {
    setForm((f) => ({
      ...f,
      charges: f.charges.map((c, i) => (i === idx ? { ...c, [key]: value } : c)),
    }));
  };
  const addCharge = () => setForm((f) => ({ ...f, charges: [...f.charges, { ...emptyCharge, currency: f.currency }] }));
  const removeCharge = (idx) => setForm((f) => ({ ...f, charges: f.charges.filter((_, i) => i !== idx) }));
  const chargesTotal = form.charges.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);

  // Documents
  const updateDocument = (idx, key, value) => {
    setForm((f) => ({
      ...f,
      documents: f.documents.map((d, i) => (i === idx ? { ...d, [key]: value } : d)),
    }));
  };
  const addDocument = () => setForm((f) => ({ ...f, documents: [...f.documents, { ...emptyDocument }] }));
  const removeDocument = (idx) => setForm((f) => ({ ...f, documents: f.documents.filter((_, i) => i !== idx) }));

  // Activity Log
  const updateActivity = (idx, key, value) => {
    setForm((f) => ({
      ...f,
      activityLog: f.activityLog.map((a, i) => (i === idx ? { ...a, [key]: value } : a)),
    }));
  };
  const addActivity = () => setForm((f) => ({ ...f, activityLog: [...f.activityLog, { ...emptyActivity }] }));
  const removeActivity = (idx) => setForm((f) => ({ ...f, activityLog: f.activityLog.filter((_, i) => i !== idx) }));

  const buildPayload = () => {
    const payload = { ...form, totalAmount: chargesTotal };
    delete payload.id;
    delete payload.jobNumber;
    delete payload.createdAt;
    delete payload.updatedAt;
    delete payload.createdBy;
    delete payload.customer;
    delete payload.quotation;
    delete payload.assignedUser;
    delete payload.creator;
    delete payload.events;
    return payload;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = buildPayload();
      if (isNew) {
        const res = await serviceJobsAPI.create(payload);
        const created = res.data?.data;
        toast.success('Service Job created');
        navigate(`/admin/service-jobs/${created.id}`);
      } else {
        await serviceJobsAPI.update(id, payload);
        toast.success('Service Job updated');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save service job');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => navigate('/admin/service-jobs');

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
            value={form.status || 'pending'}
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
        Service Jobs / {isNew ? 'New' : (form.jobNumber || 'New')}
      </div>

      <div>
        <p className="text-xs text-gray-500">Job Number</p>
        <p className="text-2xl font-bold text-gray-900 font-mono">{isNew ? 'New' : (form.jobNumber || 'New')}</p>
      </div>

      {/* General Details */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="font-bold text-gray-900">General Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Customer</label>
              <select className={inputClass} value={form.customerId || ''} onChange={(e) => setField('customerId', e.target.value)}>
                <option value="">Select customer</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.companyName || c.contactName}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Service Type</label>
              <select className={inputClass} value={form.serviceType || ''} onChange={(e) => setField('serviceType', e.target.value)}>
                {SERVICE_TYPES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Direction</label>
              <select className={inputClass} value={form.direction || ''} onChange={(e) => setField('direction', e.target.value)}>
                {DIRECTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Origin</label>
              <input className={inputClass} value={form.origin || ''} onChange={(e) => setField('origin', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Destination</label>
              <input className={inputClass} value={form.destination || ''} onChange={(e) => setField('destination', e.target.value)} />
            </div>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Request Date</label>
                <input type="date" className={inputClass} value={form.requestDate ? String(form.requestDate).slice(0, 10) : ''} onChange={(e) => setField('requestDate', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Completion Date</label>
                <input type="date" className={inputClass} value={form.completionDate ? String(form.completionDate).slice(0, 10) : ''} onChange={(e) => setField('completionDate', e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Currency</label>
              <select className={inputClass} value={form.currency || 'USD'} onChange={(e) => setField('currency', e.target.value)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Total Amount</label>
              <input className={inputClass} value={chargesTotal.toFixed(2)} readOnly />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-gray-200 rounded-xl">
        <div className="flex flex-wrap border-b border-gray-200 px-2">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-700 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'Charges' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button type="button" onClick={addCharge} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800">
                  <Plus className="w-3.5 h-3.5" /> Add Charge
                </button>
              </div>
              {form.charges.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">No charges added</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500">
                        <th className="pb-2 pr-2">Service</th>
                        <th className="pb-2 pr-2">Description</th>
                        <th className="pb-2 pr-2">Amount</th>
                        <th className="pb-2 pr-2">Currency</th>
                        <th className="pb-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.charges.map((c, idx) => (
                        <tr key={idx} className="border-t border-gray-100">
                          <td className="py-2 pr-2 min-w-[140px]"><input className={inputClass} value={c.service || ''} onChange={(e) => updateCharge(idx, 'service', e.target.value)} /></td>
                          <td className="py-2 pr-2 min-w-[180px]"><input className={inputClass} value={c.description || ''} onChange={(e) => updateCharge(idx, 'description', e.target.value)} /></td>
                          <td className="py-2 pr-2 w-32"><input type="number" className={inputClass} value={c.amount || ''} onChange={(e) => updateCharge(idx, 'amount', e.target.value)} /></td>
                          <td className="py-2 pr-2 w-28">
                            <select className={inputClass} value={c.currency || form.currency} onChange={(e) => updateCharge(idx, 'currency', e.target.value)}>
                              {CURRENCIES.map((cur) => <option key={cur} value={cur}>{cur}</option>)}
                            </select>
                          </td>
                          <td className="py-2">
                            <button type="button" onClick={() => removeCharge(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-200 font-semibold">
                        <td className="pt-2" colSpan={2}>Total</td>
                        <td className="pt-2">{chargesTotal.toFixed(2)}</td>
                        <td className="pt-2">{form.currency}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Parties' && <PartiesTab form={form} setField={setField} />}

          {activeTab === 'Routing' && <RoutingTab form={form} setField={setField} />}

          {activeTab === 'Documents' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button type="button" onClick={addDocument} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800">
                  <Plus className="w-3.5 h-3.5" /> Add Document
                </button>
              </div>
              {form.documents.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">No documents added</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500">
                        <th className="pb-2 pr-2">Type</th>
                        <th className="pb-2 pr-2">Name</th>
                        <th className="pb-2 pr-2">URL</th>
                        <th className="pb-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.documents.map((d, idx) => (
                        <tr key={idx} className="border-t border-gray-100">
                          <td className="py-2 pr-2 min-w-[120px]"><input className={inputClass} value={d.type || ''} onChange={(e) => updateDocument(idx, 'type', e.target.value)} /></td>
                          <td className="py-2 pr-2 min-w-[160px]"><input className={inputClass} value={d.name || ''} onChange={(e) => updateDocument(idx, 'name', e.target.value)} /></td>
                          <td className="py-2 pr-2 min-w-[200px]"><input className={inputClass} value={d.url || ''} onChange={(e) => updateDocument(idx, 'url', e.target.value)} /></td>
                          <td className="py-2">
                            <button type="button" onClick={() => removeDocument(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Activity Log' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button type="button" onClick={addActivity} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-700 text-white rounded-lg hover:bg-blue-800">
                  <Plus className="w-3.5 h-3.5" /> Add Entry
                </button>
              </div>
              {form.activityLog.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">No activity recorded</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500">
                        <th className="pb-2 pr-2 w-48">Date</th>
                        <th className="pb-2 pr-2">Description</th>
                        <th className="pb-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.activityLog.map((a, idx) => (
                        <tr key={idx} className="border-t border-gray-100">
                          <td className="py-2 pr-2"><input type="datetime-local" className={inputClass} value={a.date || ''} onChange={(e) => updateActivity(idx, 'date', e.target.value)} /></td>
                          <td className="py-2 pr-2"><input className={inputClass} value={a.description || ''} onChange={(e) => updateActivity(idx, 'description', e.target.value)} /></td>
                          <td className="py-2">
                            <button type="button" onClick={() => removeActivity(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'T&C' && <TermsTab form={form} setField={setField} />}

          {activeTab === 'Remarks' && (
            <div>
              <label className={labelClass}>Remarks</label>
              <textarea className={inputClass} rows={4} value={form.remarks || ''} onChange={(e) => setField('remarks', e.target.value)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServiceJobDetail;
