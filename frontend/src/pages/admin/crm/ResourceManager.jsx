import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus, Pencil, Trash2, Search, Download, Save, X, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { exportCsv } from '../../../utils/exportCsv';

// A list-and-form screen driven by a field schema.
//
// The Sales & CRM configuration pages — Lead Stage, Opportunity Stage, Sales
// Team, Quote Template, Lead Source — are all list, search, create, edit,
// delete and nothing more. They share this rather than repeating the same
// screen five times. Anything with a real workflow on it (leads, rate
// requests, cheques) gets its own page.
//
// `schema` is an array of field descriptors:
//   { name, label, type, options, required, hint, width, listOnly, formOnly,
//     render, defaultValue }
// type: text | textarea | number | select | checkbox | date | html

const ResourceManager = ({
  title,
  subtitle,
  api,                 // { getAll, create, update, delete }
  schema,
  listKey,             // for the CSV filename
  fixedParams = {},    // e.g. { kind: 'lead' } — applied to reads and writes
  searchPlaceholder = 'Search…',
  emptyMessage = 'Nothing here yet.',
  canDelete = true,
  extraActions = null, // (row, reload) => ReactNode
  defaults = {},
}) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const listFields = useMemo(() => schema.filter((f) => !f.formOnly), [schema]);
  const formFields = useMemo(() => schema.filter((f) => !f.listOnly), [schema]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAll({ ...fixedParams, limit: 'all', search: search || undefined });
      const d = res.data?.data;
      setRows(Array.isArray(d) ? d : (d?.rows || []));
    } catch (err) {
      if (err.response?.status === 403) {
        setRows([]);
        toast.error(err.response.data?.message || 'You do not have access to this list');
      } else {
        toast.error(err.response?.data?.message || 'Could not load the list');
      }
    } finally {
      setLoading(false);
    }
    // `fixedParams` is a literal at each call site, so comparing it by
    // identity would reload forever. Its serialised form is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, search, JSON.stringify(fixedParams)]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const blank = useMemo(() => {
    const out = { ...defaults, ...fixedParams };
    for (const f of formFields) {
      if (out[f.name] !== undefined) continue;
      out[f.name] = f.defaultValue !== undefined
        ? f.defaultValue
        : (f.type === 'checkbox' ? false : (f.type === 'number' ? 0 : ''));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formFields, JSON.stringify(defaults), JSON.stringify(fixedParams)]);

  const startAdd = () => { setDraft({ ...blank }); setEditingId(null); };
  const startEdit = (row) => { setDraft({ ...row }); setEditingId(row.id); };
  const cancel = () => { setDraft(null); setEditingId(null); };

  const setField = (name, type) => (e) => {
    const v = type === 'checkbox' ? e.target.checked : e.target.value;
    setDraft((d) => ({ ...d, [name]: v }));
  };

  const save = async () => {
    const missing = formFields
      .filter((f) => f.required && !String(draft[f.name] ?? '').trim())
      .map((f) => f.label);
    if (missing.length) {
      toast.error(`Fill in: ${missing.join(', ')}`);
      return;
    }
    setBusy(true);
    try {
      const payload = { ...draft, ...fixedParams };
      for (const f of formFields) {
        if (f.type === 'number') payload[f.name] = Number(payload[f.name]) || 0;
      }
      if (editingId) {
        await api.update(editingId, payload);
        toast.success(`${title} updated`);
      } else {
        await api.create(payload);
        toast.success(`${title} created`);
      }
      cancel();
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row) => {
    const label = row.name || row.id;
    if (!window.confirm(`Delete "${label}"?\n\nThis cannot be undone.`)) return;
    setBusy(true);
    try {
      await api.delete(row.id);
      toast.success(`${title} deleted`);
      await load();
    } catch (err) {
      // The server refuses a delete that would orphan records and says why,
      // so the message is shown rather than a generic failure.
      toast.error(err.response?.data?.message || 'Could not delete');
    } finally {
      setBusy(false);
    }
  };

  const exportSpec = useMemo(
    () => listFields.map((f) => ({ label: f.label, key: f.exportKey || f.name })),
    [listFields],
  );

  const onExport = () => {
    if (exportCsv(rows, exportSpec, listKey || title.toLowerCase().replace(/\s+/g, '-'))) {
      toast.success(`Exported ${rows.length} rows`);
    } else {
      toast.error('Nothing to export');
    }
  };

  const cellValue = (row, f) => {
    if (f.render) return f.render(row);
    const v = row[f.name];
    if (f.type === 'checkbox') {
      return v
        ? <span className="text-emerald-600 font-semibold">Yes</span>
        : <span className="text-slate-400">No</span>;
    }
    if (v === null || v === undefined || v === '') return <span className="text-slate-300">-</span>;
    if (f.type === 'select' && f.options) {
      const opt = f.options.find((o) => (o.value ?? o) === v);
      return opt ? (opt.label ?? opt) : v;
    }
    return String(v);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-8 pr-3 py-1.5 w-56 border border-slate-300 rounded text-xs"
            />
          </div>
          <button
            type="button"
            onClick={load}
            title="Reload the list"
            className="p-1.5 border border-slate-300 rounded text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw size={14} />
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={!rows.length}
            title={rows.length ? 'Export to CSV' : 'Nothing to export yet'}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <Download size={13} /> Export
          </button>
          <button
            type="button"
            onClick={startAdd}
            disabled={!!draft}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
          >
            <Plus size={13} /> New
          </button>
        </div>
      </div>

      {draft && (
        <div className="bg-white border-2 border-blue-300 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">
            {editingId ? `Edit ${title.toLowerCase()}` : `New ${title.toLowerCase()}`}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {formFields.map((f) => (
              <div key={f.name} className={f.width === 'full' ? 'md:col-span-2 lg:col-span-3' : ''}>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                  {f.label}{f.required && <span className="text-red-500"> *</span>}
                </label>
                {f.type === 'textarea' || f.type === 'html' ? (
                  <textarea
                    rows={f.type === 'html' ? 8 : 3}
                    value={draft[f.name] ?? ''}
                    onChange={setField(f.name, f.type)}
                    placeholder={f.placeholder}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs font-mono"
                  />
                ) : f.type === 'select' ? (
                  <select
                    value={draft[f.name] ?? ''}
                    onChange={setField(f.name, f.type)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
                  >
                    <option value="">Not set</option>
                    {(f.options || []).map((o) => {
                      const value = o.value ?? o;
                      const label = o.label ?? o;
                      return <option key={value} value={value}>{label}</option>;
                    })}
                  </select>
                ) : f.type === 'checkbox' ? (
                  <label className="flex items-center gap-2 px-1 py-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={!!draft[f.name]}
                      onChange={setField(f.name, f.type)}
                    />
                    <span className="text-slate-600">{f.checkboxLabel || 'Enabled'}</span>
                  </label>
                ) : (
                  <input
                    type={f.type === 'number' ? 'number' : (f.type === 'date' ? 'date' : 'text')}
                    step={f.step}
                    value={draft[f.name] ?? ''}
                    onChange={setField(f.name, f.type)}
                    placeholder={f.placeholder}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
                  />
                )}
                {f.hint && <p className="mt-0.5 text-[10px] text-slate-400">{f.hint}</p>}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={cancel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <X size={13} /> Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
            >
              <Save size={13} /> {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {listFields.map((f) => (
                <th
                  key={f.name}
                  className={`px-3 py-2 font-semibold ${
                    f.type === 'number' ? 'text-right' : 'text-left'}`}
                >
                  {f.label}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={listFields.length + 1} className="px-3 py-6 text-center text-slate-400">
                Loading…
              </td></tr>
            )}
            {!loading && !rows.length && (
              <tr><td colSpan={listFields.length + 1} className="px-3 py-8 text-center text-slate-400">
                {search ? `Nothing matches "${search}".` : emptyMessage}
              </td></tr>
            )}
            {!loading && rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                {listFields.map((f) => (
                  <td
                    key={f.name}
                    className={`px-3 py-2 ${f.type === 'number' ? 'text-right tabular-nums' : ''} ${
                      f.name === 'name' ? 'font-medium text-slate-800' : 'text-slate-600'}`}
                  >
                    {cellValue(row, f)}
                  </td>
                ))}
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {extraActions && extraActions(row, load)}
                  <button
                    type="button"
                    onClick={() => startEdit(row)}
                    title="Edit"
                    className="p-1 text-slate-400 hover:text-blue-600"
                  >
                    <Pencil size={13} />
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => remove(row)}
                      disabled={busy}
                      title="Delete"
                      className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && !!rows.length && (
        <p className="text-[11px] text-slate-400">{rows.length} record(s)</p>
      )}
    </div>
  );
};

export default ResourceManager;
