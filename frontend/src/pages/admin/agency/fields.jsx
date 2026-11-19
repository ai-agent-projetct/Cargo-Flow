import React, { useEffect, useState } from 'react';
import { agencyAPI } from '../../../services/api';

// Field widgets for the Liner Agency screens, one per spec.js field type.

// Lookups are shared across every widget on the page, keyed by target and
// filter, so a form with ten port fields asks the server once.
const cache = new Map();
export const loadOptions = (ref, filter = {}) => {
  const params = { limit: 1000, ...Object.fromEntries(Object.entries(filter).map(([k, v]) => [`f_${k}`, v])) };
  const key = `${ref}|${JSON.stringify(params)}`;
  if (!cache.has(key)) {
    cache.set(key, agencyAPI.lookup(ref, params).then((r) => r.data?.data || []).catch(() => { cache.delete(key); return []; }));
  }
  return cache.get(key);
};
export const clearOptionCache = () => cache.clear();

/** `$field` in a filter is read from the record, `$id` is its id. */
export const resolveFilter = (filter, record) => Object.fromEntries(
  Object.entries(filter || {}).map(([k, v]) => [k, typeof v === 'string' && v.startsWith('$') ? (record?.[v.slice(1)] ?? 'null') : v]),
);

const inputCls = 'w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white disabled:bg-slate-50 disabled:text-slate-500';

const LinkSelect = ({ field, value, label, onChange, disabled, record }) => {
  const [opts, setOpts] = useState(null);
  const filter = resolveFilter(field.filter, record);
  const filterKey = JSON.stringify(filter);
  useEffect(() => {
    let live = true;
    loadOptions(field.ref, filter).then((o) => { if (live) setOpts(o); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field.ref, filterKey]);
  const list = opts || [];
  const hasValue = value && list.some((o) => o.id === value);
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value || null)} disabled={disabled} className={inputCls}>
      <option value="">{opts ? 'Not set' : 'Loading…'}</option>
      {value && !hasValue && <option value={value}>{label || value}</option>}
      {list.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );
};

export const MultiLinkSelect = ({ field, value, onChange, disabled, record, height = 'max-h-40' }) => {
  const [opts, setOpts] = useState(null);
  const [q, setQ] = useState('');
  const filter = resolveFilter(field.filter, record);
  const filterKey = JSON.stringify(filter);
  useEffect(() => {
    let live = true;
    loadOptions(field.ref, filter).then((o) => { if (live) setOpts(o); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field.ref, filterKey]);
  const selected = Array.isArray(value) ? value : [];
  const toggle = (id) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const shown = (opts || []).filter((o) => !q || String(o.label).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="border border-slate-300 rounded bg-white">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="w-full px-2 py-1 border-b border-slate-200 text-xs" disabled={disabled} />
      <div className={`${height} overflow-y-auto p-1`}>
        {!opts && <p className="text-[11px] text-slate-400 px-1">Loading…</p>}
        {opts && !shown.length && <p className="text-[11px] text-slate-400 px-1">Nothing to choose.</p>}
        {shown.map((o) => (
          <label key={o.id} className="flex items-center gap-2 px-1 py-0.5 text-xs hover:bg-slate-50 rounded">
            <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggle(o.id)} disabled={disabled} />
            <span className="truncate">{o.label}</span>
          </label>
        ))}
      </div>
      <p className="px-2 py-0.5 text-[10px] text-slate-400 border-t border-slate-100">{selected.length} selected</p>
    </div>
  );
};

const toLocalDt = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const FieldInput = ({ field, value, onChange, disabled, record }) => {
  const label = record?._labels?.[field.name];
  switch (field.type) {
    case 't':
    case 'h':
      return <textarea rows={field.type === 'h' ? 6 : 3} value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={inputCls} />;
    case 'i':
    case 'f':
    case '$':
      return <input type="number" step={field.type === 'i' ? 1 : 'any'} value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={`${inputCls} text-right`} />;
    case 'b':
      return (
        <label className="flex items-center gap-2 py-1.5 text-xs">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
          <span className="text-slate-500">{value ? 'Yes' : 'No'}</span>
        </label>
      );
    case 'd':
      return <input type="date" value={value ? String(value).slice(0, 10) : ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={inputCls} />;
    case 'dt':
      return <input type="datetime-local" value={toLocalDt(value)} onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} disabled={disabled} className={inputCls} />;
    case 'sel':
      return (
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} disabled={disabled} className={inputCls}>
          <option value="">Not set</option>
          {(field.options || []).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      );
    case 'm2o':
      return <LinkSelect field={field} value={value} label={label} onChange={onChange} disabled={disabled} record={record} />;
    case 'm2m':
      return <MultiLinkSelect field={field} value={value} onChange={onChange} disabled={disabled} record={record} />;
    case 'json':
      return (
        <textarea
          rows={4}
          defaultValue={JSON.stringify(value ?? [], null, 1)}
          onBlur={(e) => { try { onChange(JSON.parse(e.target.value || '[]')); } catch { /* keep the last valid value */ } }}
          disabled={disabled}
          className={`${inputCls} font-mono`}
        />
      );
    default:
      return <input type="text" value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={inputCls} />;
  }
};

const fmtNumber = (v, dp) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  return n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
};

/** A value as a list cell or a read-only form field shows it. */
export const displayValue = (field, row) => {
  const v = row?.[field.name];
  if (field.type === 'm2o') return row?._labels?.[field.name] || (v ? '…' : '');
  if (field.type === 'm2m') return (row?._labels?.[field.name] || []).join(', ');
  if (v === null || v === undefined || v === '') return '';
  if (field.type === 'b') return v ? 'Yes' : 'No';
  if (field.type === 'sel') return ((field.options || []).find(([o]) => String(o) === String(v)) || [v, v])[1];
  if (field.type === '$') return fmtNumber(v, 2);
  if (field.type === 'f') return fmtNumber(v, Number(v) % 1 ? 3 : 0);
  if (field.type === 'd') return String(v).slice(0, 10);
  if (field.type === 'dt') return new Date(v).toLocaleString();
  if (field.type === 'json') return Array.isArray(v) ? `${v.length} item(s)` : '';
  return String(v);
};

const STATE_TONE = {
  draft: 'bg-slate-100 text-slate-700', created: 'bg-slate-100 text-slate-700',
  cancel: 'bg-red-100 text-red-700', cancelled: 'bg-red-100 text-red-700', reject: 'bg-red-100 text-red-700', rejected: 'bg-red-100 text-red-700', expire: 'bg-amber-100 text-amber-700',
  accept: 'bg-emerald-100 text-emerald-700', approved: 'bg-emerald-100 text-emerald-700', done: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-emerald-100 text-emerald-700', d_o_generated: 'bg-emerald-100 text-emerald-700', payment_received: 'bg-emerald-100 text-emerald-700',
  received: 'bg-emerald-100 text-emerald-700', refunded: 'bg-emerald-100 text-emerald-700', attached_bl: 'bg-emerald-100 text-emerald-700', closed: 'bg-emerald-100 text-emerald-700',
  to_approve: 'bg-amber-100 text-amber-700', unapproved: 'bg-amber-100 text-amber-700',
};
export const StateBadge = ({ meta, value }) => {
  if (!value) return null;
  const label = ((meta.states || []).find(([v]) => v === value) || [value, value])[1];
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATE_TONE[value] || 'bg-blue-100 text-blue-700'}`}>{label}</span>;
};
