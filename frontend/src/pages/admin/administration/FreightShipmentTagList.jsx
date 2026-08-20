import React, { useState, useRef, useEffect } from 'react';

import { FREIGHT_SHIPMENT_TAGS } from './freightShipmentTagData';
import TagExportDataModal from './TagExportDataModal';
import MasterListToolbar from './MasterListToolbar';

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
        <MasterListToolbar
          rows={filtered}
          filename="freight-shipment-tag"
          search={search}
          onSearch={setSearch}
          selectedCount={selected.size}
          onAction={handleAction}
        />

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
