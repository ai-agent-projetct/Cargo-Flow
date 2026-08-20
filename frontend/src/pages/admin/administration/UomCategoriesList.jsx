import React, { useState } from 'react';
import { Download, ChevronLeft } from 'lucide-react';
import SearchBar from '../../../common/SearchBar';
import { UOM_CATEGORIES } from './uomCategoriesData';

// "Administration > Freight Masters > Unit of Measures" list, mirroring
// CargoFlo ERP's "Units of Measure Categories" screen: one row per UoM
// category, with all UoMs for that category shown as chips and the
// reference/active UoM highlighted.
const UomCategoriesList = () => {
  const [search, setSearch] = useState('');

  const filtered = UOM_CATEGORIES.filter((cat) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return cat.category.toLowerCase().includes(q) || cat.uoms.some((u) => u.label.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">Units of Measure Categories</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
          <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 border border-slate-200">
            <Download className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <SearchBar value={search} onChange={setSearch} placeholder="Search..." className="w-56" />
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
                <th className="text-left px-4 py-3 w-56">Unit of Measure Category...</th>
                <th className="text-left px-4 py-3">Uom</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((cat) => (
                <tr key={cat.category} className="hover:bg-slate-50 align-top">
                  <td className="px-4 py-3">
                    <input type="checkbox" className="rounded border-slate-300" />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{cat.category}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {cat.uoms.map((u) => (
                        <span
                          key={u.code}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                            u.active
                              ? 'bg-teal-600 text-white'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {u.label}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UomCategoriesList;
