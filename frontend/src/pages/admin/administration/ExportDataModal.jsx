import React, { useState, useMemo } from 'react';
import { X, ChevronRight, Plus, Trash2, GripVertical } from 'lucide-react';
import { EXPORT_FIELD_TREE } from './groupsData';

// Recursive node renderer for the "Available fields" tree on the left side of
// the Export Data modal (mirrors SeaRates ERP's Odoo-style export dialog).
const FieldNode = ({ node, depth, path, expanded, toggleExpand, onAdd, filter }) => {
  const fullPath = [...path, node.label];
  const key = fullPath.join(' / ');
  const isExpanded = expanded.has(key);

  if (filter && !node.label.toLowerCase().includes(filter.toLowerCase()) && !node.expandable) {
    return null;
  }

  return (
    <div>
      <div
        className="flex items-center justify-between px-2 py-1 text-sm text-slate-700 hover:bg-slate-50 rounded cursor-default"
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        <div
          className={`flex items-center gap-1 ${node.expandable ? 'cursor-pointer' : ''}`}
          onClick={() => node.expandable && toggleExpand(key)}
        >
          {node.expandable ? (
            <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          ) : (
            <span className="w-3.5 h-3.5" />
          )}
          <span>{node.label}</span>
        </div>
        {!node.expandable && (
          <button
            type="button"
            onClick={() => onAdd(fullPath.join(' / '))}
            className="p-0.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded"
            title="Add field"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {node.expandable && isExpanded && (
        <div>
          {(node.children || []).map((child, i) => (
            <FieldNode
              key={i}
              node={child}
              depth={depth + 1}
              path={fullPath}
              expanded={expanded}
              toggleExpand={toggleExpand}
              onAdd={onAdd}
              filter={filter}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ExportDataModal = ({ isOpen, onClose, rows = [] }) => {
  const [importCompatible, setImportCompatible] = useState(false);
  const [format, setFormat] = useState('xlsx');
  const [template, setTemplate] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(new Set());
  const [fields, setFields] = useState(['Group Name']);

  const toggleExpand = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const addField = (path) => {
    setFields((prev) => (prev.includes(path) ? prev : [...prev, path]));
  };

  const removeField = (path) => {
    setFields((prev) => prev.filter((f) => f !== path));
  };

  const moveField = (index, dir) => {
    setFields((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const filteredTree = useMemo(() => EXPORT_FIELD_TREE, []);

  const handleExport = () => {
    const headers = fields;
    const lines = [headers.join(',')];
    rows.forEach((row) => {
      const cells = headers.map((h) => {
        if (h === 'Group Name') return `"${(row.groupName || '').replace(/"/g, '""')}"`;
        return '';
      });
      lines.push(cells.join(','));
    });
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: format === 'csv' ? 'text/csv' : 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Groups Export.${format === 'csv' ? 'csv' : 'xls'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-primary-600">Export Data</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={importCompatible}
                onChange={(e) => setImportCompatible(e.target.checked)}
                className="rounded border-slate-300"
              />
              I want to update data (import-compatible export)
            </label>

            <div className="flex items-center gap-4 text-sm">
              <span className="font-medium text-slate-700">Export Format:</span>
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

          <div className="grid grid-cols-2 gap-4">
            {/* Available fields */}
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-2">Available fields</h3>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                className="w-full mb-2 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <div className="border border-slate-200 rounded-lg h-72 overflow-y-auto py-1">
                {filteredTree.map((node, i) => (
                  <FieldNode
                    key={i}
                    node={node}
                    depth={0}
                    path={[]}
                    expanded={expanded}
                    toggleExpand={toggleExpand}
                    onAdd={addField}
                    filter={search}
                  />
                ))}
              </div>
            </div>

            {/* Fields to export */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-800">Fields to export</h3>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <span>Template:</span>
                  <select
                    value={template}
                    onChange={(e) => setTemplate(e.target.value)}
                    className="px-2 py-1 text-xs border border-slate-200 rounded"
                  >
                    <option value="">New template</option>
                  </select>
                </div>
              </div>
              <div className="border border-slate-200 rounded-lg h-72 overflow-y-auto p-1 space-y-1">
                {fields.length === 0 && (
                  <p className="text-xs text-slate-400 px-2 py-4 text-center">No fields selected</p>
                )}
                {fields.map((f, i) => (
                  <div key={f} className="flex items-center justify-between px-2 py-1.5 text-sm bg-slate-50 rounded border border-slate-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <GripVertical className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      <span className="truncate">{f}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => moveField(i, -1)} disabled={i === 0} className="text-slate-400 hover:text-slate-700 disabled:opacity-30 text-xs px-1">▲</button>
                      <button onClick={() => moveField(i, 1)} disabled={i === fields.length - 1} className="text-slate-400 hover:text-slate-700 disabled:opacity-30 text-xs px-1">▼</button>
                      <button onClick={() => removeField(f)} className="p-1 text-slate-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center gap-3 bg-slate-50 rounded-b-2xl">
          <button onClick={handleExport} className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium">
            Export
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportDataModal;
