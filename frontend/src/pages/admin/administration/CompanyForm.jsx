import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Image, Plus } from 'lucide-react';
import { companiesAPI, usersAPI } from '../../../services/api';
import LoadingSpinner from '../../../common/LoadingSpinner';
import toast from 'react-hot-toast';

const TABS = [
  { key: 'general', label: 'General Information' },
  { key: 'registration', label: 'Registration/Tax Info' },
  { key: 'restrict', label: 'Restrict Document' },
];

const RESTRICT_DOCS = [
  'Commercial Invoice',
  'Packing List',
  'Bill of Lading',
  'Certificate of Origin',
  'Insurance Certificate',
  'Customs Declaration',
];

const emptyForm = {
  name: '',
  code: '',
  unlocode: '',
  timezone: '',
  addressLine2: '',
  houseNumber: '',
  doorNumber: '',
  address: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  currency: 'AED',
  phone: '',
  mobile: '',
  email: '',
  website: '',
  customerType: '',
  parentCompanyId: '',
  favicon: '',
  agentId: '',
  tourismTaxRegNo: '',
  miscCode: '',
  taxRegistrationNumber: '',
  vatNumber: '',
  restrictedDocuments: [],
  logo: '',
};

const CompanyForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);

  const fetchOptions = useCallback(async () => {
    try {
      const [companiesRes, usersRes] = await Promise.all([
        companiesAPI.getAll({ limit: 100 }),
        usersAPI.getAll({ limit: 100 }),
      ]);
      setCompanies(companiesRes.data.data || []);
      setUsers(usersRes.data.data || []);
    } catch {
      setCompanies([]);
      setUsers([]);
    }
  }, []);

  const fetchCompany = useCallback(async () => {
    if (!isEdit) return;
    setLoading(true);
    try {
      const response = await companiesAPI.getById(id);
      const c = response.data.data;
      setForm({
        ...emptyForm,
        ...c,
        parentCompanyId: c.parentCompanyId || '',
        agentId: c.agentId || '',
        restrictedDocuments: c.restrictedDocuments || [],
      });
    } catch {
      toast.error('Failed to load company');
    } finally {
      setLoading(false);
    }
  }, [id, isEdit]);

  useEffect(() => { fetchOptions(); }, [fetchOptions]);
  useEffect(() => { fetchCompany(); }, [fetchCompany]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleRestrictedDoc = (doc) => {
    setForm((prev) => {
      const list = prev.restrictedDocuments || [];
      return {
        ...prev,
        restrictedDocuments: list.includes(doc) ? list.filter((d) => d !== doc) : [...list, doc],
      };
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Company Name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      ['parentCompanyId', 'agentId'].forEach((f) => {
        if (!payload[f]) payload[f] = null;
      });
      if (isEdit) {
        await companiesAPI.update(id, payload);
        toast.success('Company updated');
      } else {
        await companiesAPI.create(payload);
        toast.success('Company created');
      }
      navigate('/admin/administration/companies');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to save company');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    navigate('/admin/administration/companies');
  };

  if (loading) {
    return <div className="py-16"><LoadingSpinner /></div>;
  }

  const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent";
  const labelClass = "block text-xs font-medium text-slate-500 mb-1";

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">Companies / {isEdit ? (form.name || 'Edit') : 'New'}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleDiscard}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Discard
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-6">
        {/* Company name + logo */}
        <div className="flex items-start justify-between gap-4">
          <input
            type="text"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="e.g. My Company"
            className="w-full max-w-xl text-2xl font-semibold border-0 border-b-2 border-slate-200 focus:border-primary-500 focus:ring-0 px-0 py-2 placeholder-slate-300"
          />
          <button
            onClick={() => toast('Upload coming soon')}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 whitespace-nowrap"
          >
            <Image className="w-4 h-4" /> Your logo
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-100">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.key
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* General Information */}
        {activeTab === 'general' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {/* LEFT column */}
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Code</label>
                <input type="text" value={form.code || ''} onChange={(e) => handleChange('code', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Un/Locode</label>
                <select value={form.unlocode || ''} onChange={(e) => handleChange('unlocode', e.target.value)} className={inputClass}>
                  <option value="">Select...</option>
                  <option value="AEDXB">AEDXB - Dubai</option>
                  <option value="AEAUH">AEAUH - Abu Dhabi</option>
                  <option value="USNYC">USNYC - New York</option>
                  <option value="SGSIN">SGSIN - Singapore</option>
                  <option value="GBLON">GBLON - London</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Time Zone</label>
                <select value={form.timezone || ''} onChange={(e) => handleChange('timezone', e.target.value)} className={inputClass}>
                  <option value="">Select...</option>
                  <option value="Asia/Dubai">Asia/Dubai (GMT+4)</option>
                  <option value="Asia/Singapore">Asia/Singapore (GMT+8)</option>
                  <option value="Europe/London">Europe/London (GMT+0)</option>
                  <option value="America/New_York">America/New_York (GMT-5)</option>
                </select>
              </div>

              {/* Address block */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className={labelClass}>Address</label>
                <input type="text" value={form.address || ''} onChange={(e) => handleChange('address', e.target.value)} placeholder="Street Name" className={inputClass} />
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={form.houseNumber || ''} onChange={(e) => handleChange('houseNumber', e.target.value)} placeholder="House Number" className={inputClass} />
                  <input type="text" value={form.doorNumber || ''} onChange={(e) => handleChange('doorNumber', e.target.value)} placeholder="Door Number" className={inputClass} />
                </div>
                <input type="text" value={form.addressLine2 || ''} onChange={(e) => handleChange('addressLine2', e.target.value)} placeholder="Street 2" className={inputClass} />
                <div className="grid grid-cols-3 gap-2">
                  <input type="text" value={form.city || ''} onChange={(e) => handleChange('city', e.target.value)} placeholder="City" className={inputClass} />
                  <input type="text" value={form.state || ''} onChange={(e) => handleChange('state', e.target.value)} placeholder="State" className={inputClass} />
                  <input type="text" value={form.postalCode || ''} onChange={(e) => handleChange('postalCode', e.target.value)} placeholder="ZIP" className={inputClass} />
                </div>
                <select value={form.country || ''} onChange={(e) => handleChange('country', e.target.value)} className={inputClass}>
                  <option value="">Country</option>
                  <option value="United Arab Emirates">United Arab Emirates</option>
                  <option value="United States">United States</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Singapore">Singapore</option>
                  <option value="Germany">Germany</option>
                  <option value="India">India</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Currency</label>
                <select value={form.currency || 'AED'} onChange={(e) => handleChange('currency', e.target.value)} className={inputClass}>
                  <option value="AED">AED</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="SGD">SGD</option>
                  <option value="INR">INR</option>
                </select>
              </div>
            </div>

            {/* RIGHT column */}
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Phone</label>
                <input type="text" value={form.phone || ''} onChange={(e) => handleChange('phone', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Mobile</label>
                <input type="text" value={form.mobile || ''} onChange={(e) => handleChange('mobile', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input type="email" value={form.email || ''} onChange={(e) => handleChange('email', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Website</label>
                <input type="text" value={form.website || ''} onChange={(e) => handleChange('website', e.target.value)} placeholder="e.g. https://www.odoo.com" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Customer Type</label>
                <select value={form.customerType || ''} onChange={(e) => handleChange('customerType', e.target.value)} className={inputClass}>
                  <option value="">Select...</option>
                  <option value="individual">Individual</option>
                  <option value="company">Company</option>
                  <option value="agent">Agent</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Parent Company</label>
                <select value={form.parentCompanyId || ''} onChange={(e) => handleChange('parentCompanyId', e.target.value)} className={inputClass}>
                  <option value="">None</option>
                  {companies.filter((c) => c.id !== id).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Company Favicon</label>
                <button
                  onClick={() => toast('Upload coming soon')}
                  className="w-16 h-16 flex items-center justify-center border-2 border-dashed border-slate-300 rounded-lg text-slate-400 hover:border-primary-400 hover:text-primary-500"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>
              <div>
                <label className={labelClass}>Agent</label>
                <select value={form.agentId || ''} onChange={(e) => handleChange('agentId', e.target.value)} className={inputClass}>
                  <option value="">None</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Tourism Tax Reg No</label>
                <input type="text" value={form.tourismTaxRegNo || ''} onChange={(e) => handleChange('tourismTaxRegNo', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>MISC Code</label>
                <select value={form.miscCode || ''} onChange={(e) => handleChange('miscCode', e.target.value)} className={inputClass}>
                  <option value="">Select...</option>
                  <option value="MISC1">MISC1</option>
                  <option value="MISC2">MISC2</option>
                  <option value="MISC3">MISC3</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Registration/Tax Info */}
        {activeTab === 'registration' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 max-w-2xl">
            <div>
              <label className={labelClass}>Tax Registration Number</label>
              <input type="text" value={form.taxRegistrationNumber || ''} onChange={(e) => handleChange('taxRegistrationNumber', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>VAT Number</label>
              <input type="text" value={form.vatNumber || ''} onChange={(e) => handleChange('vatNumber', e.target.value)} className={inputClass} />
            </div>
          </div>
        )}

        {/* Restrict Document */}
        {activeTab === 'restrict' && (
          <div className="space-y-3 max-w-xl">
            <p className="text-sm text-slate-500">Select documents to restrict for this company.</p>
            {RESTRICT_DOCS.map((doc) => (
              <label key={doc} className="flex items-center gap-3 px-3 py-2 border border-slate-100 rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={(form.restrictedDocuments || []).includes(doc)}
                  onChange={() => toggleRestrictedDoc(doc)}
                  className="rounded border-slate-300"
                />
                <span className="text-sm text-slate-700">{doc}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyForm;
