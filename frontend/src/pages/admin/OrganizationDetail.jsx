import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Save, X, RefreshCw, Calendar, FileText, Receipt, Globe, Camera, Plus, Trash2,
} from 'lucide-react';
import { organizationsAPI } from '../../services/api';
import { PageLoader } from '../../common/LoadingSpinner';
import toast from 'react-hot-toast';
import { inputClass, labelClass } from './houseShipment/constants';
import WorkflowRibbon from './organization/WorkflowRibbon';
import OrganizationChatter from './organization/OrganizationChatter';
import { KYC_STEPS, partyTypeClass } from './organization/constants';

const TABS = ['Addresses', 'Sales & Purchase', 'Invoicing', 'Credit Limit', 'Internal Notes', 'WMS Invoice Integration'];

const LANGUAGES = ['English (US)', 'Arabic', 'French', 'Hindi', 'Chinese'];
const TITLES = ['', 'Mister', 'Madam', 'Doctor', 'Professor'];
const ADDRESS_TYPES = [
  { value: 'contact', label: 'Contact' },
  { value: 'invoice', label: 'Invoice Address' },
  { value: 'delivery', label: 'Delivery Address' },
  { value: 'other', label: 'Other Address' },
];
const INVOICE_WARN = [
  { value: 'no-message', label: 'No Message' },
  { value: 'warning', label: 'Warning' },
  { value: 'block', label: 'Blocking Message' },
];
const STRATEGIES = [
  { value: '', label: '' },
  { value: 'fifo', label: 'FIFO' },
  { value: 'fifo_batch', label: 'FIFO + Batch' },
  { value: 'batch', label: 'Batch' },
];

const emptyForm = {
  companyType: 'person',
  name: '',
  companyName: '',
  customerCode: '',
  markAsDefault: true,
  streetName: '', houseNumber: '', doorNumber: '', street2: '',
  state: '', city: '', zip: '', country: '',
  identificationType: 'VAT', identificationNumber: '', vat: '', pst: '',
  partyTypes: [], freightCarrier: '',
  jobPosition: '', phone: '', mobile: '', fax: '', email: '', website: '',
  title: '', language: 'English (US)', tags: [], transactionType: 'b2b',
  contactPerson: '', govtRegNumber: '', internalRefNo: '', localizationCountryCode: 'AE',
  salesperson: '', salesTeam: '', paymentTerms: '', pricelist: '',
  supplierPaymentTerms: '', receiptReminder: false, daysBeforeReceipt: '',
  supplierCurrency: '', fiscalPosition: '', reference: '', company: '', industry: '',
  bankAccounts: [], currency: 'AED', accountReceivable: '', accountPayable: '',
  showCreditLimit: false, internalCreditLimit: 0, totalReceivable: 0,
  isCredit: false, isCreditOrCash: false, approvedCreditDays: '', approvedCreditLimit: 0,
  creditLimitRules: [],
  notes: '', invoiceWarn: 'no-message', invoiceWarnMsg: '',
  appCode: '', customerType: '', inwardStrategy: '', pickStrategy: '', einNo: '',
  reportName: '', warehouseCode: '', warehouseCodes: [], operationAutoEmail: false,
  customerRefId: '', ccEmail: '', bccEmail: '', nifNo: '',
  meetingCount: 0, totalInvoiced: 0, totalBilled: 0, vendorBillCount: 0,
  addresses: [],
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

const OrganizationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'create';

  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [workflow, setWorkflow] = useState([]);

  const isCompany = form.companyType === 'company';
  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const [detail, wf] = await Promise.all([
        organizationsAPI.getById(id),
        organizationsAPI.workflow(id).catch(() => null),
      ]);
      setForm({ ...emptyForm, ...(detail.data?.data || {}) });
      setWorkflow(wf?.data?.data?.steps || []);
    } catch {
      toast.error('Failed to load organization');
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const { addresses, ...payload } = form;
      if (isNew) {
        const res = await organizationsAPI.create(payload);
        toast.success('Organization created');
        navigate(`/admin/organizations/${res.data.data.id}`, { replace: true });
      } else {
        await organizationsAPI.update(id, payload);
        toast.success('Organization saved');
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncPartner = async () => {
    if (isNew) { toast.error('Save the organization first'); return; }
    try {
      const res = await organizationsAPI.syncPartner(id);
      setForm((p) => ({ ...p, ...res.data.data }));
      toast.success('Partner synced');
    } catch {
      toast.error('Sync failed');
    }
  };

  const handleAddAddress = async () => {
    if (isNew) { toast.error('Save the organization first'); return; }
    try {
      const res = await organizationsAPI.addAddress(id, { addressType: 'other' });
      setForm((p) => ({ ...p, addresses: [...(p.addresses || []), res.data.data] }));
      toast.success('Address added');
    } catch {
      toast.error('Failed to add address');
    }
  };

  if (loading) return <PageLoader />;

  const statButtons = [
    { Icon: Calendar, value: form.meetingCount || 0, label: 'Meetings' },
    { Icon: FileText, value: Number(form.totalInvoiced || 0).toFixed(2), label: 'Invoiced' },
    { Icon: FileText, value: Number(form.totalBilled || 0).toFixed(2), label: 'Billed' },
    { Icon: Receipt, value: form.vendorBillCount || 0, label: 'Vendor Bills' },
  ];

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500">
        <button onClick={() => navigate('/admin/organizations')} className="text-blue-700 hover:underline">Organizations</button>
        {' / '}{isNew ? 'New' : form.name}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={() => navigate('/admin/organizations')}
          className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded"
        >
          <X className="w-4 h-4" /> Discard
        </button>
      </div>
      {/* Document-flow ribbon */}
      {!isNew && <WorkflowRibbon steps={workflow} organizationId={id} currentStep="customer" />}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <button
          onClick={handleSyncPartner}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded"
        >
          <RefreshCw className="w-4 h-4" /> Sync Partner
        </button>

        {/* KYC progress bar */}
        <div className="flex items-center">
          {KYC_STEPS.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setField('kycStatus', s.key)}
              className={`px-4 py-1.5 text-xs font-semibold border border-gray-200 transition-colors ${
                (form.kycStatus || 'new') === s.key
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'bg-white text-gray-500 hover:bg-gray-50'
              } ${i === 0 ? 'rounded-l' : ''} ${i === KYC_STEPS.length - 1 ? 'rounded-r' : ''}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl">
        {/* Stat buttons */}
        <div className="flex flex-wrap items-stretch justify-end border-b border-gray-200">
          {statButtons.map(({ Icon, value, label }) => (
            <div key={label} className="flex items-center gap-2 px-6 py-4 border-l border-gray-200">
              <Icon className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-semibold text-blue-700 leading-none">{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
          <a
            href={form.website || '#'}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-6 py-4 border-l border-gray-200 hover:bg-gray-50"
          >
            <Globe className="w-5 h-5 text-red-500" />
            <p className="text-xs text-gray-600 leading-tight">Go to<br />Website</p>
          </a>
        </div>

        <div className="p-6 space-y-5">
          {/* Individual / Company */}
          <div className="flex items-center gap-6">
            {[{ v: 'person', l: 'Individual' }, { v: 'company', l: 'Company' }].map(({ v, l }) => (
              <label key={v} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="companyType"
                  checked={form.companyType === v}
                  onChange={() => setField('companyType', v)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">{l}</span>
              </label>
            ))}
          </div>

          <div className="flex items-start gap-6">
            <div className="flex-1 space-y-3">
              <input
                className="w-full text-2xl font-semibold px-3 py-2 border border-gray-200 rounded bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                placeholder={isCompany ? 'e.g. Lumber Inc' : 'e.g. Brandom Freeman'}
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
              />
              {/* Company Name only shows on the Individual layout */}
              {!isCompany && (
                <input
                  className={inputClass}
                  placeholder="Company Name..."
                  value={form.companyName || ''}
                  onChange={(e) => setField('companyName', e.target.value)}
                />
              )}
            </div>
            <div className="w-28 h-28 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-300 flex-shrink-0">
              <Camera className="w-8 h-8" />
            </div>
          </div>

          {/* Two-column field grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-4">
            {/* Left */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="w-40 text-sm font-medium text-gray-700 flex-shrink-0">Mark As Default</span>
                <Toggle checked={!!form.markAsDefault} onChange={() => setField('markAsDefault', !form.markAsDefault)} />
              </div>

              <div className="flex items-start gap-4">
                <span className="w-40 text-sm font-medium text-gray-700 flex-shrink-0 pt-2">Address</span>
                <div className="flex-1 space-y-2">
                  <input className={inputClass} placeholder="Street Name..." value={form.streetName || ''} onChange={(e) => setField('streetName', e.target.value)} />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-12">House</span>
                    <input className={inputClass} value={form.houseNumber || ''} onChange={(e) => setField('houseNumber', e.target.value)} />
                    <span className="text-xs text-gray-500 w-10">Door</span>
                    <input className={inputClass} value={form.doorNumber || ''} onChange={(e) => setField('doorNumber', e.target.value)} />
                  </div>
                  <input className={inputClass} placeholder="Street 2..." value={form.street2 || ''} onChange={(e) => setField('street2', e.target.value)} />
                  <div className="grid grid-cols-3 gap-2">
                    <input className={inputClass} placeholder="State" value={form.state || ''} onChange={(e) => setField('state', e.target.value)} />
                    <input className={inputClass} placeholder="City" value={form.city || ''} onChange={(e) => setField('city', e.target.value)} />
                    <input className={inputClass} placeholder="ZIP" value={form.zip || ''} onChange={(e) => setField('zip', e.target.value)} />
                  </div>
                  <input className={inputClass} placeholder="Country" value={form.country || ''} onChange={(e) => setField('country', e.target.value)} />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="w-40 text-sm font-medium text-gray-700 flex-shrink-0">Identification Number</span>
                <div className="flex-1 flex gap-2">
                  <select className={inputClass} value={form.identificationType || 'VAT'} onChange={(e) => setField('identificationType', e.target.value)}>
                    {['VAT', 'GST', 'PAN', 'EIN', 'Passport'].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input className={inputClass} placeholder="Number" value={form.identificationNumber || ''} onChange={(e) => setField('identificationNumber', e.target.value)} />
                </div>
              </div>

              {[['vat', 'VAT'], ['pst', 'PST'], ['freightCarrier', 'Freight Carrier']].map(([key, label]) => (
                <div key={key} className="flex items-center gap-4">
                  <span className="w-40 text-sm font-medium text-gray-700 flex-shrink-0">{label}</span>
                  <input className={inputClass} value={form[key] || ''} onChange={(e) => setField(key, e.target.value)} />
                </div>
              ))}

              <div className="flex items-start gap-4">
                <span className="w-40 text-sm font-medium text-gray-700 flex-shrink-0 pt-2">Party Types</span>
                <div className="flex-1 space-y-2">
                  {(form.partyTypes || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {form.partyTypes.map((p) => (
                        <span key={p} className={`text-xs font-semibold px-2.5 py-1 rounded ${partyTypeClass(p)}`}>{p}</span>
                      ))}
                    </div>
                  )}
                  <input
                    className={inputClass}
                    placeholder="Comma separated, e.g. Customer, Shipper, Consignee"
                    value={(form.partyTypes || []).join(', ')}
                    onChange={(e) => setField('partyTypes', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                  />
                </div>
              </div>
            </div>

            {/* Right */}
            <div className="space-y-4">
              {/* Job Position and Title are Individual-only on the demo */}
              {!isCompany && (
                <div className="flex items-center gap-4">
                  <span className="w-40 text-sm font-medium text-gray-700 flex-shrink-0">Job Position</span>
                  <input className={inputClass} placeholder="e.g. Sales Director" value={form.jobPosition || ''} onChange={(e) => setField('jobPosition', e.target.value)} />
                </div>
              )}
              {[['phone', 'Phone'], ['mobile', 'Mobile'], ['fax', 'Fax'], ['email', 'Email']].map(([key, label]) => (
                <div key={key} className="flex items-center gap-4">
                  <span className="w-40 text-sm font-medium text-gray-700 flex-shrink-0">{label}</span>
                  <input className={inputClass} value={form[key] || ''} onChange={(e) => setField(key, e.target.value)} />
                </div>
              ))}
              <div className="flex items-center gap-4">
                <span className="w-40 text-sm font-medium text-gray-700 flex-shrink-0">Website</span>
                <input className={inputClass} placeholder="e.g. https://www.example.com" value={form.website || ''} onChange={(e) => setField('website', e.target.value)} />
              </div>
              {!isCompany && (
                <div className="flex items-center gap-4">
                  <span className="w-40 text-sm font-medium text-gray-700 flex-shrink-0">Title</span>
                  <select className={inputClass} value={form.title || ''} onChange={(e) => setField('title', e.target.value)}>
                    {TITLES.map((t) => <option key={t} value={t}>{t || 'e.g. Mister'}</option>)}
                  </select>
                </div>
              )}
              <div className="flex items-center gap-4">
                <span className="w-40 text-sm font-medium text-gray-700 flex-shrink-0">Language</span>
                <select className={inputClass} value={form.language || ''} onChange={(e) => setField('language', e.target.value)}>
                  {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-4">
                <span className="w-40 text-sm font-medium text-gray-700 flex-shrink-0">Tags</span>
                <input
                  className={inputClass}
                  placeholder="Tags..."
                  value={(form.tags || []).join(', ')}
                  onChange={(e) => setField('tags', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                />
              </div>
              <div className="flex items-center gap-4">
                <span className="w-40 text-sm font-medium text-gray-700 flex-shrink-0">Transaction Type</span>
                <select className={inputClass} value={form.transactionType || 'b2b'} onChange={(e) => setField('transactionType', e.target.value)}>
                  <option value="b2b">B2B</option>
                  <option value="b2c">B2C</option>
                </select>
              </div>
              {[['contactPerson', 'Contact Person'], ['govtRegNumber', 'Govt. Registration No.'], ['internalRefNo', 'Internal Reference No.']].map(([key, label]) => (
                <div key={key} className="flex items-center gap-4">
                  <span className="w-40 text-sm font-medium text-gray-700 flex-shrink-0">{label}</span>
                  <input className={inputClass} value={form[key] || ''} onChange={(e) => setField(key, e.target.value)} />
                </div>
              ))}
              <div className="flex items-center gap-4">
                <span className="w-40 text-sm font-medium text-gray-700 flex-shrink-0">Localization Country Code</span>
                <span className="text-sm text-gray-800">{form.localizationCountryCode || '-'}</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 flex flex-wrap gap-1 pt-4">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === t ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="pt-2">
            {activeTab === 'Addresses' && (
              <div className="space-y-3">
                <button onClick={handleAddAddress} className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded">
                  <Plus className="w-4 h-4" /> Add
                </button>
                {(form.addresses || []).length === 0 ? (
                  <p className="text-sm text-gray-400">No additional addresses</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {['Name', 'Type', 'Street', 'City', 'Country', ''].map((h) => (
                          <th key={h} className="text-left px-3 py-2 font-semibold text-gray-600 text-xs">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {form.addresses.map((a) => (
                        <tr key={a.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-700">{a.name}</td>
                          <td className="px-3 py-2 text-gray-600 text-xs">
                            {ADDRESS_TYPES.find((t) => t.value === a.addressType)?.label || a.addressType}
                          </td>
                          <td className="px-3 py-2 text-gray-600 text-xs">{a.streetName || '-'}</td>
                          <td className="px-3 py-2 text-gray-600 text-xs">{a.city || '-'}</td>
                          <td className="px-3 py-2 text-gray-600 text-xs">{a.country || '-'}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={async () => {
                                await organizationsAPI.delete(a.id);
                                setForm((p) => ({ ...p, addresses: p.addresses.filter((x) => x.id !== a.id) }));
                              }}
                              className="p-1 text-gray-400 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === 'Sales & Purchase' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
                <div className="space-y-4">
                  <h3 className="font-bold text-blue-700 text-sm">Sales</h3>
                  {[['salesperson', 'Salesperson'], ['salesTeam', 'Sales Team']].map(([k, l]) => (
                    <div key={k}><label className={labelClass}>{l}</label>
                      <input className={inputClass} value={form[k] || ''} onChange={(e) => setField(k, e.target.value)} /></div>
                  ))}
                  <h3 className="font-bold text-blue-700 text-sm pt-2">Fiscal Information</h3>
                  <div><label className={labelClass}>Fiscal Position</label>
                    <input className={inputClass} value={form.fiscalPosition || ''} onChange={(e) => setField('fiscalPosition', e.target.value)} /></div>
                </div>
                <div className="space-y-4">
                  <h3 className="font-bold text-blue-700 text-sm">Purchase</h3>
                  <div><label className={labelClass}>Payment Terms</label>
                    <input className={inputClass} value={form.supplierPaymentTerms || ''} onChange={(e) => setField('supplierPaymentTerms', e.target.value)} /></div>
                  <div className="flex items-center gap-3">
                    <Toggle checked={!!form.receiptReminder} onChange={() => setField('receiptReminder', !form.receiptReminder)} />
                    <span className="text-sm text-gray-700">Receipt Reminder</span>
                  </div>
                  <div><label className={labelClass}>Days Before Receipt</label>
                    <input type="number" className={inputClass} value={form.daysBeforeReceipt ?? ''} onChange={(e) => setField('daysBeforeReceipt', e.target.value)} /></div>
                  <div><label className={labelClass}>Supplier Currency</label>
                    <input className={inputClass} value={form.supplierCurrency || ''} onChange={(e) => setField('supplierCurrency', e.target.value)} /></div>
                  <h3 className="font-bold text-blue-700 text-sm pt-2">Misc</h3>
                  {[['reference', 'Reference'], ['company', 'Company'], ['industry', 'Industry']].map(([k, l]) => (
                    <div key={k}><label className={labelClass}>{l}</label>
                      <input className={inputClass} value={form[k] || ''} onChange={(e) => setField(k, e.target.value)} /></div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'Invoicing' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
                <div className="space-y-4">
                  <h3 className="font-bold text-blue-700 text-sm">Bank Accounts</h3>
                  <p className="text-sm text-gray-400">No bank accounts added</p>
                  <h3 className="font-bold text-blue-700 text-sm pt-2">Accounting Entries</h3>
                  {[['accountReceivable', 'Account Receivable'], ['accountPayable', 'Account Payable']].map(([k, l]) => (
                    <div key={k}><label className={labelClass}>{l}</label>
                      <input className={inputClass} value={form[k] || ''} onChange={(e) => setField(k, e.target.value)} /></div>
                  ))}
                </div>
                <div className="space-y-4">
                  <h3 className="font-bold text-blue-700 text-sm">Credit Limits</h3>
                  <div className="flex items-center gap-3">
                    <Toggle checked={!!form.showCreditLimit} onChange={() => setField('showCreditLimit', !form.showCreditLimit)} />
                    <span className="text-sm text-gray-700">Show Credit Limit</span>
                  </div>
                  <div><label className={labelClass}>Internal Credit Limit</label>
                    <input type="number" className={inputClass} value={form.internalCreditLimit ?? 0} onChange={(e) => setField('internalCreditLimit', e.target.value)} /></div>
                  <div><label className={labelClass}>Total Receivable</label>
                    <input type="number" className={inputClass} value={form.totalReceivable ?? 0} onChange={(e) => setField('totalReceivable', e.target.value)} /></div>
                </div>
              </div>
            )}

            {activeTab === 'Credit Limit' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
                <div className="space-y-4">
                  <h3 className="font-bold text-blue-700 text-sm">Organization - Shipment Module - Credit Limit</h3>
                  <div><label className={labelClass}>Total Receivable</label>
                    <input type="number" className={inputClass} value={form.totalReceivable ?? 0} onChange={(e) => setField('totalReceivable', e.target.value)} /></div>
                  <div className="flex items-center gap-3">
                    <Toggle checked={!!form.isCredit} onChange={() => setField('isCredit', !form.isCredit)} />
                    <span className="text-sm text-gray-700">Credit</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Toggle checked={!!form.isCreditOrCash} onChange={() => setField('isCreditOrCash', !form.isCreditOrCash)} />
                    <span className="text-sm text-gray-700">Non Credit or Cash</span>
                  </div>
                  <div><label className={labelClass}>Approved Credit Days</label>
                    <input type="number" className={inputClass} value={form.approvedCreditDays ?? ''} onChange={(e) => setField('approvedCreditDays', e.target.value)} /></div>
                  <div><label className={labelClass}>Approved Credit Limit</label>
                    <input type="number" className={inputClass} value={form.approvedCreditLimit ?? 0} onChange={(e) => setField('approvedCreditLimit', e.target.value)} /></div>
                </div>
                <div className="space-y-4">
                  <h3 className="font-bold text-blue-700 text-sm">Company Wise Credit Limit</h3>
                  <p className="text-sm text-gray-400">No company-wise credit limit rules</p>
                </div>
              </div>
            )}

            {activeTab === 'Internal Notes' && (
              <div className="space-y-4 max-w-2xl">
                <div><label className={labelClass}>Notes</label>
                  <textarea rows={5} className={inputClass} value={form.notes || ''} onChange={(e) => setField('notes', e.target.value)} /></div>
                <div><label className={labelClass}>Invoice</label>
                  <select className={inputClass} value={form.invoiceWarn || 'no-message'} onChange={(e) => setField('invoiceWarn', e.target.value)}>
                    {INVOICE_WARN.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select></div>
                {form.invoiceWarn !== 'no-message' && (
                  <div><label className={labelClass}>Message for Invoice</label>
                    <textarea rows={3} className={inputClass} value={form.invoiceWarnMsg || ''} onChange={(e) => setField('invoiceWarnMsg', e.target.value)} /></div>
                )}
              </div>
            )}

            {activeTab === 'WMS Invoice Integration' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4">
                <div className="space-y-4">
                  <div><label className={labelClass}>App Code</label>
                    <input className={inputClass} value={form.appCode || ''} onChange={(e) => setField('appCode', e.target.value)} /></div>
                  <div><label className={labelClass}>Customer</label>
                    <select className={inputClass} value={form.customerType || ''} onChange={(e) => setField('customerType', e.target.value)}>
                      <option value=""></option>
                      <option value="billing">Biiling</option>
                      <option value="consignee">Consignee</option>
                    </select></div>
                  <div><label className={labelClass}>Inward Strategy</label>
                    <select className={inputClass} value={form.inwardStrategy || ''} onChange={(e) => setField('inwardStrategy', e.target.value)}>
                      {STRATEGIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select></div>
                  <div><label className={labelClass}>Pick Strategy</label>
                    <select className={inputClass} value={form.pickStrategy || ''} onChange={(e) => setField('pickStrategy', e.target.value)}>
                      {STRATEGIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select></div>
                  {[['einNo', 'EIN NO'], ['reportName', 'Reports Name'], ['warehouseCode', 'Warehouse Code']].map(([k, l]) => (
                    <div key={k}><label className={labelClass}>{l}</label>
                      <input className={inputClass} value={form[k] || ''} onChange={(e) => setField(k, e.target.value)} /></div>
                  ))}
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 pt-6">
                    <Toggle checked={!!form.operationAutoEmail} onChange={() => setField('operationAutoEmail', !form.operationAutoEmail)} />
                    <span className="text-sm text-gray-700">Operation Auto Email</span>
                  </div>
                  {[['customerRefId', 'Customer Reference ID'], ['ccEmail', 'CC Email'], ['bccEmail', 'BCC Email'], ['nifNo', 'NIFNO']].map(([k, l]) => (
                    <div key={k}><label className={labelClass}>{l}</label>
                      <input className={inputClass} value={form[k] || ''} onChange={(e) => setField(k, e.target.value)} /></div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {!isNew && (
        <OrganizationChatter
          organizationId={id}
          entries={form.activityLog || []}
          followerCount={form.followerCount || 0}
          onPosted={(entry) => setForm((p) => ({ ...p, activityLog: [entry, ...(p.activityLog || [])] }))}
        />
      )}
    </div>
  );
};

export default OrganizationDetail;
