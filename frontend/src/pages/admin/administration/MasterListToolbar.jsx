import React, { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, ChevronLeft, ChevronRight, SlidersHorizontal, Filter, Layers, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import SearchBar from '../../../common/SearchBar';
import { exportCsv } from '../../../utils/exportCsv';

// The master-data screens under Administration all carried the same toolbar,
// copied file to file, with none of its controls wired up. This is that toolbar
// once, with working handlers.
//
// Filters / Group By need the parent to apply them, so they are reported
// through onViewChange. A parent that does not pass it gets those two controls
// hidden rather than shown-but-dead.
const MasterListToolbar = ({
  rows = [],
  columns,
  filename = 'master-data',
  search,
  onSearch,
  selectedCount = 0,
  onAction,
  onViewChange,
  groupFields = [],
  activeField = 'isActive',
}) => {
  const [menu, setMenu] = useState(null);
  const [showAction, setShowAction] = useState(false);
  const [view, setView] = useState({ show: 'all', groupBy: '' });
  const [favorite, setFavorite] = useState(() => !!localStorage.getItem(`cargoflo.fav.${filename}`));
  const menuRef = useRef(null);
  const actionRef = useRef(null);

  useEffect(() => {
    const away = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(null);
      if (actionRef.current && !actionRef.current.contains(e.target)) setShowAction(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const apply = (patch) => {
    const next = { ...view, ...patch };
    setView(next);
    setMenu(null);
    onViewChange?.(next);
  };

  const doExport = () => {
    if (exportCsv(rows, columns, filename)) toast.success(`Exported ${rows.length} rows`);
    else toast.error('Nothing to export');
  };

  const toggleFavorite = () => {
    const key = `cargoflo.fav.${filename}`;
    if (favorite) { localStorage.removeItem(key); setFavorite(false); toast('Removed from favourites'); return; }
    localStorage.setItem(key, JSON.stringify(view));
    setFavorite(true);
    toast.success('Saved this view to favourites');
  };

  const btn = 'px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50';

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
      <div className="flex items-center gap-2">
        <button onClick={doExport} title="Export to CSV"
          className="p-1.5 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg">
          <Download className="w-4 h-4" />
        </button>
        {selectedCount > 0 && (
          <>
            <span className="px-2 py-1 text-xs font-medium bg-primary-50 text-primary-600 rounded-lg">
              {selectedCount} selected
            </span>
            <div className="relative" ref={actionRef}>
              <button onClick={() => setShowAction((p) => !p)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                Action <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {showAction && (
                <div className="absolute top-full mt-1 w-32 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-30">
                  <button onClick={() => { setShowAction(false); onAction?.('Export'); }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Export</button>
                  <button onClick={() => { setShowAction(false); onAction?.('Archive'); }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Archive</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2" ref={menuRef}>
        <SearchBar value={search} onChange={onSearch} placeholder="Search..." className="w-56" />

        {onViewChange && (
          <div className="relative">
            <button onClick={() => setMenu(menu === 'filters' ? null : 'filters')}
              className={`${btn} inline-flex items-center gap-1 ${view.show !== 'all' ? 'text-primary-600 border-primary-200' : ''}`}>
              <Filter className="w-3.5 h-3.5" /> Filters
            </button>
            {menu === 'filters' && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-30">
                {[['all', 'All records'], ['active', activeField === 'isActive' ? 'Active only' : 'Enabled only'], ['inactive', 'Archived only']]
                  .map(([k, label]) => (
                    <button key={k} onClick={() => apply({ show: k })}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${view.show === k ? 'text-primary-600 font-medium' : 'text-slate-700'}`}>
                      {label}
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}

        {onViewChange && groupFields.length > 0 && (
          <div className="relative">
            <button onClick={() => setMenu(menu === 'group' ? null : 'group')}
              className={`${btn} inline-flex items-center gap-1 ${view.groupBy ? 'text-primary-600 border-primary-200' : ''}`}>
              <Layers className="w-3.5 h-3.5" /> Group By
            </button>
            {menu === 'group' && (
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
        )}

        <button onClick={toggleFavorite}
          className={`${btn} inline-flex items-center gap-1 ${favorite ? 'text-amber-500 border-amber-200' : ''}`}>
          <Star className={`w-3.5 h-3.5 ${favorite ? 'fill-amber-400' : ''}`} /> Favorites
        </button>

        <span className="text-xs text-slate-500 whitespace-nowrap">1-{rows.length}/{rows.length}</span>

        {/* These lists load in full, so there is never a second page. Disabled
            with a reason rather than looking clickable. */}
        <button disabled title="All records fit on one page"
          className="p-1.5 text-slate-300 cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
        <button disabled title="All records fit on one page"
          className="p-1.5 text-slate-300 cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>

        <button onClick={doExport} title="Download this list"
          className="p-1.5 text-slate-400 hover:text-slate-600"><SlidersHorizontal className="w-4 h-4" /></button>
      </div>
    </div>
  );
};

export default MasterListToolbar;
