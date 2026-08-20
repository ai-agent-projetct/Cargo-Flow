import React, { useState, useRef, useEffect } from 'react';

import { VOLUMETRIC_DIVIDED_VALUES, UOM_OPTIONS } from './volumetricDividedValueData';
import { TRANSPORT_MODES } from './freightMastersData';
import VolumetricExportDataModal from './VolumetricExportDataModal';
import MasterListToolbar from './MasterListToolbar';

const modeLabel = (code) => {
  const tm = TRANSPORT_MODES.find((t) => t.code === code);
  return tm ? `[${tm.code}] ${tm.name}` : code;
};

const formatNumber = (n) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// "Administration > Freight Masters > Volumetric Divided Value" list,
// mirroring CargoFlo ERP's "Volumetric Divided Value" screen: Transport Mode
// / UOM / Pound (toggle) / Divided Value columns, a Create button that
// inserts an inline-editable row at the top (switching the toolbar to
// Save/Discard), row checkboxes with an "N selected" badge + Action dropdown
// (Export), and an Export Data dialog.
const VolumetricDividedValueList = () => {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState(VOLUMETRIC_DIVIDED_VALUES);
  const [isCreating, setIsCreating] = useState(false);
  const [newRow, setNewRow] = useState({ transportMode: '', uom: '', pound: false, dividedValue: 0 });
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

  const filtered = items
    .map((item, idx) => ({ ...item, idx }))
    .filter((item) =>
      !search ||
      modeLabel(item.transportMode).toLowerCase().includes(search.toLowerCase()) ||
      item.uom.toLowerCase().includes(search.toLowerCase())
    );

  const total = filtered.length + (isCreating ? 1 : 0);

  const handleCreate = () => {
    setIsCreating(true);
    setNewRow({ transportMode: '', uom: '', pound: false, dividedValue: 0 });
  };

  const handleSave = () => {
    if (newRow.transportMode || newRow.uom) {
      setItems((prev) => [{ ...newRow, dividedValue: Number(newRow.dividedValue) || 0 }, ...prev]);
    }
    setIsCreating(false);
  };

  const handleDiscard = () => {
    setIsCreating(false);
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
    }
  };

  const selectedRows = filtered.filter((item) => selected.has(item.idx));

  const Toggle = ({ value }) => (
    <span className={`relative inline-flex items-center w-11 h-6 rounded-full ${value ? 'bg-primary-600' : 'bg-slate-300'}`}>
      <span className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow flex items-center justify-center text-[10px] ${value ? 'translate-x-5 text-primary-600' : 'text-slate-400'}`}>
        {value ? '✓' : '✕'}
      </span>
    </span>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">Volumetric Divided Value</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <MasterListToolbar
          rows={filtered}
          filename="volumetric-divided-value"
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
                <th className="text-left px-4 py-3">Transport Mode</th>
                <th className="text-left px-4 py-3">UOM</th>
                <th className="text-left px-4 py-3">Pound</th>
                <th className="text-right px-4 py-3">Divided Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isCreating && (
                <tr className="bg-primary-50/40">
                  <td className="px-4 py-2">
                    <input type="checkbox" className="rounded border-slate-300" disabled />
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={newRow.transportMode}
                      onChange={(e) => setNewRow((prev) => ({ ...prev, transportMode: e.target.value }))}
                      className="w-full border border-primary-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select...</option>
                      {TRANSPORT_MODES.map((tm) => (
                        <option key={tm.code} value={tm.code}>{modeLabel(tm.code)}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={newRow.uom}
                      onChange={(e) => setNewRow((prev) => ({ ...prev, uom: e.target.value }))}
                      className="w-full border border-primary-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select...</option>
                      {UOM_OPTIONS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => setNewRow((prev) => ({ ...prev, pound: !prev.pound }))}
                    >
                      <Toggle value={newRow.pound} />
                    </button>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step="0.01"
                      value={newRow.dividedValue}
                      onChange={(e) => setNewRow((prev) => ({ ...prev, dividedValue: e.target.value }))}
                      className="w-full text-right border border-primary-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </td>
                </tr>
              )}
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
                  <td className="px-4 py-3 text-primary-600 font-medium">{modeLabel(item.transportMode)}</td>
                  <td className="px-4 py-3 text-slate-700">{item.uom}</td>
                  <td className="px-4 py-3">
                    {item.pound ? (
                      <Toggle value={true} />
                    ) : (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-slate-300 text-slate-400">
                        <XIcon className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">{formatNumber(item.dividedValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <VolumetricExportDataModal
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        rows={selectedRows}
      />
    </div>
  );
};

export default VolumetricDividedValueList;
