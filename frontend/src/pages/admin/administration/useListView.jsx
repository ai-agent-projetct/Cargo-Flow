import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Filter, Layers, Star } from 'lucide-react';
import toast from 'react-hot-toast';

// Filters / Group By / Favorites, as used across the Administration lists.
//
// The hook does the work rather than just rendering three buttons: it returns
// the processed rows, so a screen wires it up by rendering `controls` and
// reading `rows` instead of its own array.

const BTN = 'px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50';

// Most master-data rows carry one of these to say whether they are live.
const ACTIVE_KEYS = ['isActive', 'active', 'status'];

const isActive = (row) => {
  for (const k of ACTIVE_KEYS) {
    if (row[k] === undefined) continue;
    if (typeof row[k] === 'boolean') return row[k];
    return !['inactive', 'archived', 'disabled', 'false'].includes(String(row[k]).toLowerCase());
  }
  return true;
};

export const useListView = (rows = [], { key = 'list', groupFields = [] } = {}) => {
  const [view, setView] = useState({ show: 'all', groupBy: '' });
  const [menu, setMenu] = useState(null);
  const [favorite, setFavorite] = useState(() => !!localStorage.getItem(`cargoflo.fav.${key}`));
  const ref = useRef(null);

  useEffect(() => {
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setMenu(null); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  // Restore a saved view when this list is opened.
  useEffect(() => {
    const saved = localStorage.getItem(`cargoflo.fav.${key}`);
    setFavorite(!!saved);
    if (saved) {
      try { setView(JSON.parse(saved)); } catch { /* a corrupt entry means no favourite */ }
    }
  }, [key]);

  const processed = useMemo(() => {
    let out = rows;
    if (view.show === 'active') out = out.filter(isActive);
    else if (view.show === 'inactive') out = out.filter((r) => !isActive(r));
    return out;
  }, [rows, view.show]);

  // Group By returns [label, rows][] so a screen can render section headers.
  const groups = useMemo(() => {
    if (!view.groupBy) return null;
    const map = new Map();
    processed.forEach((r) => {
      const label = String(r[view.groupBy] ?? '') || 'Undefined';
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(r);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [processed, view.groupBy]);

  const apply = (patch) => { setView((v) => ({ ...v, ...patch })); setMenu(null); };

  const toggleFavorite = () => {
    const k = `cargoflo.fav.${key}`;
    if (favorite) { localStorage.removeItem(k); setFavorite(false); toast('Removed from favourites'); return; }
    localStorage.setItem(k, JSON.stringify(view));
    setFavorite(true);
    toast.success('Saved this view to favourites');
  };

  const controls = (
    <div className="flex items-center gap-2" ref={ref}>
      <div className="relative">
        <button onClick={() => setMenu(menu === 'f' ? null : 'f')}
          className={`${BTN} inline-flex items-center gap-1 ${view.show !== 'all' ? 'text-primary-600 border-primary-200' : ''}`}>
          <Filter className="w-3.5 h-3.5" /> Filters
        </button>
        {menu === 'f' && (
          <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-30">
            {[['all', 'All records'], ['active', 'Active only'], ['inactive', 'Archived only']].map(([k, label]) => (
              <button key={k} onClick={() => apply({ show: k })}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${view.show === k ? 'text-primary-600 font-medium' : 'text-slate-700'}`}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <button onClick={() => setMenu(menu === 'g' ? null : 'g')}
          disabled={!groupFields.length}
          title={groupFields.length ? 'Group rows' : 'Nothing to group this list by'}
          className={`${BTN} inline-flex items-center gap-1 disabled:opacity-40 ${view.groupBy ? 'text-primary-600 border-primary-200' : ''}`}>
          <Layers className="w-3.5 h-3.5" /> Group By
        </button>
        {menu === 'g' && groupFields.length > 0 && (
          <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-30">
            <button onClick={() => apply({ groupBy: '' })}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${!view.groupBy ? 'text-primary-600 font-medium' : 'text-slate-700'}`}>
              None
            </button>
            {groupFields.map((f) => (
              <button key={f.key} onClick={() => apply({ groupBy: f.key })}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${view.groupBy === f.key ? 'text-primary-600 font-medium' : 'text-slate-700'}`}>
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <button onClick={toggleFavorite}
        className={`${BTN} inline-flex items-center gap-1 ${favorite ? 'text-amber-500 border-amber-200' : ''}`}>
        <Star className={`w-3.5 h-3.5 ${favorite ? 'fill-amber-400' : ''}`} /> Favorites
      </button>
    </div>
  );

  return { rows: processed, groups, controls, view };
};

export default useListView;
