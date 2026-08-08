import React, { useState, useEffect, useCallback } from 'react';
import { Search, CheckCircle2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { PageLoader } from '../../../common/LoadingSpinner';
import { PANES, SCHEMA } from './settingsSchema';

const MASK = '••••••••••••';

const Field = ({ f, value, onChange }) => {
  const base = 'text-sm px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-blue-600';

  if (f.kind === 'bool') {
    return (
      <label className="flex items-start gap-3 py-1.5 cursor-pointer">
        <input type="checkbox" checked={value === true || value === 'true'}
          onChange={(e) => onChange(e.target.checked)} className="rounded border-gray-300 mt-0.5 accent-blue-600" />
        <span>
          <span className="text-sm font-medium text-gray-800">{f.label}</span>
          {f.help && <span className="block text-xs text-gray-500 mt-0.5">{f.help}</span>}
        </span>
      </label>
    );
  }

  if (f.kind === 'radio') {
    return (
      <div className="py-1.5">
        <p className="text-sm font-medium text-gray-800">{f.label}</p>
        {f.help && <p className="text-xs text-gray-500 mb-1">{f.help}</p>}
        <div className="flex items-center gap-5 mt-1">
          {f.options.map((o) => (
            <label key={o.key} className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
              <input type="radio" name={f.key} checked={value === o.key}
                onChange={() => onChange(o.key)} className="accent-blue-600" />
              {o.label}
            </label>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[13rem_1fr] items-start gap-4 py-1.5">
      <div>
        <label className="text-sm font-medium text-gray-800">{f.label}</label>
        {f.help && <p className="text-xs text-gray-500">{f.help}</p>}
      </div>
      {f.kind === 'select' ? (
        <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={`${base} w-full max-w-md`}>
          {f.options.map((o) => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input
          type={f.kind === 'number' ? 'number' : 'text'}
          value={value ?? ''}
          onChange={(e) => onChange(f.kind === 'number' ? Number(e.target.value) : e.target.value)}
          placeholder={f.kind === 'password' ? 'not set — paste your key' : ''}
          className={`${base} w-full max-w-md ${f.kind === 'password' && value === MASK ? 'text-gray-400' : ''}`}
          onFocus={(e) => { if (f.kind === 'password' && e.target.value === MASK) onChange(''); }}
        />
      )}
    </div>
  );
};

// An integration card: activation checkbox, Activated pill, key fields, and the
// Activate/Deactivate button.
const IntegrationCard = ({ cat, cfg, values, set, onToggle }) => {
  const on = values[cfg.toggle] === true || values[cfg.toggle] === 'true';
  const fields = cfg.fields || (cfg.keyField ? [cfg.keyField] : []);
  return (
    <div className="flex items-start gap-3">
      <input type="checkbox" checked={on} onChange={(e) => set(cfg.toggle, e.target.checked)}
        className="rounded border-gray-300 mt-1 accent-blue-600" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="text-base font-semibold text-gray-900">{cfg.name}</h4>
          {on && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-600 text-white text-xs font-medium">
              <CheckCircle2 className="w-3 h-3" /> Activated
            </span>
          )}
        </div>
        {cfg.blurb && <p className="text-sm text-gray-600 mt-1">{cfg.blurb}</p>}
        <div className="mt-3 space-y-1">
          {fields.map((f) => (
            <Field key={f.key} f={f} value={values[f.key]} onChange={(v) => set(f.key, v)} />
          ))}
        </div>
        <button
          onClick={() => onToggle(cat, cfg.toggle, !on)}
          className={`mt-3 px-4 py-1.5 text-sm font-medium rounded text-white ${
            on ? 'bg-blue-700 hover:bg-blue-800' : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {on ? 'Deactivate' : 'Activate'}
        </button>
      </div>
    </div>
  );
};

const FreightBookingSettings = () => {
  const [pane, setPane] = useState('freight_booking');
  const [saved, setSaved] = useState({});
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings');
      const s = res.data?.data?.settings || {};
      setSaved(s);
      setDraft(JSON.parse(JSON.stringify(s)));
    } catch {
      toast.error('Could not load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageLoader />;

  const values = draft[pane] || {};
  const set = (key, v) => setDraft((d) => ({ ...d, [pane]: { ...(d[pane] || {}), [key]: v } }));
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);

  const save = async () => {
    setBusy(true);
    try {
      const res = await api.put('/settings', { settings: draft });
      toast.success(res.data?.message || 'Settings saved');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const onToggle = async (cat, key, enabled) => {
    try {
      await api.post(`/settings/${cat}/${key}/toggle`, { enabled });
      toast.success(enabled ? 'Integration activated' : 'Integration deactivated');
      await load();
    } catch {
      toast.error('Could not change the integration');
    }
  };

  // Search filters section titles and field labels across the active pane.
  const sections = (SCHEMA[pane] || []).filter((sec) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return sec.title?.toLowerCase().includes(q)
      || (sec.fields || []).some((f) => f.label.toLowerCase().includes(q))
      || sec.integration?.name?.toLowerCase().includes(q);
  });

  return (
    <div className="px-6 pb-6">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
        <div className="relative">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..."
            className="w-96 pl-3 pr-9 py-1.5 border-b border-gray-300 text-sm focus:outline-none focus:border-blue-600 bg-transparent" />
          <Search className="w-4 h-4 absolute right-1 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <button onClick={save} disabled={!dirty || busy}
          className="px-5 py-1.5 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 text-white text-sm font-semibold rounded">
          Save
        </button>
        <button onClick={() => setDraft(JSON.parse(JSON.stringify(saved)))} disabled={!dirty}
          className="px-4 py-1.5 border border-gray-300 text-sm text-gray-700 rounded hover:bg-gray-50 disabled:opacity-40">
          Discard
        </button>
        {dirty && <span className="text-xs text-amber-700">Unsaved changes</span>}
      </div>

      <div className="flex gap-0 items-start bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Left rail */}
        <nav className="w-56 flex-shrink-0 bg-slate-800 self-stretch py-2">
          {PANES.map((p) => (
            <button
              key={p.key}
              onClick={() => setPane(p.key)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                pane === p.key ? 'bg-slate-700 text-white border-l-4 border-blue-500' : 'text-slate-200 hover:bg-slate-700'
              } ${p.nested ? 'pl-12 text-xs' : ''}`}
            >
              {!p.nested && <span className={`w-5 h-5 rounded ${p.tone} flex-shrink-0`} />}
              {p.label}
            </button>
          ))}
        </nav>

        {/* Pane content */}
        <div className="flex-1 min-w-0 p-6 space-y-8">
          {sections.length === 0 ? (
            <p className="text-sm text-gray-400">No settings match &ldquo;{search}&rdquo;</p>
          ) : sections.map((sec) => (
            <div key={sec.title}>
              <div className="bg-gray-100 -mx-6 px-6 py-2 mb-4">
                <h3 className="text-base font-semibold text-gray-800">{sec.title}</h3>
              </div>

              {sec.integration ? (
                <IntegrationCard cat={pane} cfg={sec.integration} values={values} set={set} onToggle={onToggle} />
              ) : (
                <div className="space-y-1">
                  {(sec.fields || []).map((f) => (
                    <div key={f.key} className="flex items-start gap-2">
                      <div className="flex-1">
                        <Field f={f} value={values[f.key]} onChange={(v) => set(f.key, v)} />
                      </div>
                      {f.kind === 'select' && (
                        <button className="mt-2 text-blue-700 hover:text-blue-900" title="Open">
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {sec.extra && (
                <div className="mt-4 space-y-1">
                  {sec.extra.map((f) => (
                    <Field key={f.key} f={f} value={values[f.key]} onChange={(v) => set(f.key, v)} />
                  ))}
                </div>
              )}

              {sec.note && (
                <div className="mt-3 inline-block bg-cyan-50 border border-cyan-200 text-cyan-900 text-sm px-3 py-2 rounded">
                  {sec.note}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FreightBookingSettings;
