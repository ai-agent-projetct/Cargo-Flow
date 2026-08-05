import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Settings as SettingsIcon, Camera, X } from 'lucide-react';
import { usersAPI, companiesAPI, departmentsAPI } from '../../../services/api';
import { PageLoader } from '../../../common/LoadingSpinner';
import toast from 'react-hot-toast';
import {
  ROLE_OPTIONS,
  ACCESS_RIGHT_ROWS,
  OTHER_FULL_ROWS,
  OTHER_CHECKBOXES,
} from './accessRightsFields';

const LANGUAGE_OPTIONS = ['English (US)', 'English (UK)', 'Spanish / Español', 'French / Français', 'Arabic'];
const TIMEZONE_OPTIONS = ['Asia/Dubai', 'Asia/Manila', 'Asia/Kolkata', 'Europe/London', 'America/New_York', 'Asia/Shanghai'];
const SHIPMENT_TYPE_OPTIONS = ['', 'Import', 'Export', 'Domestic', 'Cross Trade'];
const CARGO_TYPE_OPTIONS = ['', 'FCL', 'LCL', 'Air', 'Bulk', 'RoRo'];
const TRANSPORT_MODE_OPTIONS = ['', 'Sea Freight', 'Air Freight', 'Land Freight', 'Rail Freight'];

const TABS = [
  { key: 'access', label: 'Access Rights' },
  { key: 'preferences', label: 'Preferences' },
  { key: 'customs', label: 'Customs Broker Details' },
];

const emptyForm = {
  name: '',
  email: '',
  allowedCompanyIds: [],
  defaultCompanyId: '',
  departmentId: '',
  creditLimitSetup: {},
  creditLimitApproval: {},
  quotationApproval: {},
  accessRights: {},
  otherPermissions: {},
  preferences: {},
  customsBroker: {},
};

const UserDetail = ({ basePath = '/admin/administration/users' }) => {
  const navigate = useNavigate();
  const { id } = useParams();

  const [form, setForm] = useState(emptyForm);
  const [department, setDepartment] = useState(null);
  const [allowedCompanies, setAllowedCompanies] = useState([]);
  const [defaultCompany, setDefaultCompany] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('never_connected');
  const [resetLink, setResetLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('access');
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);

  const fetchOptions = useCallback(async () => {
    try {
      const [companiesRes, departmentsRes, usersRes] = await Promise.all([
        companiesAPI.getAll({ limit: 200 }),
        departmentsAPI.getAll({ limit: 200 }),
        usersAPI.getAll({ limit: 1000 }),
      ]);
      setCompanies(companiesRes.data.data || []);
      setDepartments(departmentsRes.data.data || []);
      setAllUsers(usersRes.data.data || []);
    } catch {
      // best-effort
    }
  }, []);

  const fetchUser = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersAPI.getById(id);
      const u = res.data.data;
      setForm({
        name: u.name || '',
        email: u.email || '',
        allowedCompanyIds: u.allowedCompanyIds || [],
        defaultCompanyId: u.defaultCompanyId || '',
        departmentId: u.departmentId || '',
        creditLimitSetup: u.creditLimitSetup || {},
        creditLimitApproval: u.creditLimitApproval || {},
        quotationApproval: u.quotationApproval || {},
        accessRights: u.accessRights || {},
        otherPermissions: u.otherPermissions || {},
        preferences: u.preferences || {},
        customsBroker: u.customsBroker || {},
      });
      setDepartment(u.department || null);
      setAllowedCompanies(u.allowedCompanies || []);
      setDefaultCompany(u.defaultCompany || null);
      setConnectionStatus(u.connectionStatus || 'never_connected');
    } catch {
      toast.error('Failed to load user');
    } finally {
      setLoading(false);
      setEditing(false);
    }
  }, [id]);

  useEffect(() => { fetchOptions(); }, [fetchOptions]);
  useEffect(() => { fetchUser(); setResetLink(null); }, [fetchUser]);

  const setRight = (key, value) => {
    setForm((p) => ({ ...p, accessRights: { ...p.accessRights, [key]: value } }));
  };
  const toggleOther = (key) => {
    setForm((p) => ({ ...p, otherPermissions: { ...p.otherPermissions, [key]: !p.otherPermissions?.[key] } }));
  };
  const setPref = (key, value) => {
    setForm((p) => ({ ...p, preferences: { ...p.preferences, [key]: value } }));
  };
  const setCreditSetup = (key, value) => {
    setForm((p) => ({ ...p, creditLimitSetup: { ...p.creditLimitSetup, [key]: value } }));
  };
  const setCreditApproval = (key, value) => {
    setForm((p) => ({ ...p, creditLimitApproval: { ...p.creditLimitApproval, [key]: value } }));
  };
  const setQuotationApproval = (key, value) => {
    setForm((p) => ({ ...p, quotationApproval: { ...p.quotationApproval, [key]: value } }));
  };
  const toggleCustomsBroker = () => {
    setForm((p) => ({ ...p, customsBroker: { ...p.customsBroker, isCustomsBroker: !p.customsBroker?.isCustomsBroker } }));
  };

  const toggleAllowedCompany = (companyId) => {
    setForm((p) => {
      const exists = p.allowedCompanyIds.includes(companyId);
      const next = exists ? p.allowedCompanyIds.filter((i) => i !== companyId) : [...p.allowedCompanyIds, companyId];
      return { ...p, allowedCompanyIds: next };
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      await usersAPI.update(id, form);
      toast.success('User updated');
      await fetchUser();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    fetchUser();
  };

  const handleSendPasswordReset = async () => {
    try {
      const fakeToken = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      setResetLink(`https://demo.searates.tech/web/reset_password?db=demo-db&token=${fakeToken}`);
      toast.success('Password reset instructions sent');
    } catch {
      toast.error('Failed to send reset instructions');
    }
  };

  // Pagination
  const currentIndex = allUsers.findIndex((u) => u.id === id);
  const total = allUsers.length;
  const goToOffset = (offset) => {
    if (currentIndex === -1) return;
    const target = allUsers[currentIndex + offset];
    if (target) navigate(`${basePath}/${target.id}`);
  };

  if (loading) return <PageLoader />;

  const inputClass = "w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent";

  const renderValueCell = (key) => {
    if (!key) return <div />;
    const value = form.accessRights?.[key] || '';
    if (editing) {
      return (
        <select value={value} onChange={(e) => setRight(key, e.target.value)} className={inputClass}>
          {ROLE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt || '—'}</option>)}
        </select>
      );
    }
    return <span className="text-sm text-slate-700">{value}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-slate-500">
          <button onClick={() => navigate(basePath)} className="text-primary-600 hover:underline">Users</button>
          {' / '}{form.name}
        </p>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={handleDiscard} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 font-medium">
                Discard
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium">
                Edit
              </button>
              <button onClick={() => toast('No actions available')} className="flex items-center gap-1.5 px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 font-medium">
                <SettingsIcon className="w-3.5 h-3.5" /> Action
              </button>
              {total > 0 && currentIndex !== -1 && (
                <div className="flex items-center gap-1 ml-2 text-sm text-slate-500">
                  <span>{currentIndex + 1} / {total}</span>
                  <button onClick={() => goToOffset(-1)} disabled={currentIndex <= 0} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => goToOffset(1)} disabled={currentIndex >= total - 1} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Secondary toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2 bg-white rounded-xl shadow-sm border border-slate-100 px-4 py-2">
        <div className="flex items-center gap-2">
          <button onClick={handleSendPasswordReset} className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
            Send Password Reset Instructions
          </button>
          <button onClick={() => navigate('/admin/administration/departments/create')} className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
            Create New Department
          </button>
          <button onClick={() => toast('Employee creation coming soon')} className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
            Create employee
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{connectionStatus === 'confirmed' ? 'Last connected' : 'Never Connected'}</span>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${connectionStatus === 'confirmed' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
            {connectionStatus === 'confirmed' ? 'Confirmed' : 'Pending'}
          </span>
        </div>
      </div>

      {/* Reset password banner */}
      {resetLink && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-start justify-between gap-2">
          <p className="text-sm text-green-800">
            A password reset has been requested for this user. An email containing the following link has been sent:{' '}
            <a href={resetLink} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline break-all">{resetLink}</a>
          </p>
          <button onClick={() => setResetLink(null)} className="text-green-600 hover:text-green-800 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 max-w-md space-y-3">
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Name</p>
              {editing ? (
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 text-2xl font-bold border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              ) : (
                <h2 className="text-2xl font-bold text-slate-900">{form.name}</h2>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Email Address</p>
              {editing ? (
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  className={inputClass}
                />
              ) : (
                <p className="text-sm font-semibold text-slate-700">{form.email}</p>
              )}
            </div>
          </div>
          <div className="w-24 h-24 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300 flex-shrink-0">
            <Camera className="w-8 h-8" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${activeTab === tab.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'access' && (
          <div className="space-y-6">
            {/* Multi Companies */}
            <div>
              <h3 className="text-blue-600 font-bold text-base mb-2 border-b border-slate-100 pb-1">Multi Companies</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-2">
                <div className="grid grid-cols-2 gap-2 items-start py-1 relative">
                  <span className="text-sm font-medium text-slate-700 pt-1.5">Allowed Companies</span>
                  {editing ? (
                    <div className="relative">
                      <button type="button" onClick={() => setCompanyDropdownOpen((o) => !o)} className={`${inputClass} text-left flex flex-wrap gap-1 min-h-[34px]`}>
                        {form.allowedCompanyIds.length === 0 && <span className="text-slate-400">Select companies</span>}
                        {form.allowedCompanyIds.map((cid) => {
                          const c = companies.find((x) => x.id === cid);
                          return <span key={cid} className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full">{c?.name || cid}</span>;
                        })}
                      </button>
                      {companyDropdownOpen && (
                        <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
                          {companies.map((c) => (
                            <label key={c.id} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 cursor-pointer">
                              <input type="checkbox" checked={form.allowedCompanyIds.includes(c.id)} onChange={() => toggleAllowedCompany(c.id)} className="rounded border-slate-300" />
                              {c.name}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {allowedCompanies.length === 0 && <span className="text-sm text-slate-400">—</span>}
                      {allowedCompanies.map((c) => (
                        <span key={c.id} className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full border border-slate-200">{c.name}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
                <div className="grid grid-cols-2 gap-2 items-center py-1">
                  <span className="text-sm font-medium text-slate-700">Default Company</span>
                  {editing ? (
                    <select value={form.defaultCompanyId} onChange={(e) => setForm((p) => ({ ...p, defaultCompanyId: e.target.value }))} className={inputClass}>
                      <option value="">—</option>
                      {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  ) : (
                    <span className="text-sm text-slate-700">{defaultCompany?.name || '—'}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 items-center py-1">
                  <span className="text-sm font-medium text-slate-700">Department</span>
                  {editing ? (
                    <select value={form.departmentId} onChange={(e) => setForm((p) => ({ ...p, departmentId: e.target.value }))} className={inputClass}>
                      <option value="">—</option>
                      {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  ) : department ? (
                    <button onClick={() => navigate(`/admin/administration/departments/${department.id}`)} className="text-sm text-primary-600 hover:underline text-left">
                      {department.name}
                    </button>
                  ) : (
                    <span className="text-sm text-slate-400">—</span>
                  )}
                </div>
              </div>
            </div>

            {/* Credit Limit Request Setup */}
            <div>
              <h3 className="text-blue-600 font-bold text-base mb-2 border-b border-slate-100 pb-1">Credit Limit Request Setup</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
                <div className="grid grid-cols-2 gap-2 items-center py-1">
                  <span className="text-sm font-medium text-slate-700">Shipment Type</span>
                  {editing ? (
                    <select value={form.creditLimitSetup.shipmentType || ''} onChange={(e) => setCreditSetup('shipmentType', e.target.value)} className={inputClass}>
                      {SHIPMENT_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o || '—'}</option>)}
                    </select>
                  ) : (
                    <span className="text-sm text-slate-700">{form.creditLimitSetup.shipmentType || '—'}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 items-center py-1">
                  <span className="text-sm font-medium text-slate-700">Transport Mode</span>
                  {editing ? (
                    <select value={form.creditLimitSetup.transportMode || ''} onChange={(e) => setCreditSetup('transportMode', e.target.value)} className={inputClass}>
                      {TRANSPORT_MODE_OPTIONS.map((o) => <option key={o} value={o}>{o || '—'}</option>)}
                    </select>
                  ) : (
                    <span className="text-sm text-slate-700">{form.creditLimitSetup.transportMode || '—'}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 items-center py-1">
                  <span className="text-sm font-medium text-slate-700">Cargo Type</span>
                  {editing ? (
                    <select value={form.creditLimitSetup.cargoType || ''} onChange={(e) => setCreditSetup('cargoType', e.target.value)} className={inputClass}>
                      {CARGO_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o || '—'}</option>)}
                    </select>
                  ) : (
                    <span className="text-sm text-slate-700">{form.creditLimitSetup.cargoType || '—'}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Credit Limit Approval */}
            <div>
              <h3 className="text-blue-600 font-bold text-base mb-2 border-b border-slate-100 pb-1">Credit Limit Approval</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
                <div className="grid grid-cols-2 gap-2 items-center py-1">
                  <span className="text-sm font-medium text-slate-700">Is Approval Authority</span>
                  <input type="checkbox" checked={!!form.creditLimitApproval.isApprovalAuthority} disabled={!editing}
                    onChange={(e) => setCreditApproval('isApprovalAuthority', e.target.checked)} className="rounded border-slate-300 justify-self-start" />
                </div>
                <div className="grid grid-cols-2 gap-2 items-center py-1">
                  <span className="text-sm font-medium text-slate-700">Manager/Document Approver</span>
                  {editing ? (
                    <select value={form.creditLimitApproval.managerApproverId || ''} onChange={(e) => setCreditApproval('managerApproverId', e.target.value)} className={inputClass}>
                      <option value="">—</option>
                      {allUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  ) : (
                    <span className="text-sm text-slate-700">{allUsers.find((u) => u.id === form.creditLimitApproval.managerApproverId)?.name || '—'}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Quotation Approval */}
            <div>
              <h3 className="text-blue-600 font-bold text-base mb-2 border-b border-slate-100 pb-1">Quotation Approval</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
                <div className="grid grid-cols-2 gap-2 items-center py-1">
                  <span className="text-sm font-medium text-slate-700">Is Approval Authority</span>
                  <input type="checkbox" checked={!!form.quotationApproval.isApprovalAuthority} disabled={!editing}
                    onChange={(e) => setQuotationApproval('isApprovalAuthority', e.target.checked)} className="rounded border-slate-300 justify-self-start" />
                </div>
              </div>
            </div>

            {/* Access Rights matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
              {ACCESS_RIGHT_ROWS.map((pair, i) => (
                <React.Fragment key={i}>
                  {pair.map((cell, j) => (
                    <div key={j} className="py-1.5">
                      {cell.group && (
                        <h3 className="text-blue-600 font-bold text-base mb-1 mt-2 border-b border-slate-100 pb-1">{cell.group}</h3>
                      )}
                      {cell.label && (
                        <div className="grid grid-cols-2 gap-2 items-center py-1">
                          <span className="text-sm font-medium text-slate-700">{cell.label}</span>
                          {renderValueCell(cell.key)}
                        </div>
                      )}
                    </div>
                  ))}
                </React.Fragment>
              ))}

              <div className="md:col-span-2">
                <h3 className="text-blue-600 font-bold text-base mb-1 mt-2 border-b border-slate-100 pb-1">Other</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
                  {OTHER_FULL_ROWS.map((row) => (
                    <div key={row.key} className="grid grid-cols-2 gap-2 items-center py-1">
                      <span className="text-sm font-medium text-slate-700">{row.label}</span>
                      {renderValueCell(row.key)}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200">
              <h3 className="text-blue-600 font-bold text-base mb-3">Other</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-2">
                {OTHER_CHECKBOXES.map((pair, i) => (
                  <React.Fragment key={i}>
                    {pair.map((item) => (
                      <label key={item.key} className="flex items-center justify-between gap-2 py-1 cursor-pointer">
                        <span className="text-sm text-slate-700">{item.label}</span>
                        <input
                          type="checkbox"
                          checked={!!form.otherPermissions?.[item.key]}
                          onChange={() => editing && toggleOther(item.key)}
                          disabled={!editing}
                          className="rounded border-slate-300"
                        />
                      </label>
                    ))}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'preferences' && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <h3 className="text-blue-600 font-bold text-base mb-2 border-b border-slate-100 pb-1">Localization</h3>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 items-center py-1">
                  <span className="text-sm font-medium text-slate-700">Language</span>
                  {editing ? (
                    <select value={form.preferences.language || 'English (US)'} onChange={(e) => setPref('language', e.target.value)} className={inputClass}>
                      {LANGUAGE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <span className="text-sm text-slate-700">{form.preferences.language || 'English (US)'}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 items-center py-1">
                  <span className="text-sm font-medium text-slate-700">Timezone</span>
                  {editing ? (
                    <select value={form.preferences.timezone || 'Asia/Dubai'} onChange={(e) => setPref('timezone', e.target.value)} className={inputClass}>
                      {TIMEZONE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <span className="text-sm text-slate-700">{form.preferences.timezone || 'Asia/Dubai'}</span>
                  )}
                </div>
              </div>
            </div>

            <div>
              <div className="grid grid-cols-2 gap-2 items-start py-1">
                <span className="text-sm font-medium text-slate-700">Notification</span>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input type="radio" name="notification" disabled={!editing}
                      checked={(form.preferences.notification || 'email') === 'email'}
                      onChange={() => setPref('notification', 'email')} />
                    Handle by Emails
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input type="radio" name="notification" disabled={!editing}
                      checked={form.preferences.notification === 'system'}
                      onChange={() => setPref('notification', 'system')} />
                    Handle in System
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 items-center py-1">
                <span className="text-sm font-medium text-slate-700">Email Signature</span>
                {editing ? (
                  <textarea value={form.preferences.emailSignature || ''} onChange={(e) => setPref('emailSignature', e.target.value)} className={inputClass} rows={2} />
                ) : (
                  <span className="text-sm text-slate-700">{form.preferences.emailSignature || '—'}</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 items-center py-1">
                <span className="text-sm font-medium text-slate-700">Karma</span>
                <span className="text-sm text-slate-700">{form.preferences.karma || 0}</span>
              </div>
            </div>

            <div>
              <h3 className="text-blue-600 font-bold text-base mb-2 border-b border-slate-100 pb-1">Livechat</h3>
              <div className="grid grid-cols-2 gap-2 items-center py-1">
                <span className="text-sm font-medium text-slate-700">Livechat Username</span>
                {editing ? (
                  <input type="text" value={form.preferences.livechatUsername || ''} onChange={(e) => setPref('livechatUsername', e.target.value)} className={inputClass} />
                ) : (
                  <span className="text-sm text-slate-700">{form.preferences.livechatUsername || '—'}</span>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'customs' && (
          <div className="max-w-2xl">
            <div className="grid grid-cols-2 gap-2 items-center py-1">
              <span className="text-sm font-medium text-slate-700">Is Customs Broker?</span>
              <button
                type="button"
                onClick={() => editing && toggleCustomsBroker()}
                className="inline-flex justify-self-start"
              >
                <span className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-colors ${form.customsBroker.isCustomsBroker ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'}`}>
                  <span className="w-4 h-4 bg-white rounded-full shadow" />
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserDetail;
