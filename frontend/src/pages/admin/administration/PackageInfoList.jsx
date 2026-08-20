import React, { useState, useRef, useEffect } from 'react';
import { Download } from 'lucide-react';
import { PACKAGE_INFOS } from './packageInfoData';
import PackageInfoExportDataModal from './PackageInfoExportDataModal';
import MasterListToolbar from './MasterListToolbar';

// "Administration > Freight Masters > Package Info" list, mirroring CargoFlo
// ERP's "Package Info" screen: Code / Kind / Type / Material Code / Material
// / Category columns, a Download-only toolbar (no Create), row checkboxes
// with an "N selected" badge + Action dropdown (Export), and an Export Data
// dialog.
const PackageInfoList = () => {
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

  const filtered = PACKAGE_INFOS
    .map((item, idx) => ({ ...item, idx }))
    .filter((item) =>
      !search ||
      item.code.toLowerCase().includes(search.toLowerCase()) ||
      item.type.toLowerCase().includes(search.toLowerCase()) ||
      item.material.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase())
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
        <h2 className="text-xl font-bold text-slate-900">Package Info</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <MasterListToolbar
          rows={filtered}
          filename="package-info"
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
                <th className="text-left px-4 py-3">Code</th>
                <th className="text-left px-4 py-3">Kind</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Material Code</th>
                <th className="text-left px-4 py-3">Material</th>
                <th className="text-left px-4 py-3">Category</th>
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
                  <td className="px-4 py-3 text-primary-600 font-medium whitespace-nowrap">{item.code}</td>
                  <td className="px-4 py-3 text-slate-700">{item.kind}</td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{item.type}</td>
                  <td className="px-4 py-3 text-slate-700">{item.materialCode}</td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{item.material}</td>
                  <td className="px-4 py-3 text-slate-700">{item.category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <PackageInfoExportDataModal
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        rows={selectedRows}
      />
    </div>
  );
};

export default PackageInfoList;
