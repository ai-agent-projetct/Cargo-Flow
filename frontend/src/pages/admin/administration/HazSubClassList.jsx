import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, SlidersHorizontal, Download, ChevronDown } from 'lucide-react';
import SearchBar from '../../../common/SearchBar';
import { HAZ_SUB_CLASSES } from './hazSubClassData';
import HazSubClassExportDataModal from './HazSubClassExportDataModal';

// "Administration > Freight Masters > HAZ Sub Class" list, mirroring SeaRates
// ERP's "HAZ Sub Class" screen: Name / HAZ Class columns, a Download-only
// toolbar (no Create), row checkboxes with an "N selected" badge + Action
// dropdown (Export), and an Export Data dialog.
const HazSubClassList = () => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowActionMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = HAZ_SUB_CLASSES
    .map((item, idx) => ({ ...item, idx }))
    .filter((item) =>
      !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.hazClass.toLowerCase().includes(search.toLowerCase())
    );

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
    }
  };

  const selectedRows = filtered.filter((item) => selected.has(item.idx));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">HAZ Sub Class</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <button className="p-1.5 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg">
              <Download className="w-4 h-4" />
            </button>
            {selected.size > 0 && (
              <>
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
                    <div className="absolute top-full mt-1 w-28 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-30">
                      <button onClick={() => handleAction('Export')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Export</button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <SearchBar value={search} onChange={setSearch} placeholder="Search..." className="w-56" />
            <button className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Filters</button>
            <button className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Group By</button>
            <button className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Favorites</button>
            <span className="text-xs text-slate-500 whitespace-nowrap">1-{filtered.length}/{filtered.length}</span>
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
                <th className="text-left px-4 py-3 whitespace-nowrap">HAZ Class</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => (
                <tr key={item.idx} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300"
                      checked={selected.has(item.idx)}
                      onChange={() => toggleSelect(item.idx)}
                    />
                  </td>
                  <td className="px-4 py-3 text-primary-600 font-medium max-w-xl truncate">{item.name}</td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{item.hazClass}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <HazSubClassExportDataModal
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        rows={selectedRows}
      />
    </div>
  );
};

export default HazSubClassList;
