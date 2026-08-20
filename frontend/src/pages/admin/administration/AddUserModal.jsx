import React, { useState, useEffect, useCallback } from 'react';
import { Camera } from 'lucide-react';
import { usersAPI, companiesAPI, departmentsAPI } from '../../../services/api';
import toast from 'react-hot-toast';

const emptyForm = {
  name: '',
  email: '',
  allowedCompanyIds: [],
  defaultCompanyId: '',
  departmentId: '',
  isApprovalAuthority: false,
  managerApproverId: '',
};

const AddUserModal = ({ isOpen, onClose, onCreated, defaultCompanyId }) => {
  const [form, setForm] = useState(emptyForm);
  const [companies, setCompanies] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);

  const fetchOptions = useCallback(async () => {
    try {
      const [companiesRes, departmentsRes, usersRes] = await Promise.all([
        companiesAPI.getAll({ limit: 200 }),
        departmentsAPI.getAll({ limit: 200 }),
        usersAPI.getAll({ limit: 500 }),
      ]);
      setCompanies(companiesRes.data.data || []);
      setDepartments(departmentsRes.data.data || []);
      setUsers(usersRes.data.data || []);
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchOptions();
      setForm({
        ...emptyForm,
        allowedCompanyIds: defaultCompanyId ? [defaultCompanyId] : [],
        defaultCompanyId: defaultCompanyId || '',
      });
    }
  }, [isOpen, fetchOptions, defaultCompanyId]);

  if (!isOpen) return null;

  const toggleCompany = (id) => {
    setForm((p) => {
      const exists = p.allowedCompanyIds.includes(id);
      return { ...p, allowedCompanyIds: exists ? p.allowedCompanyIds.filter((x) => x !== id) : [...p.allowedCompanyIds, id] };
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!form.email.trim()) { toast.error('Email is required'); return; }
    setSaving(true);
    try {
      const res = await usersAPI.create({
        name: form.name,
        email: form.email,
        allowedCompanyIds: form.allowedCompanyIds,
        defaultCompanyId: form.defaultCompanyId || null,
        departmentId: form.departmentId || null,
        creditLimitApproval: { isApprovalAuthority: form.isApprovalAuthority, managerApproverId: form.managerApproverId || null },
      });
      toast.success('User invited');
      onCreated?.(res.data.data);
      onClose();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-xl font-bold text-blue-600">CargoFlo</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-blue-50 text-blue-800 text-sm rounded-lg px-4 py-2 text-center">
            You are inviting a new user.
          </div>

          <div className="flex items-start gap-4">
            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input type="text" placeholder="e.g. John Doe" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <input type="email" placeholder="e.g. email@yourcompany.com" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className={inputClass} />
              </div>
            </div>
            <div className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300 flex-shrink-0">
              <Camera className="w-7 h-7" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <div>
              <h3 className="text-blue-600 font-bold text-base mb-2 border-b border-slate-100 pb-1">Allowed Companies and Branches</h3>
              <label className="block text-sm font-medium text-slate-700 mb-1">Allowed Companies</label>
              <div className="relative">
                <button type="button" onClick={() => setCompanyDropdownOpen((o) => !o)} className={`${inputClass} text-left flex flex-wrap gap-1 min-h-[40px]`}>
                  {form.allowedCompanyIds.length === 0 && <span className="text-slate-400">Select companies</span>}
                  {form.allowedCompanyIds.map((cid) => {
                    const c = companies.find((x) => x.id === cid);
                    return <span key={cid} className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full">{c?.name || cid} ✕</span>;
                  })}
                </button>
                {companyDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
                    {companies.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 cursor-pointer">
                        <input type="checkbox" checked={form.allowedCompanyIds.includes(c.id)} onChange={() => toggleCompany(c.id)} className="rounded border-slate-300" />
                        {c.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-blue-600 font-bold text-base mb-2 border-b border-slate-100 pb-1">Default Company and Branch</h3>
              <label className="block text-sm font-medium text-slate-700 mb-1">Default Company</label>
              <select value={form.defaultCompanyId} onChange={(e) => setForm((p) => ({ ...p, defaultCompanyId: e.target.value }))} className={inputClass}>
                <option value="">—</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <h3 className="text-blue-600 font-bold text-base mb-2 border-b border-slate-100 pb-1">Department</h3>
              <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
              <select value={form.departmentId} onChange={(e) => setForm((p) => ({ ...p, departmentId: e.target.value }))} className={inputClass}>
                <option value="">—</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            <div>
              <h3 className="text-blue-600 font-bold text-base mb-2 border-b border-slate-100 pb-1">Approval</h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-700">Is Approval Authority</span>
                  <input type="checkbox" checked={form.isApprovalAuthority} onChange={(e) => setForm((p) => ({ ...p, isApprovalAuthority: e.target.checked }))} className="rounded border-slate-300" />
                </label>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Manager/Document Approver</label>
                  <select value={form.managerApproverId} onChange={(e) => setForm((p) => ({ ...p, managerApproverId: e.target.value }))} className={inputClass}>
                    <option value="">—</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-6 py-4 border-t border-slate-100">
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium">
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 font-medium">
            Discard
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddUserModal;
