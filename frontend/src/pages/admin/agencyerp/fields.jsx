import React, { useEffect, useRef, useState } from 'react';
import { X, ExternalLink, Star, GripVertical, Download } from 'lucide-react';
import {
  rpc, fmtNumber, fmtDate, fmtDatetime,
} from './runtime';

// Field widgets for the Agency clone, one per upstream field type / widget
// attribute (many2one, many2many_tags, radio, boolean_toggle, monetary,
// statusbar is in the form header, statinfo in the button box).

const inputCls = 'w-full border-0 border-b border-slate-300 focus:border-[#714B67] focus:ring-0 bg-transparent px-0.5 py-1 text-[13px] outline-none';

const stripHtml = (html) => {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  return doc.body.textContent || '';
};

/** many2one: type to search the target with name_search, pick a record. */
export const Many2One = ({ field, value, onChange, readonly, domain = [], context = {} }) => {
  const [q, setQ] = useState(null);
  const [opts, setOpts] = useState([]);
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const label = Array.isArray(value) ? value[1] : '';

  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(async () => {
      try {
        setOpts(await rpc(field.relation, 'name_search', [], { name: q || '', args: domain, limit: 8, context }));
      } catch (e) { setOpts([]); }
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, open, field.relation, JSON.stringify(domain)]);

  useEffect(() => {
    const close = (e) => { if (box.current && !box.current.contains(e.target)) { setOpen(false); setQ(null); } };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (readonly) return <span className="text-[13px] text-[#017e84]">{label}</span>;
  return (
    <div ref={box} className="relative">
      <input
        className={inputCls}
        value={q ?? label}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); if (!e.target.value) onChange(false); }}
      />
      {open && (
        <ul className="absolute z-30 left-0 right-0 mt-0.5 bg-white border border-slate-200 shadow-lg rounded max-h-64 overflow-y-auto text-[13px]">
          {opts.map(([id, name]) => (
            <li key={id}>
              <button type="button" className="w-full text-left px-2 py-1 hover:bg-[#e9ecef]" onMouseDown={(e) => { e.preventDefault(); onChange([id, name]); setOpen(false); setQ(null); }}>{name}</button>
            </li>
          ))}
          {!opts.length && <li className="px-2 py-1 text-slate-400">No records</li>}
        </ul>
      )}
    </div>
  );
};

/** many2many_tags: chips, with a search box to add more. */
export const Many2ManyTags = ({ field, value, onChange, readonly, domain = [] }) => {
  const ids = Array.isArray(value) ? value : [];
  const [names, setNames] = useState({});
  useEffect(() => {
    const missing = ids.filter((id) => !(id in names));
    if (!missing.length) return;
    rpc(field.relation, 'name_get', [missing]).then((pairs) => setNames((n) => ({ ...n, ...Object.fromEntries(pairs) }))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(ids), field.relation]);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {ids.map((id) => (
        <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#e9ecef] text-[12px]">
          {names[id] || id}
          {!readonly && <button type="button" onClick={() => onChange(ids.filter((x) => x !== id))}><X size={10} /></button>}
        </span>
      ))}
      {!readonly && (
        <div className="min-w-[140px] flex-1">
          <Many2One field={field} value={false} domain={[...domain, ['id', 'not in', ids]]} onChange={(v) => { if (v) { setNames((n) => ({ ...n, [v[0]]: v[1] })); onChange([...ids, v[0]]); } }} />
        </div>
      )}
    </div>
  );
};

const readFile = (file) => new Promise((resolve) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1] || '');
  r.readAsDataURL(file);
});

/** Any single field, chosen by type and the node's widget attribute. */
export const FieldWidget = ({
  field, node, value, onChange, readonly, record, setValue, domain, context,
}) => {
  const widget = node && node.getAttribute('widget');
  const placeholder = (node && node.getAttribute('placeholder')) || '';
  if (!field) return null;

  if (widget === 'handle') return <GripVertical size={14} className="text-slate-400" />;
  if (widget === 'priority') {
    const n = Number(value) || 0;
    return (
      <span className="inline-flex">
        {(field.selection || [[1], [2], [3]]).slice(1).map(([k], i) => (
          <button key={k} type="button" disabled={readonly} onClick={() => onChange(String(n === i + 1 ? 0 : i + 1))}>
            <Star size={14} className={i < n ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} />
          </button>
        ))}
      </span>
    );
  }

  switch (field.type) {
    case 'many2one':
      return <Many2One field={field} value={value} onChange={onChange} readonly={readonly} domain={domain} context={context} />;
    case 'many2many':
      return <Many2ManyTags field={field} value={value} onChange={onChange} readonly={readonly} domain={domain} />;
    case 'selection':
      if (widget === 'radio') {
        return (
          <div className="flex flex-wrap gap-3 text-[13px]">
            {(field.selection || []).map(([k, l]) => (
              <label key={k} className="inline-flex items-center gap-1">
                <input type="radio" checked={value === k} disabled={readonly} onChange={() => onChange(k)} /> {l}
              </label>
            ))}
          </div>
        );
      }
      if (readonly || widget === 'badge' || widget === 'label_selection') {
        const l = ((field.selection || []).find(([k]) => k === value) || [null, ''])[1];
        return widget === 'badge' || widget === 'label_selection'
          ? (l ? <span className="px-2 py-0.5 rounded-full bg-[#e9ecef] text-[12px]">{l}</span> : null)
          : <span className="text-[13px]">{l}</span>;
      }
      return (
        <select className={inputCls} value={value || ''} onChange={(e) => onChange(e.target.value || false)}>
          <option value="" />
          {(field.selection || []).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      );
    case 'boolean':
      if (widget === 'boolean_toggle') {
        return (
          <button type="button" disabled={readonly} onClick={() => onChange(!value)}
            className={`relative inline-flex h-4 w-7 items-center rounded-full transition ${value ? 'bg-[#017e84]' : 'bg-slate-300'}`}>
            <span className={`inline-block h-3 w-3 rounded-full bg-white transition ${value ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
          </button>
        );
      }
      return <input type="checkbox" checked={!!value} disabled={readonly} onChange={(e) => onChange(e.target.checked)} />;
    case 'integer':
    case 'float':
    case 'monetary': {
      const digits = field.type === 'integer' ? 0 : (field.type === 'monetary' ? 2 : ((field.digits && field.digits[1]) ?? 2));
      if (widget === 'float_time') {
        const h = Math.floor(Number(value) || 0);
        const mm = Math.round(((Number(value) || 0) - h) * 60);
        const txt = `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
        return readonly ? <span className="text-[13px]">{txt}</span>
          : <input className={inputCls} defaultValue={txt} onBlur={(e) => { const [a, b] = e.target.value.split(':'); onChange((Number(a) || 0) + (Number(b) || 0) / 60); }} />;
      }
      if (readonly) return <span className="text-[13px] tabular-nums">{value === false || value == null ? '' : fmtNumber(value, digits)}</span>;
      return <input type="number" step={digits ? 'any' : 1} className={`${inputCls} text-right tabular-nums`} value={value === false || value == null ? '' : value} onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))} />;
    }
    case 'date':
      if (readonly) return <span className="text-[13px]">{fmtDate(value)}</span>;
      return <input type="date" className={inputCls} value={value ? String(value).slice(0, 10) : ''} onChange={(e) => onChange(e.target.value || false)} />;
    case 'datetime': {
      if (readonly) return <span className="text-[13px]">{fmtDatetime(value)}</span>;
      const local = value ? new Date(`${String(value).replace(' ', 'T')}${String(value).includes('Z') ? '' : 'Z'}`) : null;
      const p = (n) => String(n).padStart(2, '0');
      const v = local && !Number.isNaN(local.getTime()) ? `${local.getFullYear()}-${p(local.getMonth() + 1)}-${p(local.getDate())}T${p(local.getHours())}:${p(local.getMinutes())}` : '';
      return <input type="datetime-local" className={inputCls} value={v} onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString().replace('T', ' ').slice(0, 19) : false)} />;
    }
    case 'text':
      if (readonly) return <span className="text-[13px] whitespace-pre-wrap">{value || ''}</span>;
      return <textarea rows={3} className={`${inputCls} border rounded px-1`} placeholder={placeholder} value={value || ''} onChange={(e) => onChange(e.target.value)} />;
    case 'html':
      if (readonly) return <div className="text-[13px] whitespace-pre-wrap">{stripHtml(value)}</div>;
      return <textarea rows={6} className={`${inputCls} border rounded px-1 font-mono text-[12px]`} value={value || ''} onChange={(e) => onChange(e.target.value)} />;
    case 'binary': {
      const fname = node && node.getAttribute('filename');
      if (widget === 'image') return value ? <img alt="" className="max-h-24" src={`data:image/png;base64,${value}`} /> : null;
      return (
        <span className="inline-flex items-center gap-2 text-[13px]">
          {value && (
            <a className="text-[#017e84] inline-flex items-center gap-1" href={`data:application/octet-stream;base64,${value}`} download={(fname && record[fname]) || 'file'}>
              <Download size={12} /> {(fname && record[fname]) || 'Download'}
            </a>
          )}
          {!readonly && (
            <input type="file" className="text-[12px]" onChange={async (e) => {
              const f = e.target.files && e.target.files[0];
              if (!f) return;
              onChange(await readFile(f));
              if (fname && setValue) setValue(fname, f.name);
            }} />
          )}
        </span>
      );
    }
    default: {
      if (readonly) {
        if (widget === 'email' && value) return <a className="text-[#017e84] text-[13px]" href={`mailto:${value}`}>{value}</a>;
        if (widget === 'url' && value) return <a className="text-[#017e84] text-[13px] inline-flex items-center gap-1" href={value} target="_blank" rel="noreferrer">{value}<ExternalLink size={10} /></a>;
        if (widget === 'phone' && value) return <a className="text-[#017e84] text-[13px]" href={`tel:${value}`}>{value}</a>;
        return <span className="text-[13px]">{value || ''}</span>;
      }
      if (widget === 'color_picker') return <input type="color" value={value || '#000000'} onChange={(e) => onChange(e.target.value)} />;
      return <input className={inputCls} placeholder={placeholder} value={value || ''} onChange={(e) => onChange(e.target.value)} />;
    }
  }
};
