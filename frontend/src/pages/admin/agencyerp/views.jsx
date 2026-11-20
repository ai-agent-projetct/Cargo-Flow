import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Search, Filter, Layers, X, Plus, Trash2, ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  rpc, pyEval, parseArch, children, modifiersOf, pyExpr, displayCell, toWriteValue, saveDownload,
} from './runtime';
import { FieldWidget } from './fields';
import api from '../../../services/api';

// Form, list and search views of the Agency clone. Each one walks the
// upstream view XML (fields_view_get) and renders it with Odoo's layout
// rules: header buttons and statusbar, button box, title, group columns,
// notebook pages, x2many sub-lists, list columns with optional/invisible
// columns and decorations, search fields, filters and group-bys.

const errMsg = (e) => e.response?.data?.message || e.message || 'Something went wrong';
const cls = (node) => (node.getAttribute('class') || '');

// ── Form ─────────────────────────────────────────────────────────────────────
const O2MList = ({ name, field, viewField, values, mode, setRows, rows, parentValues, onOpenRow }) => {
  const tree = viewField?.views?.tree;
  const arch = useMemo(() => (tree ? parseArch(tree.arch) : null), [tree]);
  const subFields = tree?.fields || {};
  const cols = arch ? children(arch).filter((n) => n.tagName === 'field' && !modifiersOf(n, {}).columnInvisible && n.getAttribute('invisible') !== '1' && n.getAttribute('optional') !== 'hide') : [];
  const editable = arch && arch.getAttribute('editable');
  const edit = mode === 'edit' && !modifiersOf({ getAttribute: () => null }, values).readonly;
  if (!arch) return <span className="text-[12px] text-slate-400">{(values[name] || []).length} line(s)</span>;
  const live = (rows || []).filter((r) => r.op !== 'delete');
  const setCell = (idx, fname, v) => setRows(name, rows.map((r, i) => (i === idx ? { ...r, values: { ...r.values, [fname]: v }, op: r.op === 'keep' ? 'update' : r.op } : r)));
  const sums = cols.filter((c) => c.getAttribute('sum'));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-slate-300">
            {cols.map((c) => {
              const f = subFields[c.getAttribute('name')] || {};
              return <th key={c.getAttribute('name')} className={`px-2 py-1.5 font-semibold text-slate-700 whitespace-nowrap ${['integer', 'float', 'monetary'].includes(f.type) ? 'text-right' : 'text-left'}`}>{c.getAttribute('string') || f.string}</th>;
            })}
            {edit && <th className="w-6" />}
          </tr>
        </thead>
        <tbody>
          {rows && rows.map((r, idx) => (r.op === 'delete' ? null : (
            <tr key={r.key} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => !(edit && editable) && onOpenRow(name, idx)}>
              {cols.map((c) => {
                const fname = c.getAttribute('name');
                const f = subFields[fname];
                const mods = modifiersOf(c, { ...r.values, parent: parentValues });
                return (
                  <td key={fname} className={`px-2 py-1 ${f && ['integer', 'float', 'monetary'].includes(f.type) ? 'text-right tabular-nums' : ''}`} onClick={(e) => edit && editable && e.stopPropagation()}>
                    {edit && editable && !mods.readonly
                      ? <FieldWidget field={f} node={c} value={r.values[fname]} record={r.values} onChange={(v) => setCell(idx, fname, v)} readonly={false} />
                      : (mods.invisible ? null : displayCell(f, r.values[fname]))}
                  </td>
                );
              })}
              {edit && (
                <td className="px-1" onClick={(e) => e.stopPropagation()}>
                  <button type="button" title="Delete" onClick={() => setRows(name, rows.map((x, i) => (i === idx ? { ...x, op: x.op === 'create' ? 'delete' : 'delete' } : x)))}>
                    <Trash2 size={13} className="text-slate-400 hover:text-red-600" />
                  </button>
                </td>
              )}
            </tr>
          )))}
          {sums.length > 0 && (
            <tr className="font-semibold">
              {cols.map((c) => {
                const fname = c.getAttribute('name');
                return <td key={fname} className="px-2 py-1 text-right tabular-nums">{c.getAttribute('sum') ? displayCell(subFields[fname], live.reduce((s, r) => s + (Number(r.values[fname]) || 0), 0)) : ''}</td>;
              })}
            </tr>
          )}
        </tbody>
      </table>
      {edit && (
        <button type="button" className="mt-1 text-[13px] text-[#017e84] hover:underline" onClick={() => (editable ? setRows(name, [...rows, { key: `new${Date.now()}`, op: 'create', values: {} }]) : onOpenRow(name, -1))}>
          Add a line
        </button>
      )}
      {!edit && field && null}
    </div>
  );
};

/** A sub-record opened from a one2many, in a dialog. */
const LineDialog = ({ model, values, onClose, onSave, readonly }) => {
  const [fv, setFv] = useState(null);
  const [vals, setVals] = useState(values);
  useEffect(() => { rpc(model, 'fields_view_get', [], { view_type: 'form' }).then(setFv).catch((e) => toast.error(errMsg(e))); }, [model]);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-16 px-4">
      <div className="bg-white rounded shadow-xl w-full max-w-5xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <h3 className="text-base font-semibold">{fv ? (parseArch(fv.arch).getAttribute('string') || 'Line') : 'Line'}</h3>
          <button type="button" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="p-4">
          {fv ? <ArchBody fv={fv} values={vals} mode={readonly ? 'readonly' : 'edit'} setValue={(k, v) => setVals((s) => ({ ...s, [k]: v }))} model={model} /> : 'Loading…'}
        </div>
        <div className="flex justify-end gap-2 px-4 py-2 border-t">
          {!readonly && <button type="button" className="px-3 py-1 rounded bg-[#714B67] text-white text-[13px]" onClick={() => onSave(vals)}>Save &amp; Close</button>}
          <button type="button" className="px-3 py-1 rounded border text-[13px]" onClick={onClose}>{readonly ? 'Close' : 'Discard'}</button>
        </div>
      </div>
    </div>
  );
};

/** Renders a form view's XML. Shared by the main form, line dialogs and wizards. */
const ArchBody = ({
  fv, values, mode, setValue, model, onButton, rows = {}, setRows = () => {}, onOpenRow = () => {}, parentValues,
}) => {
  const root = useMemo(() => parseArch(fv.arch), [fv.arch]);
  const fields = fv.fields || {};
  const [pages, setPages] = useState({});
  const rec = parentValues ? { ...values, parent: parentValues } : values;

  const label = (fname, node) => (node && node.getAttribute('string')) || (fields[fname] && fields[fname].string) || fname;

  const fieldEl = (node, key) => {
    const fname = node.getAttribute('name');
    const f = fields[fname];
    const mods = modifiersOf(node, rec);
    if (mods.invisible || !f) return null;
    if (f.type === 'one2many' || (f.type === 'many2many' && node.getAttribute('widget') !== 'many2many_tags' && f.views && f.views.tree)) {
      return <O2MList key={key} name={fname} field={f} viewField={f} values={values} mode={mods.readonly ? 'readonly' : mode} rows={rows[fname]} setRows={setRows} parentValues={values} onOpenRow={onOpenRow} />;
    }
    const domain = pyEval(node.getAttribute('domain') || f.domain || '[]', { ...rec, parent: parentValues }) || [];
    return (
      // fields_view_get already folds the field's own readonly into modifiers.
      <FieldWidget key={key} field={f} node={node} value={values[fname]} record={values} readonly={mode !== 'edit' || mods.readonly}
        onChange={(v) => setValue(fname, v)} setValue={setValue} domain={Array.isArray(domain) ? domain.filter((t) => !Array.isArray(t) || t[2] !== null) : []} />
    );
  };

  // Odoo's inner group: label/widget pairs flowing into `col` columns.
  const innerGroup = (node, key) => {
    const col = Number(node.getAttribute('col') || 2);
    const rowsOut = [];
    let cur = [];
    let width = 0;
    const push = (cell, span) => {
      if (width + span > col && cur.length) { rowsOut.push(cur); cur = []; width = 0; }
      cur.push(cell);
      width += span;
    };
    children(node).forEach((ch, i) => {
      const mods = modifiersOf(ch, rec);
      if (mods.invisible) return;
      if (ch.tagName === 'newline') { if (cur.length) rowsOut.push(cur); cur = []; width = 0; return; }
      if (ch.tagName === 'separator') {
        if (cur.length) rowsOut.push(cur);
        rowsOut.push([<td key={`s${i}`} colSpan={col} className="pt-3 pb-1"><div className="text-[13px] font-bold text-slate-800 border-b border-slate-300 pb-0.5">{ch.getAttribute('string')}</div></td>]);
        cur = []; width = 0;
        return;
      }
      if (ch.tagName === 'field') {
        const fname = ch.getAttribute('name');
        const f = fields[fname];
        if (!f) return;
        const span = Number(ch.getAttribute('colspan') || (ch.getAttribute('nolabel') === '1' ? 1 : 2));
        const req = modifiersOf(ch, rec).required || f.required;
        const isX2m = f.type === 'one2many' || (f.type === 'many2many' && ch.getAttribute('widget') !== 'many2many_tags');
        if (ch.getAttribute('nolabel') === '1' || isX2m) {
          push(<td key={`f${i}`} colSpan={isX2m ? col : span} className="py-1 pr-3 align-top">{isX2m && ch.getAttribute('nolabel') !== '1' && <div className="text-[13px] font-semibold mb-1">{label(fname, ch)}</div>}{fieldEl(ch, `w${i}`)}</td>, isX2m ? col : span);
        } else {
          push(<td key={`l${i}`} className={`py-1 pr-3 align-top w-[1%] whitespace-nowrap text-[13px] font-semibold ${req && mode === 'edit' ? 'text-slate-900' : 'text-slate-800'}`}>{label(fname, ch)}{req && mode === 'edit' ? '' : ''}</td>, 1);
          push(<td key={`w${i}`} colSpan={Math.max(1, span - 1)} className={`py-1 pr-6 align-top ${req && mode === 'edit' ? 'bg-[#d2d2ff33]' : ''}`}>{fieldEl(ch, `x${i}`)}</td>, Math.max(1, span - 1));
        }
        return;
      }
      if (ch.tagName === 'label') {
        push(<td key={`lb${i}`} className="py-1 pr-3 align-top whitespace-nowrap text-[13px] font-semibold">{ch.getAttribute('string') || label(ch.getAttribute('for'))}</td>, 1);
        return;
      }
      push(<td key={`o${i}`} colSpan={Number(ch.getAttribute('colspan') || 1)} className="py-1 pr-3 align-top">{node2(ch, `n${i}`)}</td>, Number(ch.getAttribute('colspan') || 1));
    });
    if (cur.length) rowsOut.push(cur);
    return (
      <div key={key} className="min-w-0">
        {node.getAttribute('string') && <div className="text-[13px] font-bold text-slate-800 border-b border-slate-300 pb-0.5 mb-1 uppercase tracking-wide">{node.getAttribute('string')}</div>}
        <table className="w-full"><tbody>{rowsOut.map((r, i) => <tr key={i}>{r}</tr>)}</tbody></table>
      </div>
    );
  };

  const node2 = (node, key) => {
    if (!node || node.nodeType !== 1) return null;
    const tag = node.tagName;
    if (modifiersOf(node, rec).invisible) return null;
    const kids = () => children(node).map((c, i) => node2(c, `${key}.${i}`));
    switch (tag) {
      case 'form': case 'sheet': return <div key={key}>{kids()}</div>;
      case 'header': case 'footer': return null; // rendered by the caller
      case 'field': return fieldEl(node, key);
      case 'group': {
        const subs = children(node);
        if (subs.some((c) => c.tagName === 'group')) {
          const col = Number(node.getAttribute('col') || 2);
          return (
            <div key={key} className="mb-2">
              {node.getAttribute('string') && <div className="text-[13px] font-bold border-b border-slate-300 pb-0.5 mb-1 uppercase tracking-wide">{node.getAttribute('string')}</div>}
              <div className="grid gap-x-8" style={{ gridTemplateColumns: `repeat(${col}, minmax(0, 1fr))` }}>
                {subs.map((c, i) => (c.tagName === 'group' ? innerGroup(c, `${key}.${i}`) : <div key={`${key}.${i}`} style={{ gridColumn: '1 / -1' }}>{node2(c, `${key}.${i}`)}</div>))}
              </div>
            </div>
          );
        }
        return innerGroup(node, key);
      }
      case 'notebook': {
        const pgs = children(node).filter((p) => p.tagName === 'page' && !modifiersOf(p, rec).invisible);
        const active = pages[key] ?? 0;
        const idx = Math.min(active, pgs.length - 1);
        return (
          <div key={key} className="mt-4">
            <div className="flex flex-wrap border-b border-slate-300">
              {pgs.map((p, i) => (
                <button key={i} type="button" onClick={() => setPages((s) => ({ ...s, [key]: i }))}
                  className={`px-4 py-1.5 text-[13px] -mb-px border ${i === idx ? 'border-slate-300 border-b-white bg-white font-semibold text-slate-900 rounded-t' : 'border-transparent text-[#017e84] hover:text-[#714B67]'}`}>
                  {p.getAttribute('string')}
                </button>
              ))}
            </div>
            <div className="pt-3">{pgs[idx] ? children(pgs[idx]).map((c, i) => node2(c, `${key}.p${idx}.${i}`)) : null}</div>
          </div>
        );
      }
      case 'separator': return <div key={key} className="mt-3 mb-1 text-[13px] font-bold border-b border-slate-300 pb-0.5 uppercase">{node.getAttribute('string')}</div>;
      case 'newline': return <div key={key} className="w-full" />;
      case 'label': return <label key={key} className="text-[13px] font-semibold mr-2">{node.getAttribute('string') || label(node.getAttribute('for'))}</label>;
      case 'button': {
        if (cls(node).includes('oe_stat_button')) return null;
        return (
          <button key={key} type="button" onClick={() => onButton && onButton(node)}
            className={`text-[13px] px-2 py-0.5 rounded ${/oe_highlight|btn-primary/.test(cls(node)) ? 'bg-[#714B67] text-white' : 'text-[#017e84] hover:underline'}`}>
            {node.getAttribute('string') || node.getAttribute('title') || ''}
          </button>
        );
      }
      case 'widget': return null;
      case 'h1': case 'h2': case 'h3': case 'h4': {
        const H = tag;
        return <H key={key} className={tag === 'h1' ? 'text-2xl font-semibold text-slate-900 my-1' : 'text-lg font-semibold my-1'}>{kids()}{node.childNodes.length === 1 && node.firstChild.nodeType === 3 ? node.textContent : null}</H>;
      }
      case 'div': {
        const c = cls(node);
        if (c.includes('oe_button_box') || c.includes('oe_chatter')) return null;
        if (c.includes('oe_title')) return <div key={key} className="mb-3">{kids()}</div>;
        return <div key={key} className={c.includes('o_row') ? 'flex items-center gap-2' : ''}>{kids()}{[...node.childNodes].filter((t) => t.nodeType === 3 && t.textContent.trim()).map((t, i) => <span key={i} className="text-[13px]">{t.textContent}</span>)}</div>;
      }
      case 'span': case 'strong': case 'b': case 'i': case 'p': case 'code': {
        const text = [...node.childNodes].filter((t) => t.nodeType === 3).map((t) => t.textContent).join('').trim();
        return <span key={key} className={`text-[13px] ${tag === 'strong' || tag === 'b' ? 'font-semibold' : ''}`}>{text}{kids()}</span>;
      }
      case 'table': return <table key={key} className="text-[13px]"><tbody>{kids()}</tbody></table>;
      case 'tr': return <tr key={key}>{kids()}</tr>;
      case 'td': return <td key={key} className="pr-3">{kids()}</td>;
      case 'ul': return <ul key={key} className="list-disc ml-5 text-[13px]">{kids()}</ul>;
      case 'li': return <li key={key}>{node.textContent}</li>;
      case 'hr': return <hr key={key} className="my-2" />;
      default: return null;
    }
  };
  void model;
  return node2(root, 'r');
};

/** The full record view: control panel, header, sheet, chatter. */
export const FormView = ({
  model, id, fv, actionContext = {}, onBack, onOpenAction, onCreated, title,
}) => {
  const [record, setRecord] = useState(null);
  const [changes, setChanges] = useState({});
  const [rows, setRowsState] = useState({});
  const [mode, setMode] = useState(id ? 'readonly' : 'edit');
  const [busy, setBusy] = useState(false);
  const [lineDlg, setLineDlg] = useState(null);
  const [ask, setAsk] = useState(null);
  const root = useMemo(() => parseArch(fv.arch), [fv.arch]);
  const fields = useMemo(() => fv.fields || {}, [fv.fields]);
  const values = useMemo(() => ({ ...(record || {}), ...changes }), [record, changes]);

  const loadRows = useCallback(async (rec) => {
    const out = {};
    for (const [fname, f] of Object.entries(fields)) {
      if (f.type !== 'one2many' && !(f.type === 'many2many' && f.views && f.views.tree)) continue;
      const ids = Array.isArray(rec[fname]) ? rec[fname] : [];
      const sub = f.views && f.views.tree;
      const subFields = sub ? Object.keys(sub.fields || {}) : ['display_name'];
      const data = ids.length ? await rpc(f.relation, 'read', [ids, subFields]) : [];
      out[fname] = data.map((d) => ({ key: `r${d.id}`, id: d.id, op: 'keep', values: d }));
    }
    setRowsState(out);
  }, [fields]);

  const load = useCallback(async () => {
    try {
      if (id) {
        const [rec] = await rpc(model, 'read', [[Number(id)], Object.keys(fields)]);
        setRecord(rec || {});
        await loadRows(rec || {});
      } else {
        const defaultsFromCtx = Object.fromEntries(Object.entries(actionContext).filter(([k]) => k.startsWith('default_')).map(([k, v]) => [k.slice(8), v]));
        const d = await rpc(model, 'default_get', [Object.keys(fields)], { context: actionContext });
        const merged = { ...d, ...defaultsFromCtx };
        // many2one defaults arrive as ids; show their names.
        for (const [k, v] of Object.entries(merged)) {
          const f = fields[k];
          if (f && f.type === 'many2one' && v && !Array.isArray(v)) {
            const [pair] = await rpc(f.relation, 'name_get', [[v]]).catch(() => [[v, String(v)]]);
            merged[k] = pair || [v, String(v)];
          }
        }
        setRecord({});
        setChanges(merged);
        setRowsState(Object.fromEntries(Object.entries(fields).filter(([, f]) => f.type === 'one2many').map(([k]) => [k, []])));
      }
    } catch (e) { toast.error(errMsg(e)); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, id]);
  useEffect(() => { setChanges({}); setMode(id ? 'readonly' : 'edit'); load(); }, [load, id]);

  const setValue = async (k, v) => {
    setChanges((c) => ({ ...c, [k]: v }));
    const node = root.querySelector(`field[name="${k}"]`);
    if (node && node.getAttribute('on_change') === '1') {
      try {
        const res = await rpc(model, 'onchange', [{ ...values, [k]: v }, k]);
        if (res && res.value && Object.keys(res.value).length) setChanges((c) => ({ ...c, ...res.value }));
      } catch (e) { /* onchange is best effort */ }
    }
  };
  const setRows = (k, list) => { setRowsState((r) => ({ ...r, [k]: list })); setChanges((c) => ({ ...c, [`__rows_${k}`]: Date.now() })); };

  const buildVals = () => {
    const out = {};
    for (const [k, v] of Object.entries(changes)) {
      if (k.startsWith('__rows_')) continue;
      const f = fields[k];
      if (!f || f.type === 'one2many') continue;
      if (f.type === 'many2many' && rows[k]) continue;
      out[k] = f.type === 'many2many' ? [[6, 0, v || []]] : toWriteValue(f, v);
    }
    for (const [k, list] of Object.entries(rows)) {
      const f = fields[k];
      if (!f) continue;
      const cmds = [];
      for (const r of list) {
        const vals = Object.fromEntries(Object.entries(r.values).filter(([fk]) => fk !== 'id' && fk !== 'display_name').map(([fk, fv2]) => [fk, toWriteValue((f.views?.tree?.fields || {})[fk], fv2)]));
        if (r.op === 'create') cmds.push([0, 0, vals]);
        else if (r.op === 'update') cmds.push([1, r.id, vals]);
        else if (r.op === 'delete' && r.id) cmds.push([2, r.id]);
      }
      if (cmds.length) out[k] = cmds;
    }
    return out;
  };

  const save = async () => {
    setBusy(true);
    try {
      const vals = buildVals();
      if (id) {
        if (Object.keys(vals).length) await rpc(model, 'write', [[Number(id)], vals]);
        setChanges({});
        setMode('readonly');
        await load();
      } else {
        const newId = await rpc(model, 'create', [vals], { context: actionContext });
        toast.success('Record created');
        onCreated(newId);
      }
      return true;
    } catch (e) {
      toast.error(errMsg(e));
      return false;
    } finally { setBusy(false); }
  };

  const discard = () => { if (!id) { onBack(); return; } setChanges({}); setMode('readonly'); load(); };

  const onButton = async (node) => {
    const type = node.getAttribute('type');
    const name = node.getAttribute('name');
    if (node.getAttribute('confirm') && !window.confirm(node.getAttribute('confirm'))) return;
    if (mode === 'edit' && Object.keys(changes).length && !(await save())) return;
    const recId = Number(id);
    if (!recId) return;
    const ctx = { ...actionContext, ...(pyEval(node.getAttribute('context') || '{}', { ...values, active_id: recId, active_ids: [recId], id: recId }) || {}) };
    try {
      if (type === 'object') {
        const res = await rpc(model, name, [[recId]], { context: ctx });
        await handleResult(res, recId, ctx);
      } else if (type === 'action') {
        onOpenAction({ type: 'ir.actions.act_window', id: Number(name), context: ctx }, { active_id: recId, active_model: model });
      }
    } catch (e) { toast.error(errMsg(e)); }
  };

  // What a button returned: an action to open, a question to ask, a file.
  const handleResult = async (res, recId, ctx) => {
    if (!res || typeof res !== 'object' || !res.type) { await load(); return; }
    if (res.type === 'cf.input') { setAsk({ ...res, recId, ctx }); return; }
    if (res.type === 'cf.download') {
      saveDownload(res.download);
      await load();
      return;
    }
    if (res.type === 'cf.url') { window.location.assign(res.url); return; }
    onOpenAction(res, { active_id: recId, active_model: model });
  };
  const answer = async (value) => {
    const q = ask;
    setAsk(null);
    try {
      const res = await rpc(model, q.method, [[q.recId]], { value, context: q.ctx });
      await handleResult(res, q.recId, q.ctx);
    } catch (e) { toast.error(errMsg(e)); }
  };

  const openRow = (fname, idx) => {
    const f = fields[fname];
    const list = rows[fname] || [];
    setLineDlg({ fname, idx, model: f.relation, values: idx >= 0 ? list[idx].values : {} });
  };
  const saveRow = (vals) => {
    const { fname, idx } = lineDlg;
    const list = rows[fname] || [];
    if (idx >= 0) setRows(fname, list.map((r, i) => (i === idx ? { ...r, values: vals, op: r.op === 'keep' ? 'update' : r.op } : r)));
    else setRows(fname, [...list, { key: `new${Date.now()}`, op: 'create', values: vals }]);
    setLineDlg(null);
  };

  if (!record) return <div className="p-6 text-[13px] text-slate-400">Loading…</div>;

  const header = children(root).find((n) => n.tagName === 'header');
  const sheet = children(root).find((n) => n.tagName === 'sheet') || root;
  const box = sheet.querySelector ? [...sheet.querySelectorAll('div')].find((d) => cls(d).includes('oe_button_box')) : null;
  const statusNode = header ? children(header).find((n) => n.tagName === 'field' && n.getAttribute('widget') === 'statusbar') : null;
  const statusField = statusNode ? fields[statusNode.getAttribute('name')] : null;
  const visibleStates = statusNode ? (statusNode.getAttribute('statusbar_visible') || '').split(',').filter(Boolean) : [];
  const curState = statusNode ? values[statusNode.getAttribute('name')] : null;
  const recName = values.display_name || values.name || (id ? `#${id}` : 'New');

  return (
    <div className="bg-[#f9fafb] min-h-full">
      {/* control panel */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b">
        <div className="text-[15px]">
          <button type="button" className="text-[#017e84] hover:underline" onClick={onBack}>{title}</button>
          <span className="text-slate-500"> / </span>
          <span>{recName}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b">
        {mode === 'readonly'
          ? <button type="button" className="px-3 py-1 rounded bg-[#714B67] text-white text-[13px]" onClick={() => setMode('edit')}>Edit</button>
          : (
            <>
              <button type="button" disabled={busy} className="px-3 py-1 rounded bg-[#714B67] text-white text-[13px] disabled:opacity-50" onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
              <button type="button" className="px-3 py-1 rounded border border-slate-300 text-[13px]" onClick={discard}>Discard</button>
            </>
          )}
        {mode === 'readonly' && id && (
          <button type="button" className="px-3 py-1 rounded border border-slate-300 text-[13px]" onClick={() => onCreated(null)}>Create</button>
        )}
        {mode === 'readonly' && id && <PrintMenu model={model} id={id} />}
        {mode === 'readonly' && id && (
          <button type="button" className="ml-auto px-2 py-1 rounded text-[13px] text-slate-500 hover:text-red-600 inline-flex items-center gap-1"
            onClick={async () => { if (!window.confirm('Are you sure you want to delete this record?')) return; try { await rpc(model, 'unlink', [[Number(id)]]); onBack(); } catch (e) { toast.error(errMsg(e)); } }}>
            <Trash2 size={13} /> Delete
          </button>
        )}
      </div>

      <div className="max-w-[1400px] mx-auto p-4">
        {/* header: buttons + statusbar */}
        {header && (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-b-0 px-3 py-1.5">
            <div className="flex flex-wrap gap-1.5">
              {children(header).filter((n) => n.tagName === 'button' && !modifiersOf(n, values).invisible && id).map((b, i) => (
                <button key={i} type="button" disabled={busy} onClick={() => onButton(b)}
                  className={`px-2.5 py-1 rounded text-[13px] ${/oe_highlight|btn-primary/.test(cls(b)) ? 'bg-[#714B67] text-white hover:bg-[#5e3e56]' : 'bg-[#e9ecef] text-slate-800 hover:bg-slate-200'}`}>
                  {b.getAttribute('string')}
                </button>
              ))}
            </div>
            {statusField && (
              <div className="flex text-[12px]">
                {(statusField.selection || []).filter(([k]) => !visibleStates.length || visibleStates.includes(k) || k === curState).map(([k, l], i, arr) => (
                  <span key={k} className={`px-3 py-1 border ${i ? '-ml-px' : ''} ${i === 0 ? 'rounded-l' : ''} ${i === arr.length - 1 ? 'rounded-r' : ''} ${k === curState ? 'bg-[#714B67] text-white border-[#714B67]' : 'bg-white text-slate-500 border-slate-300'}`}>{l}</span>
                ))}
              </div>
            )}
          </div>
        )}
        {/* sheet */}
        <div className="bg-white border shadow-sm px-8 py-5">
          {box && id && (
            <div className="flex flex-wrap justify-end -mx-8 -mt-5 mb-4 border-b">
              {children(box).filter((b) => b.tagName === 'button' && !modifiersOf(b, values).invisible).map((b, i) => {
                const statField = children(b).find((n) => n.tagName === 'field');
                const fname = statField && statField.getAttribute('name');
                const text = (statField && statField.getAttribute('string')) || b.getAttribute('string') || [...b.childNodes].map((n) => n.textContent).join(' ').trim();
                return (
                  <button key={i} type="button" onClick={() => onButton(b)} className="flex items-center gap-2 px-4 py-2 border-l text-left hover:bg-slate-50 min-w-[130px]">
                    <span className="leading-tight">
                      {fname && <span className="block text-[14px] font-semibold text-[#017e84]">{displayCell(fields[fname], values[fname]) || 0}</span>}
                      <span className="block text-[12px] text-slate-600">{text}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <ArchBody fv={fv} values={values} mode={mode} setValue={setValue} model={model} onButton={onButton} rows={rows} setRows={setRows} onOpenRow={openRow} />
        </div>
        {id && (
          <div className="mt-4 bg-white border px-4 py-3 text-[12px] text-slate-500">
            {record.create_date ? `Created ${record.create_date}` : ''}{record.write_date ? ` · Last updated ${record.write_date}` : ''}
          </div>
        )}
      </div>
      {lineDlg && <LineDialog model={lineDlg.model} values={lineDlg.values} readonly={mode !== 'edit'} onClose={() => setLineDlg(null)} onSave={saveRow} />}
      {ask && <AskDialog ask={ask} onCancel={() => setAsk(null)} onOk={answer} />}
    </div>
  );
};

/** Print: the instance's Stimulsoft documents for this model, as PDF. */
const PrintMenu = ({ model, id }) => {
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  useEffect(() => {
    api.get('/odoo/print/templates', { params: { model } }).then((r) => setList(r.data.result || [])).catch(() => setList([]));
  }, [model]);
  if (!list || !list.length) return null;
  const run = async (t) => {
    setBusy(t.id);
    try {
      const res = await api.get(`/odoo/print/${t.id}`, { params: { res_id: id }, responseType: 'blob' });
      window.open(URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' })), '_blank');
    } catch (e) {
      toast.error('Could not print this document');
    } finally { setBusy(null); setOpen(false); }
  };
  return (
    <div className="relative">
      <button type="button" className="px-3 py-1 rounded border border-slate-300 text-[13px] inline-flex items-center gap-1" onClick={() => setOpen(!open)}>
        Print <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute z-40 mt-1 bg-white border shadow-lg rounded py-1 min-w-[220px]">
          {list.map((t) => (
            <button key={t.id} type="button" disabled={!!busy} onClick={() => run(t)} className="block w-full text-left px-3 py-1.5 text-[13px] hover:bg-[#e9ecef] disabled:opacity-50">
              {busy === t.id ? 'Preparing…' : t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/** A button's question: pick a value, type a reason, or choose records. */
const AskDialog = ({ ask, onCancel, onOk }) => {
  const { kind, options = [], label, model: m, domain = [] } = ask.input || {};
  const [value, setValue] = useState(kind === 'records' ? [] : (options[0] ? options[0][0] : ''));
  const [recs, setRecs] = useState(null);
  useEffect(() => {
    if (kind !== 'records') return;
    rpc(m, 'search_read', [], { domain, fields: ['display_name'], limit: 500, count: false }).then(setRecs).catch(() => setRecs([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-24 px-4">
      <div className="bg-white rounded shadow-xl w-full max-w-lg">
        <div className="px-4 py-2 border-b text-base">{ask.title}</div>
        <div className="p-4 text-[13px]">
          {kind === 'select' && (
            <select className="w-full border-b border-slate-300 py-1" value={value} onChange={(e) => setValue(e.target.value)}>
              {options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          )}
          {kind === 'text' && (<><div className="font-semibold mb-1">{label}</div><textarea rows={3} className="w-full border rounded p-1" value={value} onChange={(e) => setValue(e.target.value)} /></>)}
          {kind === 'records' && (
            <div className="max-h-72 overflow-y-auto border rounded">
              {!recs && <p className="p-2 text-slate-400">Loading…</p>}
              {recs && !recs.length && <p className="p-2 text-slate-400">No records to choose.</p>}
              {(recs || []).map((r) => (
                <label key={r.id} className="flex items-center gap-2 px-2 py-1 hover:bg-[#f2f2f2]">
                  <input type="checkbox" checked={value.includes(r.id)} onChange={() => setValue((v) => (v.includes(r.id) ? v.filter((x) => x !== r.id) : [...v, r.id]))} />
                  {r.display_name}
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2 px-4 py-2 border-t">
          <button type="button" className="px-3 py-1 rounded bg-[#714B67] text-white text-[13px] disabled:opacity-40" disabled={kind === 'text' ? !String(value).trim() : (kind === 'records' && !value.length)} onClick={() => onOk(value)}>Confirm</button>
          <button type="button" className="px-3 py-1 rounded border text-[13px]" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

// ── Search ───────────────────────────────────────────────────────────────────
const searchModel = (archStr) => {
  const root = parseArch(archStr);
  const fieldsS = [];
  const filters = [];
  const groupBys = [];
  let group = 0;
  const walk = (node, inGroupBy) => {
    for (const n of children(node)) {
      if (n.tagName === 'field') fieldsS.push({ name: n.getAttribute('name'), string: n.getAttribute('string'), filter_domain: n.getAttribute('filter_domain'), operator: n.getAttribute('operator') });
      else if (n.tagName === 'separator') group += 1;
      else if (n.tagName === 'filter') {
        const ctx = pyEval(n.getAttribute('context') || '{}') || {};
        const f = { name: n.getAttribute('name'), string: n.getAttribute('string'), domain: n.getAttribute('domain'), group, context: ctx };
        if (ctx.group_by || inGroupBy) groupBys.push({ ...f, field: ctx.group_by });
        else filters.push(f);
      } else if (n.tagName === 'group') { group += 1; walk(n, true); group += 1; }
    }
  };
  walk(root, false);
  return { fields: fieldsS, filters, groupBys };
};

export const SearchBar = ({ arch, fields, actionContext, onChange }) => {
  const sm = useMemo(() => searchModel(arch), [arch]);
  const [text, setText] = useState('');
  const [facets, setFacets] = useState(() => {
    const out = [];
    for (const [k, v] of Object.entries(actionContext || {})) {
      if (!k.startsWith('search_default_') || !v) continue;
      const name = k.slice(15);
      const flt = sm.filters.find((f) => f.name === name);
      const gb = sm.groupBys.find((f) => f.name === name);
      const fld = sm.fields.find((f) => f.name === name);
      if (flt) out.push({ kind: 'filter', items: [flt] });
      else if (gb) out.push({ kind: 'groupby', items: [gb] });
      else if (fld) out.push({ kind: 'field', field: fld, values: [v] });
    }
    return out;
  });
  const [menu, setMenu] = useState(null);

  useEffect(() => {
    const domain = [];
    for (const fc of facets) {
      if (fc.kind === 'field') {
        const parts = fc.values.map((v) => {
          if (fc.field.filter_domain) return pyEval(fc.field.filter_domain, { self: v, raw_value: v }) || [];
          const f = fields[fc.field.name];
          return [[fc.field.name, f && ['selection', 'boolean', 'integer'].includes(f.type) ? '=' : (fc.field.operator || 'ilike'), v]];
        });
        domain.push(...Array(Math.max(0, parts.length - 1)).fill('|'), ...parts.flat());
      } else if (fc.kind === 'filter') {
        const parts = fc.items.map((f) => pyEval(f.domain || '[]', {}) || []).filter((d) => !JSON.stringify(d).includes('null'));
        if (parts.length) domain.push(...Array(parts.length - 1).fill('|'), ...parts.flat());
      }
    }
    const groupby = facets.filter((f) => f.kind === 'groupby').flatMap((f) => f.items.map((i) => i.field || i.context.group_by)).filter(Boolean);
    onChange({ domain, groupby });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(facets)]);

  const addField = (fld) => {
    if (!text.trim()) return;
    setFacets((fs) => {
      const i = fs.findIndex((x) => x.kind === 'field' && x.field.name === fld.name);
      if (i >= 0) return fs.map((x, j) => (j === i ? { ...x, values: [...x.values, text.trim()] } : x));
      return [...fs, { kind: 'field', field: fld, values: [text.trim()] }];
    });
    setText('');
  };
  const toggle = (kind, item) => setFacets((fs) => {
    const key = kind === 'filter' ? item.group : 'gb';
    const i = fs.findIndex((x) => x.kind === kind && (kind === 'groupby' || x.items[0].group === key));
    if (i < 0) return [...fs, { kind, items: [item] }];
    const has = fs[i].items.some((x) => x.name === item.name);
    const items = has ? fs[i].items.filter((x) => x.name !== item.name) : [...fs[i].items, item];
    return items.length ? fs.map((x, j) => (j === i ? { ...x, items } : x)) : fs.filter((_, j) => j !== i);
  });
  const active = (kind, item) => facets.some((x) => x.kind === kind && x.items.some((y) => y.name === item.name));
  const label = (f) => f.string || (fields[f.name] && fields[f.name].string) || f.name;

  return (
    <div className="flex flex-col gap-1 w-full max-w-2xl">
      <div className="relative flex flex-wrap items-center gap-1 border border-slate-300 rounded bg-white px-1 py-0.5 min-h-[32px]">
        <Search size={14} className="text-slate-400 mx-1" />
        {facets.map((fc, i) => (
          <span key={i} className="inline-flex items-center gap-1 bg-[#e9ecef] rounded text-[12px] pl-1 pr-0.5">
            <span className="bg-[#714B67] text-white rounded px-1">{fc.kind === 'groupby' ? <Layers size={10} /> : fc.kind === 'filter' ? <Filter size={10} /> : label(fc.field)}</span>
            {fc.kind === 'field' ? fc.values.join(' or ') : fc.items.map((x) => x.string).join(fc.kind === 'groupby' ? ' > ' : ' or ')}
            <button type="button" onClick={() => setFacets((fs) => fs.filter((_, j) => j !== i))}><X size={10} /></button>
          </span>
        ))}
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && sm.fields[0]) addField(sm.fields[0]); if (e.key === 'Backspace' && !text) setFacets((fs) => fs.slice(0, -1)); }}
          placeholder="Search..." className="flex-1 min-w-[120px] outline-none text-[13px] py-0.5" />
        {text && (
          <ul className="absolute z-30 left-0 right-0 top-full mt-0.5 bg-white border shadow-lg rounded text-[13px]">
            {sm.fields.map((f) => (
              <li key={f.name}><button type="button" className="w-full text-left px-3 py-1 hover:bg-[#e9ecef]" onClick={() => addField(f)}>Search <b>{label(f)}</b> for: <i>{text}</i></button></li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex gap-3 text-[13px] relative">
        {sm.filters.length > 0 && (
          <button type="button" className="inline-flex items-center gap-1 text-slate-700" onClick={() => setMenu(menu === 'f' ? null : 'f')}><Filter size={12} /> Filters <ChevronDown size={12} /></button>
        )}
        {sm.groupBys.length > 0 && (
          <button type="button" className="inline-flex items-center gap-1 text-slate-700" onClick={() => setMenu(menu === 'g' ? null : 'g')}><Layers size={12} /> Group By <ChevronDown size={12} /></button>
        )}
        {menu && (
          <div className="absolute z-30 top-6 left-0 bg-white border shadow-lg rounded py-1 min-w-[220px]">
            {(menu === 'f' ? sm.filters : sm.groupBys).map((f, i, arr) => (
              <React.Fragment key={f.name || i}>
                {i > 0 && arr[i - 1].group !== f.group && <hr className="my-1" />}
                <button type="button" className="w-full text-left px-3 py-1 hover:bg-[#e9ecef] flex items-center gap-2" onClick={() => toggle(menu === 'f' ? 'filter' : 'groupby', f)}>
                  <span className="w-3">{active(menu === 'f' ? 'filter' : 'groupby', f) ? '✓' : ''}</span>{f.string}
                </button>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── List ─────────────────────────────────────────────────────────────────────
export const ListView = ({
  model, tv, sv, action, actionContext, baseDomain, onOpen, onCreate, title,
}) => {
  const root = useMemo(() => parseArch(tv.arch), [tv.arch]);
  const fields = tv.fields || {};
  const cols = children(root).filter((n) => n.tagName === 'field' && n.getAttribute('invisible') !== '1' && !modifiersOf(n, {}).columnInvisible);
  const [shown, setShown] = useState(() => new Set(cols.filter((c) => c.getAttribute('optional') !== 'hide').map((c) => c.getAttribute('name'))));
  const [search, setSearch] = useState({ domain: [], groupby: [] });
  const [data, setData] = useState({ records: [], length: 0 });
  const [groups, setGroups] = useState(null);
  const [open, setOpen] = useState({});
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [optMenu, setOptMenu] = useState(false);
  const limit = (action && action.limit) || 80;
  const fnames = cols.map((c) => c.getAttribute('name'));
  const domain = useMemo(() => [...(baseDomain || []), ...search.domain], [baseDomain, search.domain]);
  const order = root.getAttribute('default_order') || null;

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      try {
        if (search.groupby.length) {
          const g = await rpc(model, 'read_group', [domain, fnames, search.groupby], { lazy: true });
          if (live) { setGroups(g); setOpen({}); }
        } else {
          const res = await rpc(model, 'search_read', [], { domain, fields: fnames, offset, limit, order, context: actionContext });
          if (live) { setGroups(null); setData(res); }
        }
      } catch (e) { toast.error(errMsg(e)); }
      if (live) setLoading(false);
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, JSON.stringify(domain), JSON.stringify(search.groupby), offset]);

  const expand = async (i) => {
    if (open[i]) { setOpen((o) => ({ ...o, [i]: null })); return; }
    const recs = await rpc(model, 'search_read', [], { domain: [...domain, ...groups[i].__domain], fields: fnames, limit: 200, order, count: false });
    setOpen((o) => ({ ...o, [i]: recs }));
  };

  const decor = (rec) => {
    const map = { 'decoration-danger': 'text-red-600', 'decoration-success': 'text-emerald-700', 'decoration-warning': 'text-amber-600', 'decoration-info': 'text-sky-700', 'decoration-muted': 'text-slate-400', 'decoration-bf': 'font-bold', 'decoration-it': 'italic' };
    return Object.entries(map).filter(([a]) => root.getAttribute(a) && pyExpr(root.getAttribute(a), rec)).map(([, c]) => c).join(' ');
  };
  const visible = cols.filter((c) => shown.has(c.getAttribute('name')));
  const row = (r) => (
    <tr key={r.id} className={`border-b border-slate-100 hover:bg-[#f2f2f2] cursor-pointer ${decor(r)}`} onClick={() => onOpen(r.id, data.records.map((x) => x.id))}>
      {visible.map((c) => {
        const fname = c.getAttribute('name');
        const f = fields[fname];
        const w = c.getAttribute('widget');
        let v = displayCell(f, r[fname]);
        if ((w === 'badge' || w === 'label_selection') && v) v = <span className="px-2 py-0.5 rounded-full bg-[#e9ecef] text-[12px]">{v}</span>;
        if (w === 'boolean_toggle') v = <span className={`inline-block w-6 h-3 rounded-full ${r[fname] ? 'bg-[#017e84]' : 'bg-slate-300'}`} />;
        return <td key={fname} className={`px-2 py-1.5 whitespace-nowrap ${f && ['integer', 'float', 'monetary'].includes(f.type) ? 'text-right tabular-nums' : ''}`}>{v}</td>;
      })}
    </tr>
  );
  const sumOf = (recs, c) => recs.reduce((s, r) => s + (Number(r[c.getAttribute('name')]) || 0), 0);
  const hasSums = visible.some((c) => c.getAttribute('sum'));

  return (
    <div className="bg-white min-h-full">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-2 border-b">
        <div>
          <div className="text-[18px] text-slate-800 mb-1">{title}</div>
          {root.getAttribute('create') !== 'false' && root.getAttribute('create') !== '0' && (
            <button type="button" className="px-3 py-1 rounded bg-[#714B67] text-white text-[13px]" onClick={onCreate}>Create</button>
          )}
        </div>
        {sv && <SearchBar arch={sv.arch} fields={{ ...(sv.fields || {}), ...fields }} actionContext={actionContext} onChange={(s) => { setOffset(0); setSearch(s); }} />}
        <div className="flex items-center gap-2 text-[13px] text-slate-600">
          {!groups && <span>{data.length ? `${offset + 1}-${Math.min(offset + limit, data.length)}` : 0} / {data.length}</span>}
          {!groups && (
            <>
              <button type="button" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - limit))} className="disabled:opacity-30"><ChevronLeft size={16} /></button>
              <button type="button" disabled={offset + limit >= data.length} onClick={() => setOffset(offset + limit)} className="disabled:opacity-30"><ChevronRight size={16} /></button>
            </>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-white">
            <tr className="border-b-2 border-slate-300">
              {visible.map((c) => {
                const f = fields[c.getAttribute('name')] || {};
                return <th key={c.getAttribute('name')} className={`px-2 py-2 font-semibold text-slate-800 whitespace-nowrap ${['integer', 'float', 'monetary'].includes(f.type) ? 'text-right' : 'text-left'}`}>{c.getAttribute('string') || f.string}</th>;
              })}
              <th className="w-6 relative">
                {cols.some((c) => c.getAttribute('optional')) && (
                  <button type="button" onClick={() => setOptMenu(!optMenu)} title="Optional columns"><ChevronDown size={14} /></button>
                )}
                {optMenu && (
                  <div className="absolute right-0 z-30 bg-white border shadow-lg rounded py-1 text-left min-w-[200px]">
                    {cols.filter((c) => c.getAttribute('optional')).map((c) => {
                      const n = c.getAttribute('name');
                      return (
                        <label key={n} className="flex items-center gap-2 px-3 py-1 font-normal hover:bg-[#e9ecef]">
                          <input type="checkbox" checked={shown.has(n)} onChange={() => setShown((s) => { const x = new Set(s); if (x.has(n)) x.delete(n); else x.add(n); return x; })} />
                          {c.getAttribute('string') || (fields[n] || {}).string}
                        </label>
                      );
                    })}
                  </div>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={visible.length + 1} className="px-3 py-6 text-center text-slate-400">Loading…</td></tr>}
            {!loading && groups && groups.map((g, i) => {
              const gf = search.groupby[0].split(':')[0];
              const label = displayCell(fields[gf] || (sv && sv.fields && sv.fields[gf]), g[gf]) || 'None';
              return (
                <React.Fragment key={i}>
                  <tr className="bg-[#f2f2f2] border-b cursor-pointer font-semibold" onClick={() => expand(i)}>
                    <td colSpan={visible.length + 1} className="px-2 py-1.5">{open[i] ? '▾' : '▸'} {label} ({g.__count})</td>
                  </tr>
                  {open[i] && open[i].map(row)}
                </React.Fragment>
              );
            })}
            {!loading && !groups && data.records.map(row)}
            {!loading && !groups && !data.records.length && (
              <tr><td colSpan={visible.length + 1} className="px-3 py-10 text-center text-slate-400">No records available!</td></tr>
            )}
            {!loading && !groups && hasSums && data.records.length > 0 && (
              <tr className="font-semibold border-t-2">
                {visible.map((c) => <td key={c.getAttribute('name')} className="px-2 py-1.5 text-right tabular-nums">{c.getAttribute('sum') ? displayCell(fields[c.getAttribute('name')], sumOf(data.records, c)) : ''}</td>)}
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <button type="button" className="hidden" onClick={onCreate}><Plus size={1} /></button>
    </div>
  );
};

export { ArchBody };
