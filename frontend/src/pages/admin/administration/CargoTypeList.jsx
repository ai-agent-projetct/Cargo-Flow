import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, ChevronLeft, ChevronDown, ChevronRight, X, Search } from 'lucide-react';
import { CARGO_TYPES, TRANSPORT_MODES } from './freightMastersData';

// "Administration > Freight Masters > Cargo Type" list, mirroring CargoFlo
// ERP's "Cargo Type" screen: grouped by Transport Mode (collapsible group
// headers with record counts), Code / Name / Transport Mode / Active columns.
const CargoTypeList = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState({});

  const filtered = CARGO_TYPES.filter((ct) =>
    !search ||
    ct.name.toLowerCase().includes(search.toLowerCase()) ||
    ct.code.toLowerCase().includes(search.toLowerCase())
  );

  // Preserve the original ordering (SEA, AIR, ROA) while grouping.
  const groups = [];
  filtered.forEach((ct) => {
    let group = groups.find((g) => g.mode === ct.transportMode);
    if (!group) {
      const tm = TRANSPORT_MODES.find((t) => t.code === ct.transportMode);
      group = { mode: ct.transportMode, label: tm ? `[${tm.code}] ${tm.name}` : ct.transportMode, items: [] };
      groups.push(group);
    }
    group.items.push(ct);
  });

  const toggleGroup = (mode) => {
    setCollapsed((prev) => ({ ...prev, [mode]: !prev[mode] }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">Cargo Type</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
          <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 border border-slate-200">
            <Download className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-2 py-1.5 w-72">
              <span className="flex items-center gap-1 px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded">
                <span className="w-3 h-3 inline-flex items-center justify-center bg-primary-600 text-white rounded-sm text-[8px]">≡</span>
                Transport Mode
                <X className="w-3 h-3 cursor-pointer" />
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="flex-1 text-sm outline-none"
              />
              <Search className="w-4 h-4 text-slate-400" />
            </div>
            <button className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Filters</button>
            <button className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Group By</button>
            <button className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Favorites</button>
            <span className="text-xs text-slate-500 whitespace-nowrap">1-{filtered.length}/{filtered.length}</span>
            <button className="p-1.5 text-slate-400 hover:text-slate-600"><ChevronLeft className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 w-8">
                  <input type="checkbox" className="rounded border-slate-300" disabled />
                </th>
                <th className="text-left px-4 py-3">Code</th>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Transport Mode</th>
                <th className="text-left px-4 py-3">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groups.map((group) => (
                <React.Fragment key={group.mode}>
                  <tr className="bg-slate-50 cursor-pointer" onClick={() => toggleGroup(group.mode)}>
                    <td colSpan={5} className="px-4 py-2 font-semibold text-slate-700 text-sm">
                      <span className="inline-flex items-center gap-1">
                        {collapsed[group.mode] ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        {group.label} ({group.items.length})
                      </span>
                    </td>
                  </tr>
                  {!collapsed[group.mode] && group.items.map((ct, i) => (
                    <tr
                      key={`${group.mode}-${ct.code}-${i}`}
                      className="hover:bg-slate-50 cursor-pointer"
                      onClick={() => navigate(`${ct.transportMode}-${ct.code}`)}
                    >
                      <td className="px-4 py-3">
                        <input type="checkbox" className="rounded border-slate-300" onClick={(e) => e.stopPropagation()} />
                      </td>
                      <td className="px-4 py-3 font-medium text-primary-600">{ct.code}</td>
                      <td className="px-4 py-3 text-primary-600">{ct.name}</td>
                      <td className="px-4 py-3 text-primary-600">{group.label}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center justify-center w-9 h-5 rounded-full ${ct.active ? 'bg-primary-600' : 'bg-slate-300'}`}>
                          <span className="text-[10px] text-white">{ct.active ? '✓' : ''}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CargoTypeList;
