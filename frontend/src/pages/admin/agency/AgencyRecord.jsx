import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Trash2, X, Plus, ExternalLink, History, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { agencyAPI } from '../../../services/api';
import ChargeLinesPanel from '../../../common/ChargeLinesPanel';
import {
  FieldInput, MultiLinkSelect, displayValue, StateBadge, clearOptionCache, loadOptions,
} from './fields';

// The form view of any Liner Agency resource, Odoo style: header buttons and
// statusbar, smart buttons, a header block, then tabs for each field group,
// each child table, the charges and the record's history.

const download = ({ filename, mime, content }) => {
  const url = URL.createObjectURL(new Blob([content], { type: mime || 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const errMsg = (err, fallback) => err.response?.data?.message || fallback;

const Grid = ({ fields, record, draft, setField, locked }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-3">
    {fields.map((f) => {
      const ro = f.readonly || locked;
      const wide = ['t', 'h', 'json', 'm2m'].includes(f.type);
      return (
        <div key={f.name} className={wide ? 'md:col-span-2 xl:col-span-3' : ''}>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
            {f.label}{f.required && !f.readonly && <span className="text-red-500"> *</span>}
          </label>
          {ro && !['t', 'h', 'm2m', 'b'].includes(f.type) ? (
            <div className="px-2 py-1.5 text-xs text-slate-700 bg-slate-50 rounded border border-slate-100 min-h-[30px]">
              {displayValue(f, { ...record, ...draft }) || <span className="text-slate-300">-</span>}
            </div>
          ) : (
            <FieldInput field={f} value={draft[f.name]} onChange={(v) => setField(f.name, v)} disabled={ro} record={{ ...record, ...draft }} />
          )}
        </div>
      );
    })}
  </div>
);

/** A child table (container lines, tariff lines, repair jobs...) edited in place. */
const ChildTable = ({ meta, child, parentId, parent, onChanged, locked }) => {
  const r = meta.resources[child.resource];
  const cols = r.fields.filter((f) => f.list && f.name !== child.fk);
  const formFields = r.fields.filter((f) => f.name !== child.fk);
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await agencyAPI.list(child.resource, { [child.fk]: parentId, limit: 'all', sort: 'createdAt', dir: 'asc' });
    setRows(res.data.data || []);
  }, [child.resource, child.fk, parentId]);
  useEffect(() => { load().catch(() => setRows([])); }, [load]);

  const blank = () => Object.fromEntries(formFields.map((f) => [f.name, f.defaultValue ?? (f.type === 'b' ? false : '')]));
  const save = async () => {
    setBusy(true);
    try {
      const payload = { ...editing, [child.fk]: parentId };
      if (editing.id) await agencyAPI.update(child.resource, editing.id, payload);
      else await agencyAPI.create(child.resource, payload);
      setEditing(null);
      clearOptionCache();
      await load();
      onChanged();
    } catch (err) {
      toast.error(errMsg(err, 'Could not save the line'));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (row) => {
    if (!window.confirm('Delete this line?')) return;
    try {
      await agencyAPI.remove(child.resource, row.id);
      await load();
      onChanged();
    } catch (err) {
      toast.error(errMsg(err, 'Could not delete'));
    }
  };

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto border border-slate-200 rounded">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {cols.map((c) => <th key={c.name} className={`px-2 py-1.5 font-semibold whitespace-nowrap ${['i', 'f', '$'].includes(c.type) ? 'text-right' : 'text-left'}`}>{c.label}</th>)}
              <th className="px-2 py-1.5 w-16" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!rows.length && <tr><td colSpan={cols.length + 1} className="px-2 py-4 text-center text-slate-400">No lines.</td></tr>}
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                {cols.map((c) => <td key={c.name} className={`px-2 py-1.5 whitespace-nowrap ${['i', 'f', '$'].includes(c.type) ? 'text-right tabular-nums' : ''}`}>{displayValue(c, row) || <span className="text-slate-300">-</span>}</td>)}
                <td className="px-2 py-1.5 text-right whitespace-nowrap">
                  {!locked && <button type="button" onClick={() => setEditing({ ...row })} className="text-blue-600 hover:underline mr-2">Edit</button>}
                  {!locked && <button type="button" onClick={() => remove(row)} className="text-slate-400 hover:text-red-600"><Trash2 size={12} /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!locked && !editing && (
        <button type="button" onClick={() => setEditing(blank())} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
          <Plus size={12} /> Add a line
        </button>
      )}
      {editing && (
        <div className="border-2 border-blue-200 rounded p-3 bg-blue-50/30">
          <Grid fields={formFields} record={{ ...editing, _parent: parent }} draft={editing} setField={(k, v) => setEditing((d) => ({ ...d, [k]: v }))} locked={false} />
          <div className="flex justify-end gap-2 mt-3">
            <button type="button" onClick={() => setEditing(null)} className="px-3 py-1 text-xs border border-slate-300 rounded">Cancel</button>
            <button type="button" onClick={save} disabled={busy} className="px-3 py-1 text-xs font-semibold rounded bg-blue-600 text-white disabled:opacity-40">{busy ? 'Saving…' : 'Save line'}</button>
          </div>
        </div>
      )}
    </div>
  );
};

/** Inputs an action asks for (a reason, a new status, jobs to attach). */
const ActionDialog = ({ action, record, onCancel, onRun }) => {
  const [vals, setVals] = useState({});
  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">{action.label}</h3>
        {action.input.map((inp) => (
          <div key={inp.name}>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">{inp.label}{inp.required && <span className="text-red-500"> *</span>}</label>
            {inp.type === 'm2m' ? (
              <MultiLinkSelect field={inp} value={vals[inp.name] || []} onChange={(v) => setVals((s) => ({ ...s, [inp.name]: v }))} record={record} height="max-h-64" />
            ) : (
              <FieldInput field={{ ...inp, options: inp.options }} value={vals[inp.name]} onChange={(v) => setVals((s) => ({ ...s, [inp.name]: v }))} record={record} />
            )}
          </div>
        ))}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs border border-slate-300 rounded">Cancel</button>
          <button type="button" onClick={() => onRun(vals)} className="px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white">Confirm</button>
        </div>
      </div>
    </div>
  );
};

const AgencyRecord = ({ meta, resource, id, basePath, title, params = {} }) => {
  const r = meta.resources[resource];
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const isNew = id === 'new';
  const [record, setRecord] = useState(null);
  const [draft, setDraft] = useState({});
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [partners, setPartners] = useState([]);
  const [rev, setRev] = useState(0);

  const groups = useMemo(() => {
    const g = [];
    for (const f of r.fields) if (f.group && !g.includes(f.group)) g.push(f.group);
    return g;
  }, [r]);
  const headerFields = r.fields.filter((f) => !f.group);

  const load = useCallback(async () => {
    if (isNew) {
      const defaults = Object.fromEntries(r.fields.filter((f) => f.defaultValue !== undefined).map((f) => [f.name, f.defaultValue]));
      const today = new Date().toISOString().slice(0, 10);
      r.fields.filter((f) => f.type === 'd' && f.required).forEach((f) => { defaults[f.name] = today; });
      const fromUrl = Object.fromEntries([...search.entries()]);
      setRecord({ _labels: {}, _actions: [], _counts: {} });
      setDraft({ ...defaults, ...params, ...fromUrl });
      setDirty(false);
      return;
    }
    try {
      const res = await agencyAPI.get(resource, id);
      setRecord(res.data.data);
      setDraft(res.data.data);
      setDirty(false);
    } catch (err) {
      toast.error(errMsg(err, 'Record not found'));
      navigate(basePath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, id, isNew]);
  useEffect(() => { load(); }, [load, rev]);
  useEffect(() => { setTab(null); }, [resource, id]);
  useEffect(() => {
    if (r.charges) loadOptions('org').then((o) => setPartners(o.map((x) => ({ id: x.id, name: x.label }))));
  }, [r.charges]);

  const setField = (k, v) => { setDraft((d) => ({ ...d, [k]: v })); setDirty(true); };

  const save = async () => {
    const missing = r.fields.filter((f) => f.required && !f.readonly && (draft[f.name] === null || draft[f.name] === undefined || draft[f.name] === '')).map((f) => f.label);
    if (missing.length) { toast.error(`Fill in: ${missing.join(', ')}`); return null; }
    setBusy(true);
    try {
      const payload = Object.fromEntries(r.fields.filter((f) => !f.readonly).map((f) => [f.name, draft[f.name]]));
      if (isNew) {
        const res = await agencyAPI.create(resource, payload);
        toast.success(res.data.message);
        clearOptionCache();
        navigate(`${basePath}/${res.data.data.id}`, { replace: true });
        return res.data.data;
      }
      const res = await agencyAPI.update(resource, id, payload);
      toast.success(res.data.message);
      setRecord(res.data.data);
      setDraft(res.data.data);
      setDirty(false);
      clearOptionCache();
      return res.data.data;
    } catch (err) {
      toast.error(errMsg(err, 'Could not save'));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete this ${r.label.toLowerCase()}? This cannot be undone.`)) return;
    try {
      await agencyAPI.remove(resource, id);
      toast.success(`${r.label} deleted`);
      navigate(basePath);
    } catch (err) {
      toast.error(errMsg(err, 'Could not delete'));
    }
  };

  const runAction = async (action, body = {}) => {
    if (dirty && !(await save())) return;
    setBusy(true);
    try {
      const res = await agencyAPI.action(resource, id, action.key, body);
      const result = res.data.result || {};
      toast.success(res.data.message || action.label);
      if (result.download) download(result.download);
      clearOptionCache();
      if (result.redirect) { navigate(`/admin/agency/${result.redirect.resource}/${result.redirect.id}`); return; }
      if (result.link) toast((t) => (<span className="text-xs">Open <Link className="text-blue-600 underline" to={result.link} onClick={() => toast.dismiss(t.id)}>the document</Link></span>), { duration: 8000 });
      setRev((n) => n + 1);
    } catch (err) {
      toast.error(errMsg(err, `${action.label} failed`));
    } finally {
      setBusy(false);
    }
  };

  const onAction = (action) => {
    if (action.input) { setDialog(action); return; }
    if (action.confirm && !window.confirm(action.confirm)) return;
    runAction(action);
  };

  if (!record) return <div className="text-xs text-slate-400 p-6">Loading…</div>;

  const state = r.stateField ? (draft[r.stateField] || (r.states && r.states[0][0])) : null;
  const available = r.actions.filter((a) => (record._actions || []).includes(a.key));
  const display = record[r.display] || draft[r.display];
  const recordTitle = isNew ? `New ${r.label}` : (record._labels?.[r.display] || display || r.label);
  const tabs = [
    ...groups.map((g) => ({ key: `g:${g}`, label: g })),
    ...(isNew ? [] : r.children.map((c) => ({ key: `c:${c.resource}`, label: c.title }))),
    ...(!isNew && r.charges ? [{ key: 'charges', label: r.charges.title }] : []),
    ...(!isNew ? [{ key: 'history', label: 'History' }] : []),
  ];
  const activeTab = tab || (tabs[0] && tabs[0].key);

  return (
    <div className="space-y-3">
      {/* breadcrumb + record buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-sm">
          <button type="button" onClick={() => navigate(basePath)} className="text-blue-600 hover:underline inline-flex items-center gap-1"><ArrowLeft size={14} />{title}</button>
          <ChevronRight size={14} className="text-slate-400" />
          <span className="font-semibold text-slate-800">{recordTitle}</span>
        </div>
        <div className="flex items-center gap-2">
          {(dirty || isNew) && (
            <>
              <button type="button" onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"><Save size={13} /> {busy ? 'Saving…' : 'Save'}</button>
              <button type="button" onClick={() => (isNew ? navigate(basePath) : load())} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-slate-300 text-slate-700"><X size={13} /> Discard</button>
            </>
          )}
          {!isNew && <button type="button" onClick={remove} title="Delete" className="p-1.5 rounded border border-slate-300 text-slate-500 hover:text-red-600"><Trash2 size={13} /></button>}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg">
        {/* header: workflow buttons and statusbar */}
        {(!isNew && (available.length || r.statusbar)) && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-slate-200 bg-slate-50 rounded-t-lg">
            <div className="flex flex-wrap gap-1.5">
              {available.map((a) => (
                <button key={a.key} type="button" disabled={busy} onClick={() => onAction(a)}
                  className={`px-2.5 py-1 text-xs rounded font-medium disabled:opacity-40 ${a.primary ? 'bg-blue-600 text-white hover:bg-blue-700' : a.danger ? 'border border-red-300 text-red-700 hover:bg-red-50' : 'border border-slate-300 text-slate-700 hover:bg-white'}`}>
                  {a.label}
                </button>
              ))}
            </div>
            {r.statusbar && (
              <div className="flex items-center text-[11px]">
                {(r.statusbar.includes(state) ? r.statusbar : [...r.statusbar, state]).map((s, i, arr) => {
                  const label = ((r.states || []).find(([v]) => v === s) || [s, s])[1];
                  return (
                    <span key={s} className={`px-2.5 py-1 border border-slate-300 ${i ? '-ml-px' : 'rounded-l'} ${i === arr.length - 1 ? 'rounded-r' : ''} ${s === state ? 'bg-blue-600 text-white border-blue-600 font-semibold' : 'bg-white text-slate-500'}`}>{label}</span>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="p-4 space-y-4">
          {/* smart buttons */}
          {!isNew && r.smart.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2">
              {r.smart.map((s) => {
                const n = record._counts?.[s.label] ?? 0;
                const to = s.resource ? `/admin/agency/${s.resource}?${s.fk}=${record.id}`
                  : s.kind === 'invoices' ? '/admin/accounting/customers/invoices' : '/admin/accounting/vendors/bills';
                return (
                  <Link key={s.label} to={to} className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded hover:bg-slate-50">
                    <span className="text-base font-semibold text-blue-700 tabular-nums">{n}</span>
                    <span className="text-[11px] text-slate-600 leading-tight">{s.label}</span>
                  </Link>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-slate-800">{isNew ? `New ${r.label}` : (display || r.label)}</h2>
            {state && !isNew && <StateBadge meta={r} value={state} />}
          </div>

          <Grid fields={headerFields.filter((f) => f.name !== r.display || f.readonly === false)} record={record} draft={draft} setField={setField} locked={false} />

          {tabs.length > 0 && (
            <div>
              <div className="flex flex-wrap gap-0.5 border-b border-slate-200">
                {tabs.map((t) => (
                  <button key={t.key} type="button" onClick={() => setTab(t.key)}
                    className={`px-3 py-1.5 text-xs -mb-px border-b-2 ${activeTab === t.key ? 'border-blue-600 text-blue-700 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="pt-3">
                {activeTab?.startsWith('g:') && (
                  <Grid fields={r.fields.filter((f) => f.group === activeTab.slice(2))} record={record} draft={draft} setField={setField} locked={false} />
                )}
                {activeTab?.startsWith('c:') && (() => {
                  const child = r.children.find((c) => `c:${c.resource}` === activeTab);
                  return <ChildTable key={child.resource} meta={meta} child={child} parentId={id} parent={record} onChanged={() => setRev((n) => n + 1)} locked={false} />;
                })()}
                {activeTab === 'charges' && (
                  <div className="space-y-4">
                    {(r.charges.side === 'both' ? ['revenue', 'cost'] : [r.charges.side]).map((side) => (
                      <ChargeLinesPanel
                        key={side}
                        parentType={r.charges.parentType}
                        parentId={id}
                        side={side}
                        // Line totals are stored in company currency (AED);
                        // each line keeps its own rate currency.
                        currency="AED"
                        partners={partners}
                        title={side === 'cost' ? 'Cost Charges' : 'Revenue Charges'}
                        onTotalsChange={() => setRev((n) => n + 1)}
                      />
                    ))}
                  </div>
                )}
                {activeTab === 'history' && (
                  <ul className="space-y-1.5">
                    {[...(record.activityLog || [])].reverse().map((e, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        <History size={12} className="mt-0.5 text-slate-400" />
                        <span className="text-slate-400 whitespace-nowrap">{new Date(e.at).toLocaleString()}</span>
                        <span className="text-slate-500">{e.by}</span>
                        <span className="text-slate-700">{e.message}</span>
                      </li>
                    ))}
                    {!(record.activityLog || []).length && <li className="text-xs text-slate-400">No history yet.</li>}
                  </ul>
                )}
              </div>
            </div>
          )}

          {!isNew && record.createdAt && (
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              Created {new Date(record.createdAt).toLocaleString()} · Updated {new Date(record.updatedAt).toLocaleString()}
              <ExternalLink size={10} className="hidden" />
            </p>
          )}
        </div>
      </div>

      {dialog && (
        <ActionDialog action={dialog} record={record} onCancel={() => setDialog(null)} onRun={(vals) => { const a = dialog; setDialog(null); runAction(a, vals); }} />
      )}
    </div>
  );
};

export default AgencyRecord;
