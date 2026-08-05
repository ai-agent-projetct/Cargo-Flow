import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, Download, X } from 'lucide-react';
import { GROUP_CATEGORIES, ALL_GROUPS } from './groupsData';
import ExportDataModal from './ExportDataModal';

// "Companies & Users > Groups" — matches SeaRates ERP's Applications/Groups
// list: groups organized under module category headers (e.g. "Administration
// (2)"), with checkbox selection, an "Action" menu (Export), and an
// Export Data dialog with a field picker.
const GroupsList = () => {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState(new Set());
  const [selected, setSelected] = useState(new Set());
  const [actionOpen, setActionOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const actionRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (actionRef.current && !actionRef.current.contains(e.target)) {
        setActionOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCategories = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return GROUP_CATEGORIES;
    return GROUP_CATEGORIES
      .map((cat) => ({
        ...cat,
        groups: cat.groups.filter(
          (g) => g.toLowerCase().includes(term) || cat.name.toLowerCase().includes(term)
        ),
      }))
      .filter((cat) => cat.groups.length > 0);
  }, [search]);

  const toggleCollapse = (name) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedRows = useMemo(
    () => ALL_GROUPS.filter((g) => selected.has(g.id)),
    [selected]
  );

  const clearSelection = () => setSelected(new Set());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">Groups</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <button onClick={() => {}} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 border border-slate-200">
              <Download className="w-4 h-4" />
            </button>

            {selected.size > 0 ? (
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 text-xs font-medium bg-primary-50 text-primary-700 rounded-full">
                  {selected.size} selected
                </span>
                <div className="relative" ref={actionRef}>
                  <button
                    onClick={() => setActionOpen((p) => !p)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50"
                  >
                    Action <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  {actionOpen && (
                    <div className="absolute left-0 top-full mt-1 w-32 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-30">
                      <button
                        onClick={() => { setActionOpen(false); setExportOpen(true); }}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        Export
                      </button>
                    </div>
                  )}
                </div>
                <button onClick={clearSelection} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-primary-50 text-primary-700 rounded-lg text-xs font-medium">
                Applications <X className="w-3 h-3" />
              </div>
            )}

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 w-48"
            />
          </div>

          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Filters</button>
            <button className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Group By</button>
            <button className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Favorites</button>
            <span className="text-xs text-slate-500">1-{filteredCategories.length}/{GROUP_CATEGORIES.length}</span>
          </div>
        </div>

        {/* List */}
        <div className="divide-y divide-slate-100">
          {/* Column header */}
          <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
            <input type="checkbox" className="rounded border-slate-300" disabled />
            <span>Group Name</span>
          </div>

          {filteredCategories.map((cat) => (
            <div key={cat.name}>
              {/* Category header row */}
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-50/70 cursor-pointer hover:bg-slate-100" onClick={() => toggleCollapse(cat.name)}>
                {collapsed.has(cat.name) ? (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span className="text-sm font-semibold text-slate-700">
                  {cat.name} ({cat.groups.length})
                </span>
              </div>

              {/* Group rows */}
              {!collapsed.has(cat.name) &&
                cat.groups.map((g) => {
                  const id = `${cat.name} / ${g}`;
                  return (
                    <div key={id} className="flex items-center gap-3 px-4 py-2 pl-9 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300"
                        checked={selected.has(id)}
                        onChange={() => toggleSelect(id)}
                      />
                      <span className="text-sm text-slate-700">{cat.name} / {g}</span>
                    </div>
                  );
                })}
            </div>
          ))}

          {filteredCategories.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-slate-400">No groups found</div>
          )}
        </div>
      </div>

      <ExportDataModal isOpen={exportOpen} onClose={() => setExportOpen(false)} rows={selectedRows} />
    </div>
  );
};

export default GroupsList;
