import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Users as UsersIcon, ChevronLeft, ChevronRight, Settings as SettingsIcon } from 'lucide-react';
import { departmentsAPI } from '../../../services/api';
import { PageLoader } from '../../../common/LoadingSpinner';
import toast from 'react-hot-toast';

const ROLE_OPTIONS = [
  '',
  'User: Own Documents Only',
  'Administrator',
  'Super Admin',
  'Billing Administrator',
  'Sales Administrator',
  'Sales Manager',
  'Schedule Administrator',
  'Schedule User',
  'Editor and Designer',
  'Restricted Editor',
  'Settings',
];

// [leftGroup, rightGroup] pairs rendered side by side
const ACCESS_RIGHT_ROWS = [
  [
    { group: 'Sales', key: 'sales', label: 'Sales' },
    { group: 'Services', key: 'project', label: 'Project' },
  ],
  [
    { group: 'Accounting', key: 'invoicing', label: 'Invoicing' },
    { group: 'Inventory', key: 'purchase', label: 'Purchase' },
  ],
  [
    { group: 'Website', key: 'liveChat', label: 'Live Chat' },
    { group: 'Marketing', key: 'events', label: 'Events' },
  ],
  [
    { group: null, key: 'website', label: 'Website' },
    { group: null, key: null, label: null },
  ],
  [
    { group: 'Human Resources', key: 'employees', label: 'Employees' },
    { group: 'Administration', key: 'administration', label: 'Administration' },
  ],
  [
    { group: null, key: 'contracts', label: 'Contracts' },
    { group: null, key: null, label: null },
  ],
  [
    { group: null, key: 'recruitment', label: 'Recruitment' },
    { group: null, key: null, label: null },
  ],
];

const OTHER_FULL_ROWS = [
  { group: 'Other', key: 'auditLogs', label: 'Audit Logs' },
  { key: 'shipment', label: 'Shipment' },
  { key: 'operations', label: 'Operations' },
  { key: 'salesCrm', label: 'Sales & CRM' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'serviceJob', label: 'Service Job' },
  { key: 'wms', label: 'WMS' },
  { key: 'customs', label: 'Customs' },
];

const OTHER_CHECKBOXES = [
  [
    { key: 'accessExportToImport', label: 'Access Export To Import' },
    { key: 'accessTransactionWorkflow', label: 'Access Transaction Workflow' },
  ],
  [
    { key: 'allowAccessShippingProvider', label: 'Allow to access Shipping Provider' },
    { key: 'completedCancelledShipmentStatusChange', label: 'Completed/Cancelled Shipment Status Change' },
  ],
  [
    { key: 'convertNominationShipment', label: 'Convert Nomination Shipment' },
    { key: 'creditLimitApproverTeam', label: 'Credit Limit Approver Team' },
  ],
  [
    { key: 'directQuoteAccept', label: 'Direct Quote Accept' },
    { key: 'freightApproverTeam', label: 'Freight Approver Team' },
  ],
  [
    { key: 'manageDocuments', label: 'Manage Documents' },
    { key: 'manageKyc', label: 'Manage KYC' },
  ],
  [
    { key: 'managePricing', label: 'Manage Pricing' },
    { key: 'manageRateRequest', label: 'Manage Rate Request' },
  ],
  [
    { key: 'oneMasterAllowEdit', label: 'OneMaster: Allow Edit' },
    { key: 'reExportCreatorTeam', label: 'ReExport Creator Team' },
  ],
];

const emptyForm = {
  name: '',
  status: 'active',
  accessRights: {},
  otherPermissions: {},
};

const DepartmentForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [form, setForm] = useState(emptyForm);
  const [members, setMembers] = useState([]);
  const [allDepartments, setAllDepartments] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(!isEdit);

  const fetchOptions = useCallback(async () => {
    try {
      const res = await departmentsAPI.getAll({ limit: 200 });
      setAllDepartments(res.data.data || []);
    } catch {
      setAllDepartments([]);
    }
  }, []);

  const fetchDepartment = useCallback(async () => {
    if (!isEdit) return;
    setLoading(true);
    try {
      const res = await departmentsAPI.getById(id);
      const dept = res.data.data;
      setForm({
        name: dept.name || '',
        status: dept.status || 'active',
        accessRights: dept.accessRights || {},
        otherPermissions: dept.otherPermissions || {},
      });
      setMembers(dept.members || []);
    } catch {
      toast.error('Failed to load department');
    } finally {
      setLoading(false);
      setEditing(false);
    }
  }, [id, isEdit]);

  useEffect(() => { fetchOptions(); }, [fetchOptions]);
  useEffect(() => { fetchDepartment(); }, [fetchDepartment]);

  const setRight = (key, value) => {
    setForm((p) => ({ ...p, accessRights: { ...p.accessRights, [key]: value } }));
  };

  const toggleOther = (key) => {
    setForm((p) => ({ ...p, otherPermissions: { ...p.otherPermissions, [key]: !p.otherPermissions?.[key] } }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Department Name is required');
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await departmentsAPI.update(id, form);
        toast.success('Department updated');
      } else {
        const res = await departmentsAPI.create(form);
        toast.success('Department created');
        navigate(`/admin/administration/departments/${res.data.data.id}`, { replace: true });
        setEditing(false);
        return;
      }
      setEditing(false);
      fetchDepartment();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (isEdit) {
      fetchDepartment();
      setEditing(false);
    } else {
      navigate('/admin/administration/departments');
    }
  };

  // Pagination among departments
  const currentIndex = allDepartments.findIndex((d) => d.id === id);
  const total = allDepartments.length;
  const goToOffset = (offset) => {
    if (currentIndex === -1) return;
    const target = allDepartments[currentIndex + offset];
    if (target) navigate(`/admin/administration/departments/${target.id}`);
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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-slate-500">
          <button onClick={() => navigate('/admin/administration/departments')} className="text-primary-600 hover:underline">Departments</button>
          {' / '}{isEdit ? form.name : 'New'}
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

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 max-w-md">
            <p className="text-xs font-medium text-slate-500 mb-1">Department Name</p>
            {editing ? (
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 text-2xl font-bold border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="e.g. Sales"
              />
            ) : (
              <h2 className="text-2xl font-bold text-slate-900">{form.name}</h2>
            )}
          </div>
          <div className="flex flex-col items-center px-4 py-2 border border-slate-200 rounded-lg">
            <div className="flex items-center gap-1 text-blue-600 font-bold text-lg">
              <UsersIcon className="w-4 h-4" />
              {members.length || 0}
            </div>
            <span className="text-xs text-slate-500">Users</span>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1 border-b border-slate-200">
            <button className="px-4 py-2 text-sm font-medium border-b-2 border-primary-600 text-primary-600 -mb-px">
              Access Rights
            </button>
          </div>

          <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-x-10">
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

          <div className="mt-6 pt-4 border-t border-slate-200">
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
      </div>
    </div>
  );
};

export default DepartmentForm;
