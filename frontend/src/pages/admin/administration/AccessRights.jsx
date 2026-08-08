import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Users as UsersIcon, Check, X, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { accessAPI } from '../../../services/api';
import { usePermissions } from '../../../context/PermissionContext';
import { PageLoader } from '../../../common/LoadingSpinner';

const TABS = ['Users', 'Access Matrix'];

const Tick = ({ on }) => on
  ? <Check className="w-4 h-4 text-green-600 mx-auto" />
  : <X className="w-4 h-4 text-gray-300 mx-auto" />;

const AccessRights = () => {
  const { guard, refresh: refreshPerms, superuser } = usePermissions();
  const [tab, setTab] = useState('Users');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [byCategory, setByCategory] = useState({});
  const [matrix, setMatrix] = useState([]);
  const [editing, setEditing] = useState(null); // { user, groupIds }
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [u, g, m] = await Promise.all([
      guard(() => accessAPI.users()),
      guard(() => accessAPI.groups()),
      guard(() => accessAPI.matrix()),
    ]);
    if (u) setUsers(u.data.data);
    if (g) setByCategory(g.data.data.byCategory);
    if (m) setMatrix(m.data.data);
    setLoading(false);
  }, [guard]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageLoader />;

  const openEditor = async (user) => {
    const res = await guard(() => accessAPI.userGroups(user.id));
    if (res) setEditing({ user, groupIds: res.data.data.groupIds });
  };

  const toggleGroup = (id) => setEditing((e) => ({
    ...e,
    groupIds: e.groupIds.includes(id) ? e.groupIds.filter((g) => g !== id) : [...e.groupIds, id],
  }));

  const saveGroups = async () => {
    setSaving(true);
    try {
      const res = await accessAPI.setUserGroups(editing.user.id, editing.groupIds);
      toast.success(res.data.message);
      setEditing(null);
      await load();
      await refreshPerms();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save groups');
    } finally {
      setSaving(false);
    }
  };

  const toggleRule = async (rule, field) => {
    try {
      await accessAPI.updateRule(rule.id, { [field]: !rule[field] });
      setMatrix((ms) => ms.map((m) => ({
        ...m,
        rules: m.rules.map((r) => (r.id === rule.id ? { ...r, [field]: !r[field] } : r)),
      })));
      await refreshPerms();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update the rule');
    }
  };

  const shown = users.filter((u) =>
    !search.trim()
    || `${u.name || ''} ${u.email}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-1">
        <Shield className="w-6 h-6 text-blue-700" />
        <h1 className="text-2xl font-bold text-gray-900">Access Rights</h1>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Administrators hold every permission. Everyone else sees and edits only what their groups allow —
        a user without read access to a record is shown a security warning instead of the record.
      </p>

      <div className="flex items-center gap-1 border-b border-gray-200 mb-4">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Users' && (
        <>
          <div className="relative mb-3 max-w-sm">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..."
              className="w-full pl-3 pr-9 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <Search className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['User', 'Email', 'Role', 'Groups', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-2 font-semibold text-gray-600 text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shown.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-900">{u.name || '—'}</td>
                    <td className="px-4 py-2 text-gray-600 text-xs">{u.email}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        u.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {/* "full access" reflects the Settings group, which is what
                            actually grants it — not the role column. */}
                        {(u.groups || []).includes('Administration / Settings') && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px]">
                            full access
                          </span>
                        )}
                        {(u.groups || []).map((g) => (
                          <span key={g} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px]">{g}</span>
                        ))}
                        {(u.groups || []).length === 0 && (
                          <span className="text-xs text-gray-400">no groups — cannot see any records</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => openEditor(u)}
                        className="px-3 py-1 border border-gray-300 text-xs rounded hover:bg-gray-50">
                        Manage groups
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'Access Matrix' && (
        <div className="space-y-6">
          {matrix.map((m) => (
            <div key={m.model} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-gray-100 border-b border-gray-200">
                <h3 className="font-semibold text-gray-800 text-sm">
                  {m.label} <span className="text-gray-400 font-mono text-xs">({m.model})</span>
                </h3>
              </div>
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold text-gray-600 text-xs">Group</th>
                    {['Read', 'Write', 'Create', 'Delete'].map((h) => (
                      <th key={h} className="px-4 py-2 font-semibold text-gray-600 text-xs w-24">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {m.rules.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-1.5 text-gray-800 text-xs">{r.group}</td>
                      {['read', 'write', 'create', 'delete'].map((f) => (
                        <td key={f} className="px-4 py-1.5 text-center">
                          <button disabled={!superuser} onClick={() => toggleRule(r, f)}
                            className="disabled:cursor-not-allowed" title={superuser ? 'Toggle' : 'Administrators only'}>
                            <Tick on={r[f]} />
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Group assignment */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <UsersIcon className="w-4 h-4" /> Groups — {editing.user.name || editing.user.email}
              </h3>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {editing.user.role === 'admin' && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs px-3 py-2 rounded">
                  This user is a platform administrator and bypasses the access matrix entirely.
                  Groups below are still recorded, but nothing is denied to them.
                </div>
              )}
              {Object.entries(byCategory).map(([category, groups]) => (
                <div key={category}>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">{category}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {groups.map((g) => (
                      <label key={g.id} className="flex items-center gap-2 text-sm text-gray-700 py-0.5 cursor-pointer">
                        <input type="checkbox" className="rounded border-gray-300 accent-blue-600"
                          checked={editing.groupIds.includes(g.id)} onChange={() => toggleGroup(g.id)} />
                        {g.name}
                        {g.ownDocumentsOnly && (
                          <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 text-[10px]">own records</span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200">
              <button onClick={() => setEditing(null)} className="px-3 py-1.5 border border-gray-300 text-sm rounded hover:bg-gray-50">Cancel</button>
              <button onClick={saveGroups} disabled={saving}
                className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 text-white text-sm font-semibold rounded">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccessRights;
