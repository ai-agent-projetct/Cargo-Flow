import React, { useEffect, useMemo, useState } from 'react';
import {
  Routes, Route, useNavigate, useParams, useLocation, Link,
} from 'react-router-dom';
import { LayoutGrid, ChevronDown, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import {
  rpc, loadMenus, pyEval, parseArch, children, modifiersOf, saveDownload,
} from './runtime';
import { FormView, ListView, ArchBody } from './views';

// SearatesERP "Agency" - the clone of unifeeder-shipping-staging. Menus,
// actions and views are the instance's own (backend/src/agency/upstream);
// this shell only routes between them the way the Odoo web client does.

const BASE = '/admin/agency-erp';
const APP_ORDER = ['Booking', 'Operations', 'Maintenance', 'Repair', 'Schedules', 'Contacts', 'Accounting', 'Configuration', 'Reporting', 'Administration'];

const errMsg = (e) => e.response?.data?.message || e.message || 'Something went wrong';
const ctxEval = (s, env = {}) => pyEval(s || '{}', { uid: 1, ...env }) || {};

const useViews = (action) => {
  const [fv, setFv] = useState(null);
  useEffect(() => {
    if (!action) return;
    setFv(null);
    const views = [...(action.views || [[false, 'tree'], [false, 'form']])];
    if (!views.some(([, t]) => t === 'form')) views.push([false, 'form']);
    views.push([action.search_view_id ? action.search_view_id[0] : false, 'search']);
    rpc(action.res_model, 'load_views', [], { views }).then((r) => setFv(r.fields_views)).catch((e) => toast.error(errMsg(e)));
  }, [action]);
  return fv;
};

/** A target="new" action: a wizard or a sub-record in a dialog. */
const WizardDialog = ({ action, onClose, onDone }) => {
  const [fv, setFv] = useState(null);
  const [values, setValues] = useState(null);
  const [busy, setBusy] = useState(false);
  const ctx = useMemo(() => (typeof action.context === 'string' ? ctxEval(action.context, action.env) : (action.context || {})), [action]);
  useEffect(() => {
    (async () => {
      try {
        const views = await rpc(action.res_model, 'load_views', [], { views: [[action.view_id ? (Array.isArray(action.view_id) ? action.view_id[0] : action.view_id) : false, 'form']] });
        const form = views.fields_views.form;
        setFv(form);
        if (action.res_id) {
          const [r] = await rpc(action.res_model, 'read', [[action.res_id], Object.keys(form.fields || {})]);
          setValues(r);
        } else {
          const d = await rpc(action.res_model, 'default_get', [Object.keys(form.fields || {})], { context: ctx });
          const fromCtx = Object.fromEntries(Object.entries(ctx).filter(([k]) => k.startsWith('default_')).map(([k, v]) => [k.slice(8), v]));
          setValues({ ...d, ...fromCtx });
        }
      } catch (e) { toast.error(errMsg(e)); onClose(); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action]);
  if (!fv || !values) return null;
  const root = parseArch(fv.arch);
  const footer = children(root).find((n) => n.tagName === 'footer');
  const run = async (b) => {
    if (b.getAttribute('special') === 'cancel') { onClose(); return; }
    setBusy(true);
    try {
      const vals = Object.fromEntries(Object.entries(values).filter(([k]) => fv.fields[k] && fv.fields[k].type !== 'one2many' && k !== 'id').map(([k, v]) => [k, Array.isArray(v) && fv.fields[k].type === 'many2one' ? v[0] : (fv.fields[k].type === 'many2many' ? [[6, 0, v || []]] : v)]));
      const id = action.res_id || await rpc(action.res_model, 'create', [vals], { context: ctx });
      if (action.res_id) await rpc(action.res_model, 'write', [[id], vals]);
      if (b.getAttribute('special') === 'save') { onDone(null); return; }
      const res = await rpc(action.res_model, b.getAttribute('name'), [[id]], { context: ctx });
      if (res && res.download) { saveDownload(res.download); onClose(); return; }
      onDone(res && res.type ? res : null);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-16 px-4">
      <div className="bg-white rounded shadow-xl w-full max-w-4xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <h3 className="text-base">{action.name || root.getAttribute('string')}</h3>
          <button type="button" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="p-4"><ArchBody fv={fv} values={values} mode="edit" model={action.res_model} setValue={(k, v) => setValues((s) => ({ ...s, [k]: v }))} /></div>
        <div className="flex gap-2 px-4 py-2 border-t">
          {footer ? children(footer).filter((b) => b.tagName === 'button' && !modifiersOf(b, values).invisible).map((b, i) => (
            <button key={i} type="button" disabled={busy} onClick={() => run(b)}
              className={`px-3 py-1 rounded text-[13px] ${/oe_highlight|btn-primary/.test(b.getAttribute('class') || '') ? 'bg-[#714B67] text-white' : 'border border-slate-300'}`}>
              {b.getAttribute('string')}
            </button>
          )) : <button type="button" className="px-3 py-1 rounded bg-[#714B67] text-white text-[13px]" onClick={() => run({ getAttribute: (a) => (a === 'special' ? 'save' : null) })}>Save</button>}
        </div>
      </div>
    </div>
  );
};

/** List + form of one window action, at /action/:actionId[/:recordId]. */
const ActionView = ({ actionsById, openAction }) => {
  const { actionId, recordId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [action, setAction] = useState(actionsById[actionId] || null);
  useEffect(() => {
    if (actionsById[actionId]) { setAction(actionsById[actionId]); return; }
    api.get(`/odoo/action/${actionId}`).then((r) => setAction(r.data.result)).catch((e) => toast.error(errMsg(e)));
  }, [actionId, actionsById]);
  const extra = useMemo(() => {
    try { return JSON.parse(new URLSearchParams(location.search).get('ctx') || '{}'); } catch (e) { return {}; }
  }, [location.search]);
  const fv = useViews(action);
  if (!action || !fv) return <div className="p-6 text-[13px] text-slate-400">Loading…</div>;
  const env = { uid: 1, active_id: extra.active_id, active_ids: extra.active_id ? [extra.active_id] : [], context: extra };
  const actionContext = { ...ctxEval(action.context, env), ...(extra.context || {}) };
  const baseDomain = (typeof action.domain === 'string' ? pyEval(action.domain, env) : action.domain) || [];
  const base = `${BASE}/action/${actionId}`;
  const qs = location.search;

  if (recordId) {
    return (
      <FormView
        key={recordId}
        model={action.res_model}
        id={recordId === 'new' ? null : recordId}
        fv={fv.form}
        title={action.name}
        actionContext={actionContext}
        onBack={() => navigate(`${base}${qs}`)}
        onCreated={(newId) => navigate(newId ? `${base}/${newId}${qs}` : `${base}/new${qs}`, { replace: !!newId })}
        onOpenAction={openAction}
      />
    );
  }
  if (!fv.tree) {
    return <FormView model={action.res_model} id={null} fv={fv.form} title={action.name} actionContext={actionContext} onBack={() => navigate(BASE)} onCreated={(newId) => newId && navigate(`${base}/${newId}${qs}`)} onOpenAction={openAction} />;
  }
  return (
    <ListView
      key={`${actionId}${qs}`}
      model={action.res_model}
      tv={fv.tree}
      sv={fv.search}
      action={action}
      title={action.name}
      actionContext={actionContext}
      baseDomain={baseDomain}
      onOpen={(id) => navigate(`${base}/${id}${qs}`)}
      onCreate={() => navigate(`${base}/new${qs}`)}
    />
  );
};

const Home = ({ apps }) => (
  <div className="p-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 max-w-5xl mx-auto">
    {apps.map((a) => (
      <Link key={a.name} to={a.first} className="flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-white/70">
        <span className="w-16 h-16 rounded-xl bg-[#714B67] text-white flex items-center justify-center text-2xl font-semibold">{a.name[0]}</span>
        <span className="text-[13px] text-slate-700">{a.name}</span>
      </Link>
    ))}
  </div>
);

const AgencyErp = () => {
  const [menus, setMenus] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => { loadMenus().then(setMenus).catch((e) => toast.error(errMsg(e))); }, []);

  const actionsById = useMemo(() => Object.fromEntries((menus || []).filter((m) => m.action).map((m) => [m.action.id, m.action])), [menus]);
  // App -> section -> items, in the instance's own order.
  const apps = useMemo(() => {
    const byApp = new Map();
    for (const m of (menus || []).slice().sort((a, b) => a.sequence - b.sequence)) {
      const parts = m.path.split('/');
      const app = parts[0];
      if (!byApp.has(app)) byApp.set(app, { name: app, sections: new Map() });
      const section = parts.length > 2 ? parts.slice(1, -1).join(' / ') : '';
      const a = byApp.get(app);
      if (!a.sections.has(section)) a.sections.set(section, []);
      a.sections.get(section).push({ ...m, to: `${BASE}/action/${m.action ? m.action.id : 0}` });
    }
    return [...byApp.values()]
      .map((a) => ({ ...a, first: [...a.sections.values()][0][0].to }))
      .sort((a, b) => (APP_ORDER.indexOf(a.name) + 99) % 99 - (APP_ORDER.indexOf(b.name) + 99) % 99);
  }, [menus]);
  const currentApp = useMemo(() => {
    const m = location.pathname.match(/\/action\/(\d+)/);
    if (!m) return null;
    return apps.find((a) => [...a.sections.values()].flat().some((i) => i.action && String(i.action.id) === m[1])) || null;
  }, [apps, location.pathname]);

  const openAction = async (act, env = {}) => {
    try {
      let action = act;
      if (!action.res_model && action.id) action = { ...(await api.get(`/odoo/action/${action.id}`)).data.result, context: act.context };
      if (action.target === 'new') { setDialog({ ...action, env }); return; }
      const ctx = typeof action.context === 'string' ? ctxEval(action.context, env) : (action.context || {});
      const q = `?ctx=${encodeURIComponent(JSON.stringify({ active_id: env.active_id, context: ctx }))}`;
      if (action.res_id) navigate(`${BASE}/action/${action.id || 0}/${action.res_id}${q}`);
      else navigate(`${BASE}/action/${action.id}${q}`);
    } catch (e) { toast.error(errMsg(e)); }
  };

  if (!menus) return <div className="p-6 text-[13px] text-slate-400">Loading SearatesERP - Agency…</div>;

  return (
    <div className="-m-4 md:-m-6 min-h-[calc(100vh-4rem)] bg-[#f9fafb] text-slate-800" style={{ fontFamily: 'Roboto, "Segoe UI", sans-serif' }}>
      {/* Odoo navbar */}
      <nav className="flex items-center h-[46px] bg-[#714B67] text-white px-2 gap-1 relative" onMouseLeave={() => setOpenMenu(null)}>
        <Link to={BASE} className="p-2 hover:bg-white/10 rounded" title="Home menu"><LayoutGrid size={18} /></Link>
        <span className="text-[16px] font-medium px-2">{currentApp ? currentApp.name : 'SearatesERP - Agency'}</span>
        {currentApp && [...currentApp.sections.entries()].map(([section, items]) => (section === '' ? items.map((it) => (
          <Link key={it.id} to={it.to} className="px-3 py-3 text-[14px] hover:bg-white/10">{it.name}</Link>
        )) : (
          <div key={section} className="relative">
            <button type="button" className="px-3 py-3 text-[14px] hover:bg-white/10 inline-flex items-center gap-1" onClick={() => setOpenMenu(openMenu === section ? null : section)}>
              {section} <ChevronDown size={12} />
            </button>
            {openMenu === section && (
              <div className="absolute left-0 top-full z-40 bg-white text-slate-800 shadow-lg rounded-b py-1 min-w-[220px]">
                {items.map((it) => <Link key={it.id} to={it.to} onClick={() => setOpenMenu(null)} className="block px-4 py-1.5 text-[14px] hover:bg-[#e9ecef]">{it.name}</Link>)}
              </div>
            )}
          </div>
        )))}
      </nav>
      <Routes>
        <Route index element={<Home apps={apps} />} />
        <Route path="action/:actionId" element={<ActionView actionsById={actionsById} openAction={openAction} />} />
        <Route path="action/:actionId/:recordId" element={<ActionView actionsById={actionsById} openAction={openAction} />} />
      </Routes>
      {dialog && <WizardDialog action={dialog} onClose={() => setDialog(null)} onDone={(next) => { setDialog(null); if (next) openAction(next); else navigate(0); }} />}
    </div>
  );
};

export default AgencyErp;
