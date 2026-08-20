import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, SlidersHorizontal, Download, ChevronDown } from 'lucide-react';
import SearchBar from '../../../common/SearchBar';
import { FREIGHT_SHIPMENT_TAGS } from './freightShipmentTagData';
import TagExportDataModal from './TagExportDataModal';

// "Administration > Freight Masters > Freight Shipment Tag" list, mirroring
// CargoFlo ERP's "Freight Shipment Tag" screen: single "Name" column,
// Create button that inserts an inline-editable row at the top (with an "EN"
// translation badge, switching the toolbar to Save/Discard), row checkboxes
// with an "N selected" badge + Action dropdown (Export/Archive/Unarchive),
// and an Export Data dialog.
const FreightShipmentTagList = () => {
  const [search, setSearch] = useState('');
  const [tags, setTags] = useState(FREIGHT_SHIPMENT_TAGS);
  const [isCreating, setIsCreating] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const menuRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isCreating && inputRef.current) inputRef.current.focus();
  }, [isCreating]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowActionMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = tags
    .map((name, idx) => ({ name, idx }))
    .filter((t) => !search || t.name.toLowerCase().includes(search.toLowerCase()));

  const total = filtered.length + (isCreating ? 1 : 0);

  const handleCreate = () => {
    setIsCreating(true);
    setNewValue('');
  };

  const handleSave = () => {
    if (newValue.trim()) {
      setTags((prev) => [newValue.trim(), ...prev]);
    }
    setIsCreating(false);
    setNewValue('');
  };

  const handleDiscard = () => {
    setIsCreating(false);
    setNewValue('');
  };

  const toggleSelect = (idx) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleAction = (action) => {
    setShowActionMenu(false);
    if (action === 'Export') {
      setShowExport(true);
    } else if (action === 'Archive' || action === 'Unarchive') {
      setSelected(new Set());
    }
  };

  const selectedRows = filtered.filter((t) => selected.has(t.idx));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">Freight Shipment Tag</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            {isCreating ? (
              <>
                <button
                  onClick={handleSave}
                  className="px-4 py-1.5 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
                >
                  Save
                </button>
                <button
                  onClick={handleDiscard}
                  className="px-4 py-1.5 text-sm font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Discard
                </button>
              </>
            ) : selected.size > 0 ? (
              <>
                <button
                  onClick={handleCreate}
                  className="px-4 py-1.5 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
                >
                  Create
                </button>
                <span className="px-2 py-1 text-xs font-medium bg-primary-50 text-primary-600 rounded-lg">
                  {selected.size} selected
                </span>
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setShowActionMenu((prev) => !prev)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                  >
                    Action <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  {showActionMenu && (
                    <div className="absolute top-full mt-1 w-32 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-30">
                      <button onClick={() => handleAction('Export')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Export</button>
                      <button onClick={() => handleAction('Archive')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Archive</button>
                      <button onClick={() => handleAction('Unarchive')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Unarchive</button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button
                onClick={handleCreate}
                className="px-4 py-1.5 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
              >
                Create
              </button>
            )}
            <button className="p-1.5 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg">
              <Download className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <SearchBar value={search} onChange={setSearch} placeholder="Search..." className="w-56" />
            <button className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Filters</button>
            <button className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Group By</button>
            <button className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Favorites</button>
            <span className="text-xs text-slate-500 whitespace-nowrap">1-{total}/{total}</span>
            <button className="p-1.5 text-slate-400 hover:text-slate-600"><ChevronLeft className="w-4 h-4" /></button>
            <button className="p-1.5 text-slate-400 hover:text-slate-600"><SlidersHorizontal className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 w-8">
                  <input type="checkbox" className="rounded border-slate-300" disabled />
                </th>
                <th className="text-left px-4 py-3">Name</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isCreating && (
                <tr className="bg-primary-50/40">
                  <td className="px-4 py-2">
                    <input type="checkbox" className="rounded border-slate-300" disabled />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        ref={inputRef}
                        type="text"
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSave();
                          if (e.key === 'Escape') handleDiscard();
                        }}
                        placeholder="e.g. Urgent"
                        className="flex-1 border border-primary-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 border border-slate-200 rounded">EN</span>
                    </div>
                  </td>
                </tr>
              )}
              {filtered.map((t) => (
                <tr key={t.idx} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300"
                      checked={selected.has(t.idx)}
                      onChange={() => toggleSelect(t.idx)}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-700">{t.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <TagExportDataModal
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        rows={selectedRows}
      />
    </div>
  );
};

export default FreightShipmentTagList;
