import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, ChevronLeft, SlidersHorizontal } from 'lucide-react';
import SearchBar from '../../../common/SearchBar';
import { ADJUSTMENT_RATIO_TYPES } from './adjustmentRatioTypeData';

// "Administration > Freight Masters > Adjustment Ratio Type" list, mirroring
// CargoFlo ERP's "Adjustment Ratio Type" screen: a Download icon (no
// Create), Name / Is Package Group columns. Clicking a row opens its detail
// page.
const AdjustmentRatioTypeList = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const items = ADJUSTMENT_RATIO_TYPES.map((rt, i) => ({ ...rt, idx: i }));
  const filtered = items.filter((rt) =>
    !search || rt.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">Adjustment Ratio Type</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 border border-slate-200">
              <Download className="w-4 h-4" />
            </button>
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
                <th className="text-left px-4 py-3">Is Package Group</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((rt) => (
                <tr
                  key={rt.idx}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(`${rt.idx}`)}
                >
                  <td className="px-4 py-3">
                    <input type="checkbox" className="rounded border-slate-300" onClick={(e) => e.stopPropagation()} />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-700">{rt.name}</td>
                  <td className="px-4 py-3">
                    <span className={`relative inline-flex items-center w-11 h-6 rounded-full ${rt.isPackageGroup ? 'bg-primary-600' : 'bg-slate-300'}`}>
                      <span className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow flex items-center justify-center text-[10px] ${rt.isPackageGroup ? 'translate-x-5 text-primary-600' : 'text-slate-400'}`}>
                        {rt.isPackageGroup ? '✓' : '✕'}
                      </span>
                    </span>
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

export default AdjustmentRatioTypeList;
