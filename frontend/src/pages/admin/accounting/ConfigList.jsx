import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Trash2, Check, X } from 'lucide-react';
import { accountingAPI } from '../../../services/api';
import { usePermissions } from '../../../context/PermissionContext';
import { PageLoader } from '../../../common/LoadingSpinner';

// Every Configuration leaf renders through here. The backend sends the field
// spec alongside the rows, so adding a configuration list is a registry entry
// plus a route — no new component.
const blankFor = (fields) => Object.fromEntries(
  fields.map((f) => [f.key, f.type === 'boolean' ? true : ''])
);

const ConfigList = ({ configId, title }) => {
  const { guard } = usePermissions();
  const [rows, setRows] = useState([]);
  const [spec, setSpec] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // Either 'new' or a record id — whichever row is currently being edited.
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({});
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await guard(() => accountingAPI.getConfig(configId, { search: search || undefined }));
    if (res) {
      setRows(res.data.data.data || []);
      setSpec(res.data.data.spec || null);
    }
    setLoading(false);
  }, [configId, search, guard]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setEditing(null); setError(''); }, [configId]);

  const fields = spec?.fields || [];

  const startNew = () => { setDraft(blankFor(fields)); setEditing('new'); setError(''); };
  const startEdit = (r) => {
    setDraft(Object.fromEntries(fields.map((f) => [f.key, r[f.key] ?? (f.type === 'boolean' ? false : '')])));
    setEditing(r.id);
    setError('');
  };

  const save = async () => {
    setError('');
    const call = editing === 'new'
      ? () => accountingAPI.createConfig(configId, draft)
      : () => accountingAPI.updateConfig(configId, editing, draft);
    const res = await guard(call);
    if (!res) { setError('Save failed'); return; }
    setEditing(null);
    load();
  };

  const remove = async (id) => {
    const res = await guard(() => accountingAPI.deleteConfig(configId, id));
    if (res) load();
  };

  const input = (f) => {
    if (f.type === 'boolean') {
      return (
        <input type="checkbox" className="rounded border-gray-300"
          checked={!!draft[f.key]}
          onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.checked }))} />
      );
    }
    if (f.type === 'select') {
      return (
        <select value={draft[f.key] ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
          className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs">
          <option value="" />
          {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    return (
      <input type={f.type === 'number' ? 'number' : 'text'} value={draft[f.key] ?? ''}
        onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
        className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs" />
    );
  };

  const display = (r, f) => {
    const v = r[f.key];
    if (f.type === 'boolean') return v ? 'Yes' : 'No';
    if (v === null || v === undefined || v === '') return '';
    // Sequelize returns DECIMAL as a string; trim the stored scale for display.
    if (f.type === 'number') return String(Number(v));
    return String(v);
  };

  return (
    <div className="px-6 pb-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h2 className="text-base font-semibold text-gray-900">{spec?.title || title}</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..."
              className="w-64 pl-3 pr-9 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <Search className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <button onClick={startNew}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-700 text-white rounded text-xs font-medium hover:bg-blue-800">
            <Plus className="w-3.5 h-3.5" /> New
          </button>
        </div>
      </div>

      {error && <div className="mb-2 text-xs text-red-600">{error}</div>}

      {loading ? <PageLoader /> : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  {fields.map((f) => (
                    <th key={f.key} className="text-left px-2 py-2 font-semibold text-gray-800 text-xs whitespace-nowrap">
                      {f.label}
                    </th>
                  ))}
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {editing === 'new' && (
                  <tr className="bg-blue-50/40">
                    {fields.map((f) => <td key={f.key} className="px-2 py-1.5">{input(f)}</td>)}
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        <button onClick={save} className="p-1 text-green-700 hover:bg-green-50 rounded" title="Save">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditing(null)} className="p-1 text-gray-500 hover:bg-gray-100 rounded" title="Discard">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                {rows.length === 0 && editing !== 'new' ? (
                  <tr><td colSpan={fields.length + 1} className="text-center py-10 text-gray-400">No records found</td></tr>
                ) : rows.map((r) => (
                  editing === r.id ? (
                    <tr key={r.id} className="bg-blue-50/40">
                      {fields.map((f) => <td key={f.key} className="px-2 py-1.5">{input(f)}</td>)}
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1">
                          <button onClick={save} className="p-1 text-green-700 hover:bg-green-50 rounded" title="Save">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditing(null)} className="p-1 text-gray-500 hover:bg-gray-100 rounded" title="Discard">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={r.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => startEdit(r)}>
                      {fields.map((f) => (
                        <td key={f.key} className="px-2 py-1.5 text-xs text-gray-700 whitespace-nowrap">{display(r, f)}</td>
                      ))}
                      <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => remove(r.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigList;
