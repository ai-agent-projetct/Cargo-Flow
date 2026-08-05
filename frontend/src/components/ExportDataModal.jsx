import React, { useState } from 'react';
import { X, Plus, Trash2, GripVertical, Search } from 'lucide-react';
import * as XLSX from 'xlsx';

// Odoo-style "Export Data" modal: pick fields from the full available-fields
// list on the left, build an ordered export list on the right, then download
// the selected records as XLSX or CSV.
const ExportDataModal = ({ isOpen, onClose, fields, records, filename }) => {
  const [search, setSearch] = useState('');
  const [format, setFormat] = useState('xlsx');
  const [selected, setSelected] = useState(() => fields.filter((f) => f.default).map((f) => f.key));

  if (!isOpen) return null;

  const byKey = (key) => fields.find((f) => f.key === key);

  const availableFields = fields.filter(
    (f) => !selected.includes(f.key) && f.label.toLowerCase().includes(search.toLowerCase())
  );

  const addField = (key) => setSelected((prev) => [...prev, key]);
  const removeField = (key) => setSelected((prev) => prev.filter((k) => k !== key));

  const handleExport = () => {
    const exportFields = selected.map(byKey).filter(Boolean);
    const data = records.map((rec) => {
      const row = {};
      exportFields.forEach((f) => { row[f.label] = f.get(rec); });
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(data, { header: exportFields.map((f) => f.label) });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

    if (format === 'csv') {
      XLSX.writeFile(wb, `${filename}.csv`, { bookType: 'csv' });
    } else {
      XLSX.writeFile(wb, `${filename}.xlsx`, { bookType: 'xlsx' });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-blue-700">Export Data</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center justify-between px-6 pt-4">
          <span className="text-sm text-gray-500">{records.length} record{records.length === 1 ? '' : 's'} selected</span>
          <div className="flex items-center gap-4 text-sm">
            <span className="font-medium text-gray-700">Export Format:</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name="exportFormat" checked={format === 'xlsx'} onChange={() => setFormat('xlsx')} />
              XLSX
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name="exportFormat" checked={format === 'csv'} onChange={() => setFormat('csv')} />
              CSV
            </label>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-4 px-6 py-4 overflow-hidden">
          {/* Available fields */}
          <div className="flex flex-col border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
              <p className="text-xs font-semibold text-gray-600 mb-2">Available fields</p>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {availableFields.map((f) => (
                <button
                  key={f.key}
                  onClick={() => addField(f.key)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-sm text-gray-700 hover:bg-blue-50 text-left"
                >
                  <span>{f.label}</span>
                  <Plus className="w-3.5 h-3.5 text-gray-400" />
                </button>
              ))}
              {availableFields.length === 0 && (
                <p className="text-center text-xs text-gray-400 py-6">No matching fields</p>
              )}
            </div>
          </div>

          {/* Fields to export */}
          <div className="flex flex-col border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
              <p className="text-xs font-semibold text-gray-600">Fields to export</p>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {selected.map((key) => {
                const f = byKey(key);
                if (!f) return null;
                return (
                  <div key={key} className="flex items-center justify-between px-3 py-1.5 text-sm text-gray-700">
                    <span className="flex items-center gap-2">
                      <GripVertical className="w-3.5 h-3.5 text-gray-300" />
                      {f.label}
                    </span>
                    <button onClick={() => removeField(key)} className="text-gray-400 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
              {selected.length === 0 && (
                <p className="text-center text-xs text-gray-400 py-6">No fields selected</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg"
          >
            Close
          </button>
          <button
            onClick={handleExport}
            disabled={selected.length === 0 || records.length === 0}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportDataModal;
